import type {
  Feature,
  LineString,
  MultiLineString,
  Point,
  Position,
} from 'geojson';
import LatLon from 'geodesy/latlon-ellipsoidal-vincenty.js';
import _ from 'lodash';
import {getFullRelation} from './osm/osmWrapper.ts';
import {getLogger} from './logger.ts';
import gpx from 'gpx';
import moment from 'moment';

const logger = getLogger('osm2gpx');

type RelationProps = {
  name: string;
  'name:en'?: string;
  timestamp: string;
};

type RelationFeature = Feature<LineString | MultiLineString, RelationProps>;

type MarkerFeature = Feature<Point, {marker: number}>;

export interface RelationRequest {
  relationId: number;
  segmentLimit?: number;
  markerDiff?: number;
  reverse?: boolean;
}

export interface RelationResponse {
  fileName: string;
  gpx: string;
}

export class BadRequestError extends Error {
  name = 'BadRequestError';
}

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
 * optional params are left off so `getRelation` keeps owning their defaults.
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

function waysOf(geometry: LineString | MultiLineString): Position[][] {
  return geometry.type === 'LineString'
    ? [geometry.coordinates]
    : geometry.coordinates;
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

export async function getRelation(
  request: RelationRequest,
): Promise<RelationResponse> {
  const {relationId, segmentLimit = 0, markerDiff = 1000, reverse} = request;
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

  const markers = addMarkers(relation, markerDiff);
  const {
    properties: {name, 'name:en': nameEn = name, timestamp},
  } = relation;
  const fileName = `${nameEn}-${moment(timestamp).format('YY-MM-DD')}.gpx`;
  return {
    fileName,
    gpx: createGpx(relation, markers, segmentLimit),
  };
}
