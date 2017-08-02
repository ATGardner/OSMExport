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

async function getFullRelation(relationId) {
  winston.verbose(`Getting full relation '${relationId}'`);
  const {elements} = await osmApi.fetchRelation(relationId, true);
  const relations = elements.filter(e => e.type === 'relation');
  const ways = elements.filter(e => e.type === 'way');
  const nodes = elements.filter(e => e.type === 'node');
  const relation = new Relation(relations, ways, nodes);
  relation.subRelations = await getSubRelations(relation);
  return relation;
}

async function getWater(relationId) {
  winston.verbose(`Getting relation water for ${relationId}`);
  const {elements} = await osmApi.fetchWater(relationId, 1000);
  return elements.map(e => new Node(e));
}

module.exports = {
  getFullRelation,
  getWater
};