import type {
  ExportResult,
  MarkerFeature,
  RelationFeature,
  RelationRequest,
} from './relation.ts';
import {getRelationData, waysOf} from './relation.ts';
import {getLogger} from './logger.ts';
import gpx from 'gpx';
import {observeExportSize} from './metrics.ts';

const logger = getLogger('osm2gpx');

/*
 * `size` is assumed greater than one, which the only call site checks before
 * calling: a size of zero would not terminate, and lodash's `chunk` — which
 * this replaces — answered that case with an empty array, silently dropping
 * the track.
 */
function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let start = 0; start < items.length; start += size) {
    chunks.push(items.slice(start, start + size));
  }

  return chunks;
}

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
    const segments = limit > 1 ? chunk(pointData, limit) : [pointData];
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
