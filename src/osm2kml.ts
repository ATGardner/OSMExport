import type {
  ExportResult,
  MarkerFeature,
  RelationFeature,
  RelationRequest,
} from './relation.ts';
import type {Feature, LineString, MultiLineString, Point} from 'geojson';
import {ZipFile} from 'yazl';
import {foldersToKML} from '@placemarkio/tokml';
import {getLogger} from './logger.ts';
import {getRelationData} from './relation.ts';
import {observeExportSize} from './metrics.ts';

const logger = getLogger('osm2kml');

/*
 * `tokml` emits the bare `<kml>` element. Google Earth opens that happily, but
 * the declaration is what tells every other consumer the bytes are UTF-8, and
 * relation names routinely are not ASCII.
 */
const XML_DECLARATION = '<?xml version="1.0" encoding="UTF-8"?>\n';

/*
 * KMZ is a zip whose entry point is a KML at the archive root. `doc.kml` is
 * the conventional name, and Google Earth looks for a root-level `.kml`.
 */
const KMZ_ENTRY = 'doc.kml';

type TrailFeature = Feature<
  LineString | MultiLineString,
  {name: string; description: string; timestamp: string}
>;

type KmlMarkerFeature = Feature<Point, {name: string}>;

/*
 * One Placemark for the whole relation rather than the per-way, per-segment
 * split `createGpx` does: that split exists to stay under GPX consumers' track
 * point limits, and Google Earth has no equivalent limit. A single placemark
 * is also what makes the trail one clickable item in the sidebar instead of
 * dozens. A `MultiLineString` relation becomes a `MultiGeometry`, so gaps in
 * the relation still render as gaps.
 */
function createTrailFeature(
  relation: RelationFeature,
  name: string,
): TrailFeature {
  const {
    geometry,
    properties: {timestamp},
  } = relation;
  /*
   * Rebuilt rather than passed through, because `tokml` turns a feature `id`
   * into the Placemark's `id` attribute and osmtogeojson's ids look like
   * `relation/282071` — not a valid XML name. Anything left in `properties`
   * lands in `<ExtendedData>`, so only what is worth showing goes in.
   */
  return {
    type: 'Feature',
    properties: {
      name,
      description: 'Data extracted from OSM',
      timestamp,
    },
    geometry,
  };
}

function createKml(
  relation: RelationFeature,
  markers: MarkerFeature[],
  name: string,
): string {
  logger.info(`Creating KML for ${relation.id}`);
  const markerFeatures: KmlMarkerFeature[] = markers.map(
    ({properties: {marker}, geometry}) => ({
      type: 'Feature',
      // `name` is the only property `tokml` renders as the placemark's label.
      properties: {name: String(marker)},
      geometry,
    }),
  );
  /*
   * Markers go in their own folder so they can be toggled off in one click;
   * a 1,000km trail at the default 1km spacing is otherwise a sidebar of a
   * thousand numbered pins sitting next to the trail itself.
   */
  const markerFolders = markerFeatures.length
    ? [
        {
          type: 'folder',
          meta: {name: 'Markers'},
          children: markerFeatures,
        },
      ]
    : [];
  return (
    XML_DECLARATION +
    foldersToKML({
      type: 'root',
      children: [createTrailFeature(relation, name), ...markerFolders],
    })
  );
}

/*
 * Yazl streams, and every caller here wants one buffer to hand to `res.send`
 * or `writeFileSync`, so the stream is collected rather than plumbed through.
 * A KMZ holds a single already-in-memory KML, so there is nothing to gain by
 * streaming it and a chunked response would lose the `Content-Length`.
 */
function zipKml(kml: string, timestamp: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const zipFile = new ZipFile();
    const chunks: Buffer[] = [];
    zipFile.outputStream.on('data', (chunk: Buffer) => chunks.push(chunk));
    zipFile.outputStream.on('error', reject);
    zipFile.outputStream.on('end', () => resolve(Buffer.concat(chunks)));
    /*
     * The relation's own timestamp, not `Date.now()`, so re-exporting an
     * unchanged relation produces byte-identical output.
     */
    zipFile.addBuffer(Buffer.from(kml, 'utf8'), KMZ_ENTRY, {
      mtime: new Date(timestamp),
    });
    zipFile.end();
  });
}

export async function getRelationKml(
  request: RelationRequest,
): Promise<ExportResult> {
  const {relation, markers, name, baseFileName} =
    await getRelationData(request);
  const kml = createKml(relation, markers, name);
  observeExportSize('kml', kml);
  return {
    fileName: `${baseFileName}.kml`,
    contentType: 'application/vnd.google-earth.kml+xml',
    body: kml,
  };
}

export async function getRelationKmz(
  request: RelationRequest,
): Promise<ExportResult> {
  const {relation, markers, name, timestamp, baseFileName} =
    await getRelationData(request);
  const kmz = await zipKml(createKml(relation, markers, name), timestamp);
  observeExportSize('kmz', kmz);
  return {
    fileName: `${baseFileName}.kmz`,
    contentType: 'application/vnd.google-earth.kmz',
    body: kmz,
  };
}
