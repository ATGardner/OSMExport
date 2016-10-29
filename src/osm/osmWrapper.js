'use strict';
const moment = require('moment');
const winston = require('winston');
const osmApi = require('./osmApi');
const Relation = require('./Relation');

function getRelationTimestamp(relationId) {
    winston.verbose(`Getting timestamp for relation '${relationId}'`);
    return osmApi.fetchRelation(relationId, false)
        .then(({osm}) => {
            const relation = new Relation(osm);
            return getSubRelations(relation, false)
                .then(result => {
                    return moment.max(...result, relation.timestamp);
                });
        });
}

function getSubRelations(relation, full) {
    const promises = relation.subRelationIds.map(id => full ? getFullRelation(id) : getRelationTimestamp(id));
    return Promise.all(promises);
}

function getFullRelation(relationId) {
    winston.verbose(`Getting full relation '${relationId}'`);
    return osmApi.fetchRelation(relationId, true)
        .then(({osm}) => {
            const relation = new Relation(osm);
            return getSubRelations(relation, true)
                .then(subRelations => {
                    relation.subRelations = subRelations;
                    return relation;
                });
        });
}

module.exports = {
    getFullRelation,
    getRelationTimestamp
};