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

function writeOsmWay(builder, {nodes, $id, tags: {name = $id}, $timestamp}, nodeMap) {
    const points = _.map(nodes, nodeId => {
        const {$lat, $lon, tags: {name = null}} = nodeMap.get(nodeId);
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

function writeOsmRelation(builder, {relation: {members, name}, nodes, ways, subRelations}) {
    winston.silly(`Adding relation ${name}`);
    for (const {$type, $ref} of _.castArray(members)) {
        switch ($type) {
            case 'node':
                writeOsmNode(builder, nodes.get($ref));
                break;
            case 'way':
                writeOsmWay(builder, ways.get($ref), nodes);
                break;
            case 'relation':
                writeOsmRelation(builder, subRelations.get($ref));
                break;
            default:
                winston.warn(`Can not handle member of type ${$type}`);
        }
    }
}

function createGpx(data) {
    const {relation: {relationId, name, timestamp}} = data,
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

function getFullRelation(relationId) {
    winston.verbose(`Getting full relation '${relationId}'`);
    return osmApi.fetchRelation(relationId, true)
        .then(json => {
            const {osm: {relation, node, way}} = json,
                mainRelation = _.chain(relation)
                    .castArray()
                    .find({$id: relationId})
                    .value();
            return getSubRelations(mainRelation, true)
                .then(result => {
                    const nodes = new Map(_.map(node, ({$id, $lat, $lon, tag}) => {
                            return [$id, {
                                $id,
                                $lat,
                                $lon,
                                tags: transformTags(tag)
                            }];
                        })),
                        ways = new Map(_.map(way, ({$id, $timestamp, nd, tag}) => {
                            return [$id, {
                                $id,
                                $timestamp,
                                nodes: _.map(nd, '$ref'),
                                tags: transformTags(tag)
                            }];
                        })),
                        subRelations = new Map(_.map(result, (subRelation) => {
                            const {relation: {relationId}} = subRelation;
                            return [relationId, subRelation];
                        })),
                        {tag, $timestamp: timestamp, member: members} = mainRelation,
                        {name = relationId} = transformTags(tag);
                    return {
                        relation: {
                            relationId,
                            name,
                            timestamp,
                            members
                        },
                        nodes,
                        ways,
                        subRelations
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