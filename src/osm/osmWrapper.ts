import type {FeatureCollection, GeometryObject} from 'geojson';
import osm2geojson from 'osm2geojson-lite';
import {getLogger} from '../logger.ts';
import {fetchRelation} from './osmApi.ts';

const logger = getLogger('osmWrapper');

export async function getFullRelation(
  relationId: number,
  filter = true,
): Promise<FeatureCollection<GeometryObject>> {
  logger.verbose(`Getting full relation '${relationId}'`);
  const osmJson = await fetchRelation(relationId);
  /*
   * `completeFeature` is what makes this a FeatureCollection the caller can
   * look the `relation/N` feature up in, rather than a bare geometry.
   *
   * Filtering then means keeping only the relation, since the member ways
   * carry nothing the export reads — the same result osmtogeojson's
   * `uninterestingTags: () => true` produced. Unfiltered, `renderTagged` plus
   * `excludeWay: false` add the tagged member ways back as their own features.
   */
  return osm2geojson(
    osmJson,
    filter
      ? {completeFeature: true}
      : {completeFeature: true, renderTagged: true, excludeWay: false},
  );
}
