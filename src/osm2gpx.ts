import type {
  ExportResult,
  MarkerFeature,
  RelationFeature,
  RelationRequest,
} from './relation.ts';
import {getRelationData, waysOf} from './relation.ts';
import _ from 'lodash';
import {getLogger} from './logger.ts';
import gpx from 'gpx';
import {observeExportSize} from './metrics.ts';

const logger = getLogger('osm2gpx');

function createGpx(
  relation: RelationFeature,
  markers: MarkerFeature[],
  limit: number,
): string {
  const {
    id,
    geometry,
    properties: {name, timestamp},
  } = relation;
  const builder = new gpx.GpxFileBuilder({
    description: 'Data extracted from OSM',
    name,
    creator: 'OpenStreetMap relation export',
    time: timestamp,
  });
  logger.info(`Creating GPX for ${id}`);
  markers.forEach((markerFeature) => {
    const {
      properties: {marker},
      geometry: {
        coordinates: [longitude, latitude],
      },
    } = markerFeature;
    builder.addWayPoints({
      latitude,
      longitude,
      name: String(marker),
    });
  });
  waysOf(geometry).forEach((way, i) => {
    const pointData = way.map(([longitude, latitude]) => ({
      latitude,
      longitude,
    }));
    const segments = limit > 1 ? _.chunk(pointData, limit) : [pointData];
    segments.forEach((segment, j) => {
      builder.addTrack(
        {
          name: `way${i}-seg${j}`,
          time: timestamp,
        },
        segment,
      );
    });
  });
  return builder.xml();
}

export async function getRelationGpx(
  request: RelationRequest,
): Promise<ExportResult> {
  const {segmentLimit = 0} = request;
  const {relation, markers, baseFileName} = await getRelationData(request);
  // Not named `gpx`; that would shadow the builder module imported above.
  const gpxXml = createGpx(relation, markers, segmentLimit);
  observeExportSize('gpx', gpxXml);
  return {
    fileName: `${baseFileName}.gpx`,
    contentType: 'application/xml',
    body: gpxXml,
  };
}
