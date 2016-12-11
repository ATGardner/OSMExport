'use strict';
const moment = require('moment');
const winston = require('winston');
const osmApi = require('./osmApi');
const Node = require('./Node');
const Relation = require('./Relation');

function getSubRelations({subRelationIds}) {
    const promises = subRelationIds.map(getFullRelation);
    return Promise.all(promises);
}

function getFullRelation(relationId) {
    winston.verbose(`Getting full relation '${relationId}'`);
    return osmApi.fetchRelation(relationId, true)
        .then(({elements}) => {
            const relations = elements.filter(e => e.type === 'relation');
            const ways = elements.filter(e => e.type === 'way');
            const nodes = elements.filter(e => e.type === 'node');
            const relation = new Relation(relations, ways, nodes);
            return getSubRelations(relation)
                .then(subRelations => {
                    relation.subRelations = subRelations;
                    return relation;
                });
        });
}

function getWater(relationId) {
    winston.verbose(`Getting relation water for ${relationId}`);
    return osmApi.fetchWater(relationId, 1000)
        .then(({elements}) => {
            return elements.map(e => new Node(e));
        });
}

module.exports = {
    getFullRelation,
    getWater
};