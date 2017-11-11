'use strict';
const winston = require('winston');
const osmApi = require('./osmApi');

function getFullRelation(relationId) {
  winston.verbose(`Getting full relation '${relationId}'`);
  return osmApi.fetchRelation(relationId, true);
}

module.exports = {
  getFullRelation,
};
