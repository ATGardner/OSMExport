import LatLon from 'geodesy/latlon-ellipsoidal-vincenty.js';
import type {
  Feature,
  LineString,
  MultiLineString,
  Point,
  Position,
} from 'geojson';
import moment from 'moment';
import {BadRequestError} from './errors.ts';
import {getLogger} from './logger.ts';
import {observeRelationPoints} from './metrics.ts';
import {getFullRelation} from './osm/osmWrapper.ts';

const logger = getLogger('relation');

type RelationProps = {
  name: string;
  'name:en'?: string;
  timestamp: string;
};

export type RelationFeature = Feature<
  LineString | MultiLineString,
  RelationProps
>;

export type MarkerFeature = Feature<Point, {marker: number}>;

export interface RelationRequest {
  relationId: number;
  segmentLimit?: number;
  markerDiff?: number;
  reverse?: boolean;
}

/*
 * Everything the format modules need, and nothing format specific: fetching
 * the relation and walking it for markers costs an Overpass round trip plus a
 * Vincenty solution per point, so it happens once here rather than once per
 * output format.
 */
export interface RelationData {
  relation: RelationFeature;
  markers: MarkerFeature[];
  /*
   * The English name where the relation carries one, since that is what the
   * download is named after and `name` is often only in the local script.
   */
  name: string;
  timestamp: string;
  // Extension-less; each format module appends its own.
  baseFileName: string;
}

export interface ExportResult {
  fileName: string;
  contentType: string;
  body: string | Buffer;
}

export type RelationExporter = (
  request: RelationRequest,
) => Promise<ExportResult>;

function parseRelationId(value: unknown): number {
  const parsed =
    typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : NaN;
  if (!Number.isSafeInteger(parsed)) {
    throw new BadRequestError('"relationId" must be a numeric OSM relation id');
  }

  return parsed;
}

function parseNonNegativeNumber(value: unknown, name: string): number {
  const parsed =
    typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN;
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new BadRequestError(`"${name}" must be a non-negative number`);
  }

  return parsed;
}

function parseBoolean(value: unknown, name: string): boolean {
  if (value === '1' || value === 'true') {
    return true;
  }

  if (value === '0' || value === 'false') {
    return false;
  }

  throw new BadRequestError(`"${name}" must be "0", "1", "true" or "false"`);
}

/*
 * Narrows an untrusted query string object into a `RelationRequest`. Absent
 * optional params are left off so the exporters keep owning their defaults.
 * `segmentLimit` is accepted on every route even though only GPX honours it,
 * so that a bookmarked URL keeps working when the format after `/osm2` is
 * swapped.
 */
export function parseRelationRequest(
  query: Record<string, unknown>,
): RelationRequest {
  const request: RelationRequest = {
    relationId: parseRelationId(query.relationId),
  };
  if (typeof query.segmentLimit !== 'undefined') {
    request.segmentLimit = parseNonNegativeNumber(
      query.segmentLimit,
      'segmentLimit',
    );
  }

  if (typeof query.markerDiff !== 'undefined') {
    request.markerDiff = parseNonNegativeNumber(query.markerDiff, 'markerDiff');
  }

  if (typeof query.reverse !== 'undefined') {
    request.reverse = parseBoolean(query.reverse, 'reverse');
  }

  return request;
}

export function waysOf(geometry: LineString | MultiLineString): Position[][] {
  return geometry.type === 'LineString'
    ? [geometry.coordinates]
    : geometry.coordinates;
}

function createMarkerFeature(
  lat: number,
  lon: number,
  marker: number,
): MarkerFeature {
  logger.verbose(`Creating marker, (${lat}, ${lon}) - ${marker}`);
  return {
    type: 'Feature',
    properties: {
      marker,
    },
    geometry: {
      type: 'Point',
      coordinates: [lon, lat],
    },
  };
}

function addMarkers(
  relation: RelationFeature,
  markerDiff: number,
): MarkerFeature[] {
  const markers: MarkerFeature[] = [];
  let prevDistance = 0;
  let prevMarker = 0;
  let prevLatLon: LatLon | null = null;
  waysOf(relation.geometry).forEach((way) => {
    way.forEach(([lon, lat]) => {
      if (prevLatLon) {
        const latLon = new LatLon(lat, lon);
        const distance = prevDistance + prevLatLon.distanceTo(latLon);
        const marker = Math.floor(distance / markerDiff);
        if (prevMarker < marker) {
          const distanceToNextMarker = marker * markerDiff - prevDistance;
          const bearing = prevLatLon.initialBearingTo(latLon);
          const {lat: markerLat, lon: markerLon} = prevLatLon.destinationPoint(
            distanceToNextMarker,
            bearing,
          );
          markers.push(createMarkerFeature(markerLat, markerLon, marker));
          prevMarker = marker;
        }

        prevDistance = distance;
        prevLatLon = latLon;
      } else {
        markers.push(createMarkerFeature(lat, lon, 0));
        prevLatLon = new LatLon(lat, lon);
      }
    });
  });
  return markers;
}

export async function getRelationData(
  request: RelationRequest,
): Promise<RelationData> {
  const {relationId, markerDiff = 1000, reverse} = request;
  const geoJson = await getFullRelation(relationId);
  const relation = geoJson.features.find(
    (f): f is RelationFeature =>
      typeof f.id === 'string' && f.id.startsWith('relation'),
  );
  if (!relation) {
    throw new Error(`No relation feature found for ${relationId}`);
  }

  if (reverse) {
    relation.geometry.coordinates.reverse();
  }

  /*
   * Point count is the input size that actually drives how long the rest of
   * this takes — `addMarkers` runs a Vincenty solution per point — so it is
   * what makes a slow export explainable rather than just slow.
   */
  observeRelationPoints(
    waysOf(relation.geometry).reduce((total, way) => total + way.length, 0),
  );
  const markers = addMarkers(relation, markerDiff);
  const {
    properties: {name, 'name:en': nameEn = name, timestamp},
  } = relation;
  return {
    relation,
    markers,
    name: nameEn,
    timestamp,
    baseFileName: `${nameEn}-${moment(timestamp).format('YY-MM-DD')}`,
  };
}
