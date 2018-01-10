'use strict';
const {getLogger} = require('../logger');
const osmtogeojson = require('osmtogeojson');
const {fetchRelation, fetchNodesInRelation} = require('./osmApi');

const logger = getLogger('osmWrapper');

async function getFullRelation(relationId) {
  logger.verbose(`Getting full relation '${relationId}'`);
  const osmJson = await fetchRelation(relationId);
  return osmtogeojson(osmJson, {
    uninterestingTags() {
      return true;
    },
  });
}

async function getRelationNodes(relationId) {
  logger.verbose(`Getting nodes for relation '${relationId}'`);
  const osmJson = await fetchNodesInRelation(relationId);
  return osmtogeojson(osmJson, {
    uninterestingTags() {
      return true;
    },
  });
}

module.exports = {
  getFullRelation,
  getRelationNodes,
};
