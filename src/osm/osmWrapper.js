'use strict';

import {fetchNodesInRelation, fetchRelation} from './osmApi.js';
import {getLogger} from '../logger.js';
import osmtogeojson from 'osmtogeojson';

const logger = getLogger('osmWrapper');

export async function getFullRelation(relationId, filter = true) {
  logger.verbose(`Getting full relation '${relationId}'`);
  const osmJson = await fetchRelation(relationId);
  return osmtogeojson(osmJson, {
    uninterestingTags() {
      return filter;
    },
  });
}

export async function getRelationNodes(relationId) {
  logger.verbose(`Getting nodes for relation '${relationId}'`);
  const osmJson = await fetchNodesInRelation(relationId);
  return osmtogeojson(osmJson, {
    uninterestingTags() {
      return true;
    },
  });
}
