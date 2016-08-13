'use strict';
const _ = require('lodash'),
    GpxFileBuilder = require('gpx').GpxFileBuilder,
    moment = require('moment'),
    winston = require('winston'),
    cache = require('./cache'),
    osmApi = require('./osmApi');

function sendEvent(visitor, action, label) {
    winston.info(`${action} - ${label}`);
    if (visitor) {
        visitor.event({
            ec: 'OSM2GPXv3',
            ea: action,
            el: label,
            aip: true
        }).send();
    }
}

function sendTiming(visitor, variable, time) {
    winston.info(`${variable} - ${time}ms`);
    if (visitor) {
        visitor.timing({
            utc: 'OSM2GPXv3',
            utv: variable,
            utt: time,
            aip: true
        }).send();
    }
}

function transformTags(tags) {
    return _.transform(tags || [], (result, {$k, $v}) => {
        result[$k] = $v;
    }, {});
}

function writeOsmNode(builder, {$id, $lat, $lon, tags: {name = null}}) {
    winston.silly(`Adding node ${name || $id}`);
    builder.addWayPoints({
        latitude: $lat,
        longitude: $lon,
        name
    });
}

function writeOsmWay(builder, {nodes, $id, tags: {name = $id}, $timestamp}) {
    const points = nodes.map(({$lat, $lon, tags: {name = null}}) => {
        return {
            latitude: $lat,
            longitude: $lon,
            name
        };
    });
    winston.silly(`Adding way ${name}`);
    builder.addTrack({
        name,
        time: $timestamp
    }, [points]);
}

function writeOsmRelation(builder, {members, name}) {
    winston.silly(`Adding relation ${name}`);
    for (const member of _.castArray(members)) {
        switch (member.type) {
            case 'node':
                writeOsmNode(builder, member);
                break;
            case 'way':
                writeOsmWay(builder, member);
                break;
            case 'relation':
                writeOsmRelation(builder, member);
                break;
        }
    }
}

function createGpx(data) {
    const {relationId, name, timestamp} = data,
        builder = new GpxFileBuilder();
    winston.verbose(`Creating GPX for relation ${name}`);
    builder.setFileInfo({
        description: 'Data extracted from OSM',
        name,
        creator: 'OpenStreetMap relation export',
        time: timestamp
    });
    writeOsmRelation(builder, data);
    return {
        relationId,
        name,
        timestamp,
        xml: builder.xml()
    };
}

function getSubRelations({member}, full) {
    const promises = _.chain(member)
        .castArray()
        .filter({$type: 'relation'})
        .map(({$ref}) => full ? getFullRelation($ref) : getRelationTimestamp($ref))
        .value();
    return Promise.all(promises);
}

// function calculateDistance(node1, node2) {
//     var R = 6371e3; // metres
//     var φ1 = lat1.toRadians();
//     var φ2 = lat2.toRadians();
//     var Δφ = (lat2 - lat1).toRadians();
//     var Δλ = (lon2 - lon1).toRadians();
//
//     var a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
//         Math.cos(φ1) * Math.cos(φ2) *
//         Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
//     var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
//
//     var d = R * c;
// }
//
// function findClosestWay(ways, node) {
//     return _.chain(ways)
//         .sortBy(({nodes}) => {
//             const firstNode = nodes[0],
//                 lastNode = nodes[nodes.length - 1];
//
//         })
// }
//
// function sortWays(ways) {
//     const [firstWay, ...rest] = ways;
//     const result = [firstWay];
//     const lastNode = _.last(firstWay.nodes);
//     const nextWay = findClosestWay(rest, lastNode);
// }

function getFullRelation(relationId) {
    winston.verbose(`Getting full relation '${relationId}'`);
    return osmApi.fetchRelation(relationId, true)
        .then(json => {
            const {osm: {relation = [], node = [], way = []}} = json,
                mainRelation = _.chain(relation)
                    .castArray()
                    .find({$id: relationId})
                    .value();
            return getSubRelations(mainRelation, true)
                .then(result => {
                    const nodes = new Map(node.map(({$id, $lat, $lon, tag}) => {
                            return [$id, {
                                $id,
                                type: 'node',
                                $lat,
                                $lon,
                                tags: transformTags(tag)
                            }];
                        })),
                        ways = new Map(way.map(({$id, $timestamp, nd, tag}) => {
                            return [$id, {
                                $id,
                                type: 'way',
                                $timestamp,
                                nodes: nd.map(({$ref}) => {
                                    return nodes.get($ref);
                                }),
                                tags: transformTags(tag)
                            }];
                        })),
                        subRelations = new Map(result.map(subRelation => {
                            const {relationId} = subRelation;
                            return [relationId, subRelation];
                        })),
                        {tag, $timestamp: timestamp, member} = mainRelation,
                        {name = relationId} = transformTags(tag);
                    return {
                        relationId,
                        type: 'relation',
                        name,
                        timestamp,
                        members: member.map(({$type, $ref}) => {
                            switch ($type) {
                                case 'node':
                                    return nodes.get($ref);
                                case 'way':
                                    return ways.get($ref);
                                case 'relation':
                                    return subRelations.get($ref);
                                default:
                                    winston.warn(`Can not handle member of type ${$type}`);
                            }
                        })
                    };
                });
        });
}

function getRelationTimestamp(relationId) {
    winston.verbose(`Getting timestamp for relation '${relationId}'`);
    return osmApi.fetchRelation(relationId, false)
        .then(({osm: {relation}}) => {
            const {$timestamp} = relation;
            return getSubRelations(relation, false)
                .then(result => {
                    return moment.max(...result, moment($timestamp));
                });
        });
}

function getFromCache(relationId) {
    const {timestamp: cachedTimestamp, fileName} = cache.get(relationId) || {};
    if (cachedTimestamp) {
        winston.verbose(`Found ${relationId} in cache, timestamp: ${cachedTimestamp}`);
        return getRelationTimestamp(relationId)
            .then(osmTimestamp => {
                winston.verbose(`Relation ${relationId} osm timestamp: ${osmTimestamp}`);
                if (osmTimestamp.isAfter(cachedTimestamp)) {
                    return Promise.reject(true);
                }

                return fileName;
            });
    } else {
        return Promise.reject(false);
    }
}

function getRelation(visitor, relationId) {
    sendEvent(visitor, 'Get', relationId);
    const start = moment();
    return getFromCache(relationId)
        .then(fileName => {
                sendEvent(visitor, 'Cache hit', relationId);
                return fileName;
            },
            outdated => {
                sendEvent(visitor, outdated ? 'Cache outdated' : 'Cache miss', relationId);
                return getFullRelation(relationId)
                    .then(data => createGpx(data))
                    .then(gpx => cache.put(gpx));
            })
        .then(fileName => {
                const end = moment().diff(start);
                sendTiming(visitor, 'getRelationTime', end);
                return fileName;
            },
            error => {
                const end = moment().diff(start);
                sendTiming(visitor, 'failureTime', end);
                sendEvent(visitor, 'Error', `${relationId} - ${error}`);
                return Promise.reject(error);
            });
}

module.exports = {
    getRelation
};