'use strict';
let _ = require('lodash'),
    moment = require('moment'),
    winston = require('winston'),
    cache = require('./cache'),
    osmApi = require('./osmApi');

function sendEvent(visitor, action, label) {
    winston.info(`${action} - ${label}`);
    visitor.event({
        ec: `OSM2GPX`,
        ea: action,
        el: label,
        aip: true
    }).send();
}

function sendTiming(visitor, variable, time) {
    winston.info(`${variable} - ${time}ms`);
    visitor.timing({
        utc: `OSM2GPX`,
        utv: variable,
        utt: time,
        aip: true
    }).send();
}

function transformTags(tags) {
    return _.transform(tags || [], (result, {$: {k, v}}) => {
        result[k] = v;
    }, {});
}

function buildJson({osm: {relation: [{$: {id, timestamp, member, tag: tags}}], node: nodes, way: ways}}) {
    return {
        nodes: _.chain(nodes)
            .map(({$ : {id, lat, lon}, tag: tags}) => {
                return {
                    id,
                    lat,
                    lon,
                    tags: transformTags(tags)
                };
            })
            .keyBy('id')
            .value(),
        ways: _.chain(ways)
            .map(({$: {id, timestamp}, nd: nodes, tag: tags}) => {
                return {
                    id,
                    timestamp,
                    nd: _.map(nodes, '$.ref'),
                    tags: transformTags(tags)
                };
            })
            .keyBy('id')
            .value(),
        relation: {
            id,
            timestamp,
            members: _.map(member, ({$: {ref, type}}) => {
                return {
                    ref,
                    type
                };
            }),
            tags: transformTags(tags)
        }
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
        const {lat, lon} = nodes[nodeId];
        return {
            latitude: lat,
            longitude: lon
        };
    });
    winston.silly(`Adding way ${name}`);
    builder.addTrack({
        name: name,
        time: timestamp
    }, [points]);
}

function createGpx(json) {
    const GpxFileBuilder = require('gpx').GpxFileBuilder,
        builder = new GpxFileBuilder(),
        relation = json.relation,
        tags = relation.tags,
        name = tags.name || relation.id;
    builder.setFileInfo({
        description: 'Data extracted from OSM',
        name: name,
        creator: 'OpenStreetMap relation export',
        time: relation.timestamp
    });
    for (const member of relation.members) {
        switch (member.type) {
            case 'node':
                writeOsmNode(builder, json.nodes[member.ref]);
                break;
            case 'way':
                writeOsmWay(builder, json.ways[member.ref], json.nodes);
                break;
            default:
                winston.warn(`Can not handle member of type ${member.type}`);
        }
    }

    return {
        relationId: relation.id,
        name,
        timestamp: relation.timestamp,
        xml: builder.xml()
    };
}

function getRelationTimestamp(relationId) {
    winston.verbose(`Getting timestamp for relation '${relationId}'`);
    return osmApi.fetchRelation(relationId, false)
        .then(xmlObj => {
            const {osm: {relation: [{$: {timestamp: t2}}]}} = xmlObj;
            const timestamp = moment(xmlObj.osm.relation[0].$.timestamp);
            winston.verbose(`Result: ${timestamp}`);
            return timestamp;
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
    const cachedData = cache.get(relationId);
    if (cachedData) {
        const {timestamp: cachedTimestamp, fileName} = cachedData;
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
            });
}

module.exports = {
    getRelation: getRelation
};