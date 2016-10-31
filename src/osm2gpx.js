'use strict';
const GpxFileBuilder = require('gpx').GpxFileBuilder;
const moment = require('moment');
const winston = require('winston');
const cache = require('./cache');
const osmWrapper = require('./osm/osmWrapper');

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

function createGpx(relation, limit) {
    const {relationId, timestamp} = relation;
    const builder = new GpxFileBuilder({
        description: 'Data extracted from OSM',
        name: relationId,
        creator: 'OpenStreetMap relation export',
        time: timestamp
    });
    winston.verbose(`Creating GPX for relation ${relationId}`);
    relation.createGpx(builder, limit);
    return builder.xml();
}

function getFromCache(relationId) {
    const result = cache.get(relationId);
    if (result) {
        const {gpxFileName, cachedTimestamp} = result;
        winston.verbose(`Found ${relationId} in cache, timestamp: ${cachedTimestamp}`);
        return osmWrapper.getRelationTimestamp(relationId)
            .then(osmTimestamp => {
                winston.verbose(`Relation ${relationId} osm timestamp: ${osmTimestamp}`);
                if (osmTimestamp.isAfter(cachedTimestamp)) {
                    return Promise.reject(true);
                }

                return gpxFileName;
            });
    } else {
        return Promise.reject(false);
    }
}

function getRelation(visitor, {relationId, combineWays = "true", segmentLimit = 9000, useCache = "true", markerDiff = 1000}) {
    sendEvent(visitor, 'Get', relationId);
    const start = moment();
    return (useCache === "true" ? getFromCache(relationId) : Promise.reject(false))
        .catch(outdated => {
            sendEvent(visitor, outdated ? 'Cache outdated' : 'Cache miss', relationId);
            return osmWrapper.getFullRelation(relationId)
                .then(relation => {
                    if (combineWays === "true") {
                        relation.combineWays();
                    } else {
                        relation.sortWays();
                    }

                    const distance = relation.calculateDistances(markerDiff);
                    winston.verbose(`Total distance is ${distance}`);
                    const gpx = createGpx(relation, segmentLimit);
                    return cache.put(relation, gpx);
                });
        })
        .then(
            result => {
                const end = moment().diff(start);
                sendTiming(visitor, 'getRelationTime', end);
                return result;
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