'use strict';
let _ = require('lodash'),
    moment = require('moment'),
    cache = require('./cache'),
    osmApi = require('./osmApi');

function sendEvent(visitor, action, label) {
    visitor.event({
        ec: `OSM2GPX`,
        ea: action,
        el: label,
        aip: true
    }).send();
}

function sendTiming(visitor, variable, time) {
    visitor.timing({
        utc: `OSM2GPX`,
        utv: variable,
        utt: time,
        aip: true
    }).send();
}

function transformTags(tags) {
    return _.transform(tags || [], (result, t) => {
        result[t.$.k] = t.$.v;
    }, {});
}

function buildJson(xmlObj) {
    let osm = xmlObj.osm,
        relation = osm.relation[0];
    console.log('Building JSON from result');
    return {
        nodes: _.chain(osm.node)
            .map(n => {
                let $ = n.$;
                return {
                    id: $.id,
                    lat: $.lat,
                    lon: $.lon,
                    tags: transformTags(n.tag)
                };
            })
            .keyBy('id')
            .value(),
        ways: _.chain(osm.way)
            .map(w => {
                return {
                    id: w.$.id,
                    timestamp: w.$.timestamp,
                    nd: _.map(w.nd, '$.ref'),
                    tags: transformTags(w.tag)
                };
            })
            .keyBy('id')
            .value(),
        relation: {
            id: relation.$.id,
            timestamp: relation.$.timestamp,
            members: _.map(relation.member, m => {
                return _.pick(m.$, ['ref', 'type']);
            }),
            tags: transformTags(relation.tag)
        }
    };
}

function writeOsmNode(builder, node) {
    console.log(`Adding node ${node.id}`);
    builder.addWayPoints({
        latitude: node.lat,
        longitude: node.lon,
        name: node.tags.name
    });
}

function writeOsmWay(builder, way, nodes) {
    let points = _.map(way.nd, nodeId => {
        let node = nodes[nodeId];
        return {
            latitude: node.lat,
            longitude: node.lon
        };
    });
    console.log(`Adding way ${way.tags.name || way.id}`);
    builder.addTrack({
        name: way.tags.name || way.id,
        time: way.timestamp
    }, [points]);
}

function createGpx(json) {
    let GpxFileBuilder = require('gpx').GpxFileBuilder,
        builder = new GpxFileBuilder(),
        relation = json.relation,
        tags = relation.tags,
        name = tags.name || relation.id;
    console.log('Creating gpx from JSON');
    builder.setFileInfo({
        description: 'Data extracted from OSM',
        name: name,
        creator: 'OpenStreetMap relation export',
        time: relation.timestamp
    });
    for (let member of relation.members) {
        switch (member.type) {
            case 'node':
                writeOsmNode(builder, json.nodes[member.ref]);
                break;
            case 'way':
                writeOsmWay(builder, json.ways[member.ref], json.nodes);
                break;
            default:
                console.error(`Can not handle member of type ${member.type}`);
        }
    }

    return {
        relationId: relation.id,
        name: name,
        timestamp: relation.timestamp,
        xml: builder.xml()
    };
}

function getRelationTimestamp(relationId) {
    console.log(`Getting timestamp for relation '${relationId}'`)
    return osmApi.fetchRelation(relationId, false)
        .then(xmlObj => {
            let timestamp = moment(xmlObj.osm.relation[0].$.timestamp);
            console.log(`Result: ${timestamp}`);
            return timestamp;
        });
}

function getFullRelation(relationId) {
    console.log(`Getting full relation '${relationId}'`);
    return osmApi.fetchRelation(relationId, true)
        .then(xmlObj => {
            let json = buildJson(xmlObj);
            return createGpx(json);
        });
}

function getFromCache(relationId) {
    const cacheData = cache.get(relationId);
    if (cacheData) {
        return getRelationTimestamp(relationId)
            .then(osmTimestamp => {
                if (osmTimestamp.isAfter(cacheData.timestamp)) {
                    return Promise.reject();
                }

                return cacheData.fileName;
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