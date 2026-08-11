import LatLon from 'geodesy/latlon-ellipsoidal-vincenty.js';
import _ from 'lodash';
import {getFullRelation} from './osm/osmWrapper.ts';
import {getLogger} from './logger.ts';
import gpx from 'gpx';
import moment from 'moment';
import type {
  Feature,
  LineString,
  MultiLineString,
  Point,
  Position,
} from 'geojson';

const logger = getLogger('osm2gpx');

type RelationProps = {
  name: string;
  'name:en'?: string;
  timestamp: string;
};

type RelationFeature = Feature<LineString | MultiLineString, RelationProps>;

type MarkerFeature = Feature<Point, {marker: number}>;

export interface RelationRequest {
  relationId: string | number;
  segmentLimit?: string | number;
  markerDiff?: string | number;
  reverse?: boolean | string;
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
  markers.forEach(
    ({
      properties: {marker},
      geometry: {
        coordinates: [longitude, latitude],
      },
    }) => {
      builder.addWayPoints({
        latitude,
        longitude,
        name: String(marker),
      });
    },
  );
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

export async function getRelation({
  relationId,
  segmentLimit = 0,
  markerDiff = 1000,
  reverse,
}: RelationRequest): Promise<{fileName: string; gpx: string}> {
  const id = String(relationId);
  const limit = Number(segmentLimit);
  const diff = Number(markerDiff);
  const geoJson = await getFullRelation(id);
  const relation = geoJson.features.find(
    (f): f is RelationFeature =>
      typeof f.id === 'string' && f.id.startsWith('relation'),
  );
  if (!relation) {
    throw new Error(`No relation feature found for ${id}`);
  }

  if (reverse) {
    relation.geometry.coordinates.reverse();
  }

  const markers = addMarkers(relation, diff);
  const {
    properties: {name, 'name:en': nameEn = name, timestamp},
  } = relation;
  const fileName = `${nameEn}-${moment(timestamp).format('YY-MM-DD')}.gpx`;
  return {
    fileName,
    gpx: createGpx(relation, markers, limit),
  };
}
