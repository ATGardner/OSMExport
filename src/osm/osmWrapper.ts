import type {FeatureCollection, GeometryObject} from 'geojson';
import {fetchNodesInRelation, fetchRelation} from './osmApi.ts';
import {getLogger} from '../logger.ts';
import osmtogeojson from 'osmtogeojson';

const logger = getLogger('osmWrapper');

export async function getFullRelation(
  relationId: number,
  filter = true,
): Promise<FeatureCollection<GeometryObject>> {
  logger.verbose(`Getting full relation '${relationId}'`);
  const osmJson = await fetchRelation(relationId);
  return osmtogeojson(osmJson, {
    uninterestingTags() {
      return filter;
    },
  });
}

export async function getRelationNodes(
  relationId: number,
): Promise<FeatureCollection<GeometryObject>> {
  logger.verbose(`Getting nodes for relation '${relationId}'`);
  const osmJson = await fetchNodesInRelation(relationId);
  return osmtogeojson(osmJson, {
    uninterestingTags() {
      return true;
    },
  });
}
