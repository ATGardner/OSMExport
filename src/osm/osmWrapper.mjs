'use strict';

import osmtogeojson from 'osmtogeojson';
import {getLogger} from '../logger.mjs';
import {fetchNodesInRelation, fetchRelation} from './osmApi.mjs';

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
