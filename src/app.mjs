'use strict';

import express from 'express';
import {getLogger} from './logger.mjs';
import {getRelation} from './osm2gpx.mjs';
import moment from 'moment';
import slug from 'slug';
import ua from 'universal-analytics';

const app = express();

const logger = getLogger('app');

slug.defaults.mode = 'rfc3986';
if (app.get('env') === 'production') {
  app.use(ua.middleware('UA-18054605-12', {cookieName: '_ga'}));
}

function sendEvent(visitor, action, label) {
  logger.info(`${action} - ${label}`);
  if (visitor) {
    visitor
      .event({
        ec: 'OSM2GPXv4',
        ea: action,
        el: label,
        aip: true,
      })
      .send();
  }
}

function sendTiming(visitor, variable, time) {
  logger.info(`${variable} - ${time}ms`);
  if (visitor) {
    visitor
      .timing({
        utc: 'OSM2GPXv4',
        utv: variable,
        utt: time,
        aip: true,
      })
      .send();
  }
}

/*
 *http://localhost:3000/osm2gpx?relationId=1660381&combineWays=0
 *http://localhost:3000/osm2gpx?relationId=282071&combineWays=1&segmentLimit=9000
 *http://localhost:3000/osm2gpx?relationId=6738379&combineWays=1&segmentLimit=9000
 *INT - http://localhost:3000/osm2gpx?relationId=282071&markerDiff=1609.34
 *JMT - http://localhost:3000/osm2gpx?relationId=1244828&markerDiff=1609.34&reverse=1&segmentLimit=0
 * 6148296 - ramon crater
 */
app.get('/osm2gpx', async ({query, query: {relationId}, visitor}, res) => {
  const start = moment();
  sendEvent(visitor, 'Creating gpx', relationId);
  try {
    const {fileName, gpx} = await getRelation(query);
    const end = moment().diff(start);
    sendTiming(visitor, 'getRelationTime', end);
    const safeFileName = encodeURI(
      slug(fileName, {
        // Replace spaces with replacement
        replacement: (c) => c,
        // Replace unicode symbols or not
        symbols: false,
        // (optional) regex to remove characters
        remove: null,
        // Result in lower case
        lower: false,
        // Replace special characters
        charmap: slug.charmap,
        // Replace multi-characters
        multicharmap: slug.multicharmap,
      }),
    );
    res.set({
      'Content-Disposition': `attachment; filename="${safeFileName}"`,
      'Content-Type': 'application/xml',
    });
    res.send(gpx);
  } catch (error) {
    const end = moment().diff(start);
    sendTiming(visitor, 'failureTime', end);
    sendEvent(visitor, 'Error', `${relationId} - ${error}`);
    logger.error('Error Occured', error);
    res.set('Content-Type', 'text/plain').status(500).send('An error occured');
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  logger.info(`OSMExport listening on port ${port}!`);
});
