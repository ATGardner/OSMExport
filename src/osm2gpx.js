'use strict';
const _ = require('lodash');
const GpxFileBuilder = require('gpx').GpxFileBuilder;
const moment = require('moment');
const winston = require('winston');
const cache = require('./cache');
const osmApi = require('./osmApi');
const utils = require('./utils');

function sendEvent(visitor, action, label) {
    winston.info(`${action} - ${label}`);
    if (visitor) {
        visitor.event({
            ec: 'OSM2GPXv4',
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
            utc: 'OSM2GPXv4',
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

function createGpx(relation/*, name*/) {
    const {relationId, timestamp, tags: {name}} = relation;
    const builder = new GpxFileBuilder();
    winston.verbose(`Creating GPX for relation ${name}`);
    builder.setFileInfo({
        description: 'Data extracted from OSM',
        name,
        creator: 'OpenStreetMap relation export',
        time: timestamp
    });
    writeOsmRelation(builder, relation);
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
        .then(({osm: {relation = [], node = [], way = []}}) => {
            const mainRelation = _.chain(relation)
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
                    }));
                    const ways = new Map(way.map(({$id, $timestamp, nd, tag}) => {
                        return [$id, {
                            $id,
                            type: 'way',
                            $timestamp,
                            nodes: nd.map(({$ref}) => {
                                return nodes.get($ref);
                            }),
                            tags: transformTags(tag)
                        }];
                    }));
                    const subRelations = new Map(result.map(subRelation => {
                        const {relationId} = subRelation;
                        return [relationId, subRelation];
                    }));
                    const {tag, $timestamp: timestamp, member} = mainRelation;
                    const tags = transformTags(tag);
                    const relation = {
                        relationId,
                        type: 'relation',
                        tags,
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
                    return relation;
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

function getRelation(visitor, {relationId/*, nameKey = 'name', name*/, joinWays = true}) {
    sendEvent(visitor, 'Get', relationId);
    const start = moment();
    return getFromCache(relationId)
        .catch(outdated => {
            sendEvent(visitor, outdated ? 'Cache outdated' : 'Cache miss', relationId);
            return getFullRelation(relationId)
                .then(relation => {
                    if (joinWays) {
                        utils.joinWays(relation);
                    }

                    return createGpx(relation/*, name || relation.tags[nameKey] || relationId*/);
                })
                .then(gpx => cache.put(gpx));
        })
        .then(
            fileName => {
                const end = moment().diff(start);
                sendTiming(visitor, 'getRelationTime', end);
                return fileName;
            },
            error => {
                const end = moment().diff(start);
                sendTiming(visitor, 'failureTime', end);
                sendEvent(visitor, 'Error', `${relationId} - ${error}`);
                return Promise.reject(error);
            }
        );
}

module.exports = {
    getRelation
};