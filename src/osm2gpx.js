'use strict';
let _ = require('lodash'),
    GpxFileBuilder = require('gpx').GpxFileBuilder,
    moment = require('moment'),
    winston = require('winston'),
    cache = require('./cache'),
    osmApi = require('./osmApi');

function sendEvent(visitor, action, label) {
    winston.info(`${action} - ${label}`);
    if (visitor) {
        visitor.event({
            ec: `OSM2GPXv2`,
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
            utc: `OSM2GPXv2`,
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

function buildJson({osm: {relation: {$id, $timestamp, member, tag: tags}, node, way}}) {
    const nodes = new Map(_.map(node, ({$id, $lat, $lon, tag: tags}) => {
            return [$id, {
                id: $id,
                lat: $lat,
                lon: $lon,
                tags: transformTags(tags)
            }];
        })),
        ways = new Map(_.map(way, ({$id, $timestamp, nd: nodes, tag: tags}) => {
            return [$id, {
                id: $id,
                timestamp: $timestamp,
                nd: _.map(nodes, '$ref'),
                tags: transformTags(tags)
            }];
        })),
        relation = {
            id: $id,
            timestamp: $timestamp,
            members: _.map(member, ({$ref, $type}) => {
                return {
                    ref: $ref,
                    type: $type
                };
            }),
            tags: transformTags(tags)
        };
    return {
        nodes,
        ways,
        relation
    };
}

function writeOsmNode(builder, {id, lat, lon, tags: {name}}) {
    winston.silly(`Adding node ${id}`);
    builder.addWayPoints({
        latitude: lat,
        longitude: lon,
        name
    });
}

function writeOsmWay(builder, {nd, id, tags: {name = id}, timestamp}, nodes) {
    const points = _.map(nd, nodeId => {
        const {lat, lon} = nodes.get(nodeId);
        return {
            latitude: lat,
            longitude: lon
        };
    });
    winston.silly(`Adding way ${name}`);
    builder.addTrack({
        name,
        time: timestamp
    }, [points]);
}

function createGpx({relation: {id, tags: {name = id}, timestamp, members}, nodes, ways}) {
    const builder = new GpxFileBuilder();
    builder.setFileInfo({
        description: 'Data extracted from OSM',
        name,
        creator: 'OpenStreetMap relation export',
        time: timestamp
    });
    for (const {type, ref} of members) {
        switch (type) {
            case 'node':
                writeOsmNode(builder, nodes.get(ref));
                break;
            case 'way':
                writeOsmWay(builder, ways.get(ref), nodes);
                break;
            default:
                winston.warn(`Can not handle member of type ${type}`);
        }
    }

    return {
        relationId: id,
        name,
        timestamp,
        xml: builder.xml()
    };
}

function getRelationTimestamp(relationId) {
    winston.verbose(`Getting timestamp for relation '${relationId}'`);
    return osmApi.fetchRelation(relationId, false)
        .then(({osm: {relation: {$timestamp}}}) => {
            winston.verbose(`Result: ${$timestamp}`);
            return moment($timestamp);
        });
}

function getFullRelation(relationId) {
    winston.verbose(`Getting full relation '${relationId}'`);
    return osmApi.fetchRelation(relationId, true)
        .then(xmlObj => {
            winston.verbose(`Building JSON from result, relationId: ${relationId}`);
            const json = buildJson(xmlObj);
            winston.verbose(`Creating gpx from JSON, relationId: ${relationId}`);
            return createGpx(json);
        });
}

function getFromCache(relationId) {
    const {timestamp: cachedTimestamp, fileName} = cache.get(relationId) || {};
    if (cachedTimestamp) {
        winston.verbose(`Found ${relationId} in cache, timestamp: ${cachedTimestamp}`);
        return getRelationTimestamp(relationId)
            .then(osmTimestamp => {
                if (osmTimestamp.isAfter(cachedTimestamp)) {
                    return Promise.reject();
                }

                return fileName;
            });
    } else {
        return Promise.reject();
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
            () => {
                sendEvent(visitor, 'Cache miss', relationId);
                return getFullRelation(relationId)
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