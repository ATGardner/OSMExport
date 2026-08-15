import type {FeatureCollection, GeometryObject} from 'geojson';
import osmtogeojson from 'osmtogeojson';
import {getLogger} from '../logger.ts';
import {fetchRelation} from './osmApi.ts';

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
