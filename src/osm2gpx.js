'use strict';
const _ = require('lodash');
const moment = require('moment');
const {GpxFileBuilder} = require('gpx');
const LatLon = require('geodesy').LatLonEllipsoidal;
const {getLogger} = require('./logger');
const osmWrapper = require('./osm/osmWrapper');

const logger = getLogger('osm2gpx');

function createGpx(
  {id, geometry: {coordinates, type}, properties: {name, timestamp}},
  markers,
  limit,
) {
  const builder = new GpxFileBuilder({
    description: 'Data extracted from OSM',
    name,
    creator: 'OpenStreetMap relation export',
    time: timestamp,
  });
  logger.verbose(`Creating GPX for relation ${id}`);
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
        name: marker,
      });
    },
  );
  const ways = type === 'LineString' ? [coordinates] : coordinates;
  ways.forEach((way, i) => {
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

function createMarkerFeature(lat, lon, marker) {
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

function addMarkers({geometry: {coordinates, type}}, markerDiff) {
  const ways = type === 'LineString' ? [coordinates] : coordinates;
  const markers = [];
  let prevDistance = 0;
  let prevMarker = 0;
  let prevLatLon;
  ways.forEach(way => {
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

async function getRelation({
  relationId,
  segmentLimit = 9000,
  markerDiff = 1000,
  reverse,
}) {
  const geoJson = await osmWrapper.getFullRelation(relationId);
  const relation = geoJson.features.find(f => f.id.startsWith('relation'));
  if (reverse) {
    relation.geometry.coordinates.reverse();
  }

  const markers = addMarkers(relation, markerDiff);
  const {
    properties: {name, 'name:en': nameEn = name, timestamp},
  } = relation;
  const fileName = `${nameEn}-${moment(timestamp).format('YY-MM-DD')}.gpx`;
  const gpx = createGpx(relation, markers, +segmentLimit);
  return {
    fileName,
    gpx,
  };
}

module.exports = {
  getRelation,
};
