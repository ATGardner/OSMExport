import type {
  ExportResult,
  MarkerFeature,
  RelationFeature,
  RelationRequest,
} from './relation.ts';
import {getRelationData, waysOf} from './relation.ts';
import {getLogger} from './logger.ts';
import {BaseBuilder, buildGPX} from 'gpx-builder';
import {observeExportSize} from './metrics.ts';

const {Metadata, Point, Segment, Track} = BaseBuilder.MODELS;
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

  const builder = new BaseBuilder();
  builder.setMetadata(
    new Metadata({
      name,
      desc: 'Data extracted from OSM',
      time: new Date(timestamp),
    }),
  );
  logger.info(`Creating GPX for ${id}`);
  builder.setWayPoints(
    markers.map((mf: MarkerFeature) => {
      const {
        properties: {marker},
        geometry: {
          coordinates: [lon, lat],
        },
      } = mf;
      return new Point(lat, lon, {name: String(marker)});
    }),
  );
  const tracks = waysOf(geometry).flatMap((way, i) => {
    const points = way.map(([lon, lat]) => new Point(lat, lon));
    const segments = limit > 1 ? chunk(points, limit) : [points];
    return segments.map(
      (seg, j) => new Track([new Segment(seg)], {name: `way${i}-seg${j}`}),
    );
  });
  builder.setTracks(tracks);
  const data = builder.toObject();
  return buildGPX({
    ...data,
    attributes: {...data.attributes, creator: 'OpenStreetMap relation export'},
  });
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
