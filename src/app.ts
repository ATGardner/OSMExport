import {BadRequestError, getRelation, parseRelationRequest} from './osm2gpx.ts';
import express, {type ErrorRequestHandler, type RequestHandler} from 'express';
import {getLogger} from './logger.ts';
import slug from 'slug';

const app = express();

const logger = getLogger('app');

slug.defaults.mode = 'rfc3986';

const handler: RequestHandler<Record<string, never>, string> = async (
  req,
  res,
) => {
  const request = parseRelationRequest(req.query);
  const {relationId} = request;
  logger.info(`creating gpx - ${relationId}`);
  logger.profile(relationId);
  try {
    const {fileName, gpx} = await getRelation(request);
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
  } finally {
    logger.profile(relationId);
  }
};

/*
 * Express 5 forwards rejected handler promises here, so `parseRelationRequest`
 * can throw its way to a 400 without a try/catch at the call site.
 */
const errorHandler: ErrorRequestHandler = (error, req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  if (error instanceof BadRequestError) {
    logger.warn(`bad request - ${req.originalUrl}`, error);
    res.set('Content-Type', 'text/plain').status(400).send(error.message);
    return;
  }

  logger.error(`failed handling request - ${req.originalUrl}`, error);
  res.set('Content-Type', 'text/plain').status(500).send('An error occured');
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
app.use(errorHandler);

const port = process.env.PORT || 3000;
app.listen(port, () => {
  logger.info(`OSMExport listening on port ${port}!`);
});
