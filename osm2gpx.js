'use strict';
let _ = require('lodash');

function fetchRelation(relationId) {
    let fetch = require('node-fetch');
    let url = `http://api.openstreetmap.org/api/0.6/relation/${relationId}/full`;
    console.log(`Getting relation ${relationId}`);
    return fetch(url)
        .then(response => response.text());
}

function parseData(xml) {
    let parseString = require('xml2js').parseString;
    console.log('Done getting relation');
    return new Promise((resolve, reject) => parseString(xml, (err, result) => {
        if (err) {
            console.error(`Failed getting relation, err: ${err}`);
            reject(err);
        } else {
            resolve(result);
        }
    }));
}

function transformTags(tags) {
    return _.transform(tags, (result, t) => {
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
                    lon: $.lon
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
        longitude: node.lon
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
    let GpxFileBuilder = require('gpx').GpxFileBuilder;
    let builder = new GpxFileBuilder();
    let relation = json.relation;
    let tags = relation.tags;
    builder.setFileInfo({
        description: 'Data extracted from OSM',
        name: tags.name || relation.id,
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

    return builder.xml();
}

function getRelation(relationId) {
    try {
        return fetchRelation(relationId)
            .then(parseData)
            .then(buildJson)
            .then(createGpx);
    } catch (e) {
        console.error(e);
    }
}

module.exports = getRelation;