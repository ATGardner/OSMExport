import {type RelationRequest, getRelation} from './osm2gpx.ts';
import express, {type RequestHandler} from 'express';
import {getLogger} from './logger.ts';
import slug from 'slug';

const app = express();

const logger = getLogger('app');

slug.defaults.mode = 'rfc3986';

const handler: RequestHandler<
  Record<string, never>,
  string,
  never,
  RelationRequest
> = async ({query, query: {relationId}}, res) => {
  logger.info(`creating gpx - ${relationId}`);
  logger.profile(relationId);
  try {
    const {fileName, gpx} = await getRelation(query);
    logger.profile(relationId);
    const safeFileName = encodeURI(
      slug(fileName, {
        replacement: ' ',
        symbols: false,
        remove: null,
        lower: false,
        charmap: slug.charmap,
        multicharmap: slug.multicharmap,
      }),
    );
    res.set({
      'Content-Disposition': `attachment; filename="${safeFileName}"`,
      'Content-Type': 'application/xml',
    });
    res.send(gpx);
  } catch (error) {
    logger.error(`failed creating gpx - ${relationId}`, error);
    logger.profile(relationId);
    res.set('Content-Type', 'text/plain').status(500).send('An error occured');
  }
};

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
