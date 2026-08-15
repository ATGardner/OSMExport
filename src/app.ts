import {BadRequestError, NotFoundError} from './errors.ts';
import express, {type ErrorRequestHandler, type RequestHandler} from 'express';
import {getRelationKml, getRelationKmz} from './osm2kml.ts';
import {metricsMiddleware, startMetricsServer} from './metrics.ts';
import type {RelationExporter} from './relation.ts';
import {getLogger} from './logger.ts';
import {getRelationGpx} from './osm2gpx.ts';
import {parseRelationRequest} from './relation.ts';
import slug from 'slug';

const app = express();

const logger = getLogger('app');

slug.defaults.mode = 'rfc3986';

/*
 * A route per format rather than a `format` query param, so the URL a user
 * bookmarks or pastes says what it hands back and `metricsMiddleware` splits
 * the latency histogram by format for free — the route pattern is already its
 * label.
 */
function createHandler(
  format: string,
  getRelation: RelationExporter,
): RequestHandler<Record<string, never>> {
  return async (req, res) => {
    const request = parseRelationRequest(req.query);
    const {relationId} = request;
    logger.info(`creating ${format} - ${relationId}`);
    logger.profile(relationId);
    try {
      const {fileName, contentType, body} = await getRelation(request);
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
        'Content-Type': contentType,
      });
      res.send(body);
    } finally {
      logger.profile(relationId);
    }
  };
}

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

  /*
   * Warn rather than error, and the message goes to the client verbatim: an
   * id that OSM has no relation for is the caller's mistake to fix, and
   * telling them which relation was missing is the whole point.
   */
  if (error instanceof NotFoundError) {
    logger.warn(`not found - ${req.originalUrl}`, error);
    res.set('Content-Type', 'text/plain').status(404).send(error.message);
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
 *http://localhost:3000/osm2kml?relationId=282071
 *http://localhost:3000/osm2kmz?relationId=282071
 */
// Ahead of the routes, so unmatched paths and error responses are counted too.
app.use(metricsMiddleware);
app.get('/osm2gpx', createHandler('gpx', getRelationGpx));
app.get('/osm2kml', createHandler('kml', getRelationKml));
app.get('/osm2kmz', createHandler('kmz', getRelationKmz));
app.use(errorHandler);

const port = process.env.PORT || 3000;
app.listen(port, () => {
  logger.info(`OSMExport listening on port ${port}!`);
});

startMetricsServer();
