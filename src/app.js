'use strict';
const express = require('express');
const moment = require('moment');
const slug = require('slug');
const ua = require('universal-analytics');
const winston = require('winston');
const osm2gpx = require('./osm2gpx');
const app = express();

slug.defaults.mode = 'rfc3986';
winston.level = 'verbose';
if (app.get('env') === 'production') {
  app.use(ua.middleware('UA-18054605-12', {cookieName: '_ga'}));
}

function sendEvent(visitor, action, label) {
  winston.info(`${action} - ${label}`);
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
  winston.info(`${variable} - ${time}ms`);
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
 */
app.get('/osm2gpx', async ({query, query: {relationId}, visitor}, res) => {
  const start = moment();
  sendEvent(visitor, 'Creating gpx', relationId);
  try {
    const {fileName, gpx} = await osm2gpx.getRelation(query);
    const end = moment().diff(start);
    sendTiming(visitor, 'getRelationTime', end);
    const safeFileName = encodeURI(
      slug(fileName, {
        // Replace spaces with replacement
        replacement: c => c,
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
    res
      .set('Content-Type', 'text/plain')
      .status(500)
      .send(error.stack);
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  winston.info(`OSM2GPX listening on port ${port}!`);
});
