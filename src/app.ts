import express, {type ErrorRequestHandler, type RequestHandler} from 'express';
import slug from 'slug';
import {BadRequestError, NotFoundError} from './errors.ts';
import {beginDraining, createHealthRouter, ensureDataDirs} from './health.ts';
import {getLogger} from './logger.ts';
import {
  metricsMiddleware,
  startMetricsServer,
  stopMetricsServer,
} from './metrics.ts';
import {getRelationGpx} from './osm2gpx.ts';
import {getRelationKml, getRelationKmz} from './osm2kml.ts';
import type {RelationExporter} from './relation.ts';
import {parseRelationRequest} from './relation.ts';

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
/*
 * Ahead of metricsMiddleware, unlike every other route: the kubelet probes
 * these every few seconds for the life of the pod, and counting them would
 * bury the API's own throughput under probe traffic in the request histogram.
 */
app.use(createHealthRouter());

// Ahead of the routes, so unmatched paths and error responses are counted too.
app.use(metricsMiddleware);
app.get('/osm2gpx', createHandler('gpx', getRelationGpx));
app.get('/osm2kml', createHandler('kml', getRelationKml));
app.get('/osm2kmz', createHandler('kmz', getRelationKmz));
app.use(errorHandler);

/*
 * Before the listener, so a volume the pod cannot write to is already failing
 * readiness by the time the first probe arrives, rather than being discovered
 * as log lines that silently never landed.
 */
await ensureDataDirs();

const port = process.env.PORT || 3000;
const server = app.listen(port, () => {
  logger.info(`OSMExport listening on port ${port}!`);
});

startMetricsServer();

/*
 * One readiness period at the chart's default, which is what the drain flag
 * needs to be seen: the kubelet keeps routing to this pod until its own probe
 * fails and the endpoints controller catches up, so closing the listener the
 * instant SIGTERM lands would refuse requests that were already on their way.
 */
const DRAIN_MS = 10_000;

/*
 * Nothing here calls process.exit. With both listeners closed an idle process
 * runs out of handles and ends on its own, while one still building a large
 * export keeps going until it has answered or the grace period expires — the
 * better of the two outcomes for a caller several minutes into a download.
 */
process.once('SIGTERM', () => {
  logger.info('SIGTERM received, draining');
  beginDraining();
  setTimeout(() => {
    server.close(() => {
      logger.info('API listener closed');
    });
    // Keep-alive sockets sitting idle would otherwise hold `close` open.
    server.closeIdleConnections();
    stopMetricsServer();
  }, DRAIN_MS).unref();
});
