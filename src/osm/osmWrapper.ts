import { fetchNodesInRelation, fetchRelation } from './osmApi.ts';
import { getLogger } from '../logger.ts';
import osmtogeojson from 'osmtogeojson';
import type { FeatureCollection, GeometryObject } from 'geojson';

const logger = getLogger('osmWrapper');

export async function getFullRelation(relationId: string, filter = true): Promise<FeatureCollection<GeometryObject>> {
  logger.verbose(`Getting full relation '${relationId}'`);
  const osmJson = await fetchRelation(relationId);
  return osmtogeojson(osmJson, {
    uninterestingTags() {
      return filter;
    },
  });
}

export async function getRelationNodes(relationId: string): Promise<FeatureCollection<GeometryObject>> {
  logger.verbose(`Getting nodes for relation '${relationId}'`);
  const osmJson = await fetchNodesInRelation(relationId);
  return osmtogeojson(osmJson, {
    uninterestingTags() {
      return true;
    },
  });
}
