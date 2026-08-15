import {Histogram, Registry, collectDefaultMetrics} from 'prom-client';
import express, {type RequestHandler} from 'express';
import {NotFoundError} from './errors.ts';
import {getLogger} from './logger.ts';

const logger = getLogger('metrics');

/*
 * A dedicated registry rather than prom-client's global one, so importing this
 * module from the CLI entrypoint cannot collide with anything else and tests
 * can build their own. `collectDefaultMetrics` adds the process and Node
 * runtime series — event loop lag, GC pauses, heap and handle counts — which
 * are the only signals that distinguish "the OSM API is slow" from "we are".
 */
export const registry = new Registry();

collectDefaultMetrics({register: registry});

/*
 * Every duration bucket set below is in seconds and skewed long on purpose.
 * A request here is dominated by one OSM API round trip, so the library
 * defaults (which top out at 10s) would pile most real traffic into +Inf and
 * make the histogram unable to answer anything.
 */
const httpRequestDuration = new Histogram({
  name: 'osmexport_http_request_duration_seconds',
  help: 'Duration of HTTP requests, by matched route and response status',
  labelNames: ['route', 'status'],
  buckets: [0.05, 0.25, 1, 2.5, 5, 10, 20, 30, 60, 120],
  registers: [registry],
});

const osmApiRequestDuration = new Histogram({
  name: 'osmexport_osm_api_request_duration_seconds',
  help: 'Duration of outbound OSM API requests, by query kind and outcome',
  labelNames: ['query', 'outcome'],
  // Lower buckets than the Overpass queries this replaced, which it outruns.
  buckets: [0.25, 0.5, 1, 2.5, 5, 10, 20, 30, 60],
  registers: [registry],
});

const exportSizeBytes = new Histogram({
  name: 'osmexport_export_size_bytes',
  help: 'Size of generated export documents, by format',
  labelNames: ['format'],
  /*
   * The Israel National Trail, one of the largest relations exported, is ~2MB
   * of GPX. The low buckets are there for KMZ, which deflates the same relation
   * by roughly an order of magnitude.
   */
  buckets: [1e3, 10e3, 100e3, 500e3, 2e6, 8e6, 32e6],
  registers: [registry],
});

const relationPoints = new Histogram({
  name: 'osmexport_relation_points',
  help: 'Number of coordinates in an exported relation',
  buckets: [100, 1e3, 5e3, 20e3, 80e3, 320e3],
  registers: [registry],
});

/*
 * No separate request counter: a histogram already exports `_count` per label
 * set, so rate() over `osmexport_http_request_duration_seconds_count` gives
 * throughput and the `status` label gives the 400-vs-500 split.
 */
export const metricsMiddleware: RequestHandler = (req, res, next) => {
  const stop = httpRequestDuration.startTimer();
  /*
   * `close` rather than `finish`, because an export that outlives the client's
   * patience is exactly the case worth seeing: `finish` never fires when the
   * connection is dropped mid-request, so those would vanish from the
   * histogram instead of showing up as a slow abort.
   */
  res.on('close', () => {
    /*
     * The matched route pattern, never `req.path` — this app 404s anything
     * else, and labelling by raw path would let a crawler mint an unbounded
     * number of series. Express types `route` as `any`, hence the assertion.
     */
    const route = req.route as {path?: string} | undefined;
    stop({
      route: route?.path ?? 'unmatched',
      status: res.writableEnded ? res.statusCode : 'aborted',
    });
  });
  next();
};

export async function observeOsmApiQuery<T>(
  query: string,
  run: () => Promise<T>,
): Promise<T> {
  const stop = osmApiRequestDuration.startTimer({query});
  try {
    const result = await run();
    stop({outcome: 'success'});
    return result;
  } catch (error) {
    /*
     * A missing relation is someone mistyping an id, not the API failing, and
     * folding the two together would let a bad link raise the upstream error
     * rate that alerts hang off.
     */
    stop({outcome: error instanceof NotFoundError ? 'not_found' : 'error'});
    throw error;
  }
}

export function observeRelationPoints(count: number): void {
  relationPoints.observe(count);
}

export function observeExportSize(format: string, body: string | Buffer): void {
  // Byte length, not string length — exports carry non-ASCII relation names.
  exportSizeBytes.observe({format}, Buffer.byteLength(body));
}

/*
 * Served on its own port, not as a route on the main app. The chart's Ingress
 * and HTTPRoute both send every path to the `http` port, so a `/metrics` route
 * there would be published to the internet along with the exporter.
 *
 * `METRICS_ENABLED=false` turns the listener off outright, which is what the
 * chart sets when `metrics.enabled` is false. Unset means on, so a local run
 * or a bare `docker run` still exposes metrics without extra ceremony. The
 * port cannot double as the switch — `METRICS_PORT=0` binds a random free
 * port in Node rather than meaning "off".
 */
export function startMetricsServer(): void {
  if (process.env.METRICS_ENABLED === 'false') {
    /*
     * Logged rather than silent: "no metrics" is otherwise indistinguishable
     * from a crashed listener when you go looking for the endpoint.
     */
    logger.info('metrics disabled by METRICS_ENABLED');
    return;
  }

  const port = Number(process.env.METRICS_PORT) || 9091;
  const metricsApp = express();
  metricsApp.get('/metrics', async (req, res, next) => {
    try {
      res.set('Content-Type', registry.contentType);
      res.send(await registry.metrics());
    } catch (error) {
      next(error);
    }
  });
  metricsApp.listen(port, () => {
    logger.info(`metrics listening on port ${port}`);
  });
}
