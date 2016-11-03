'use strict';
const GpxFileBuilder = require('gpx').GpxFileBuilder;
const winston = require('winston');
const osmWrapper = require('./osm/osmWrapper');

function createGpx(relation, name, limit) {
    const {id, timestamp} = relation;
    const builder = new GpxFileBuilder({
        description: 'Data extracted from OSM',
        name,
        creator: 'OpenStreetMap relation export',
        time: timestamp
    });
    winston.verbose(`Creating GPX for relation ${id}`);
    relation.createGpx(builder, limit);
    return builder.xml();
}

function getRelation({relationId, combineWays = 1, segmentLimit = 9000, markerDiff = 1000, name, nameKey}) {
    return osmWrapper.getFullRelation(relationId)
        .then(relation => {
            if (combineWays === 1) {
                relation.combineWays();
            } else {
                relation.sortWays();
            }

            relation.calculateDistances(markerDiff);
            name = name || relation.getName(nameKey);
            const timestamp = relation.timestamp.format('YY-MM-DD');
            const fileName = `${name}-${timestamp}.gpx`;
            const gpx = createGpx(relation, name, segmentLimit);
            return {
                fileName,
                gpx
            };
        });
}

module.exports = {
    getRelation
};