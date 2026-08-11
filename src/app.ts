import express, { type RequestHandler } from 'express';
import { getLogger } from './logger.ts';
import { getRelation, type RelationRequest } from './osm2gpx.ts';
import moment from 'moment';
import slug from 'slug';
import ua, { Visitor } from 'universal-analytics';

const app = express();

const logger = getLogger('app');

slug.defaults.mode = 'rfc3986';
if (app.get('env') === 'production') {
  app.use(ua.middleware('UA-18054605-12', { cookieName: '_ga' }));
}

function sendEvent(visitor: Visitor | undefined, action: string, label: string) {
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

function sendTiming(visitor: Visitor | undefined, variable: string, time: number) {
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

const handler: RequestHandler<
  Record<string, never>, // route params — none on this route
  string,                // response body
  never,                 // request body — it's a GET
  RelationRequest        // query
> = async ({ query, query: { relationId }, visitor }, res) => {
  const start = moment();
  sendEvent(visitor, 'Creating gpx', String(relationId));
  try {
    const { fileName, gpx } = await getRelation(query);
    const end = moment().diff(start);
    sendTiming(visitor, 'getRelationTime', end);
    const safeFileName = encodeURI(
      slug(fileName, {
        // Replace spaces with replacement
        replacement: ' ',
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
}

/*
 *http://localhost:3000/osm2gpx?relationId=1660381&combineWays=0
 *http://localhost:3000/osm2gpx?relationId=282071&combineWays=1&segmentLimit=9000
 *http://localhost:3000/osm2gpx?relationId=6738379&combineWays=1&segmentLimit=9000
 *INT - http://localhost:3000/osm2gpx?relationId=282071&markerDiff=1609.34
 *JMT - http://localhost:3000/osm2gpx?relationId=1244828&markerDiff=1609.34&reverse=1&segmentLimit=0
 * 6148296 - ramon crater
 */
app.get('/osm2gpx', handler);

const port = process.env.PORT || 3000;
app.listen(port, () => {
  logger.info(`OSMExport listening on port ${port}!`);
});
