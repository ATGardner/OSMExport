import {Logger, config, createLogger, format, transports} from 'winston';

const {combine, colorize, errors, json, simple, timestamp} = format;

/*
 * `LOG_LEVEL` takes the names winston already writes in the `level` field —
 * error, warn, info, http, verbose, debug, silly — so turning the verbosity up
 * while reproducing something is a restart rather than a rebuild.
 *
 * It is validated against winston's own level table instead of being passed
 * through: an unknown name is accepted by `createLogger`, matches no level any
 * transport knows about, and leaves the app running with nothing in the files
 * or on stdout. A typo would silence production, so an unrecognised value
 * falls back to `info` and says so below, once there is a logger to say it on.
 *
 * Unset and empty are the same thing on purpose — a chart that renders
 * `LOG_LEVEL=""` means "use the default", not "here is a bad value".
 */
const defaultLevel = 'info';
const requestedLevel = (process.env.LOG_LEVEL ?? '').trim().toLowerCase();
const isKnownLevel = Object.hasOwn(config.npm.levels, requestedLevel);
const level = isKnownLevel ? requestedLevel : defaultLevel;

/*
 * `maxsize` on its own only rolls over to a new file, so the disk still fills
 * up in 20MB pieces. `maxFiles` is what unlinks the oldest, and `tailable`
 * keeps the newest entries in the unsuffixed name instead of moving the live
 * log to a new number on every rotation. Each transport is capped at
 * maxsize * maxFiles, so this pair costs 200MB at worst.
 */
const fileOptions = {
  maxsize: 20 * 1024 * 1024,
  maxFiles: 5,
  tailable: true,
};

const logger = createLogger({
  level,
  format: combine(timestamp(), errors({stack: true}), json()),
  transports: [
    // Write all errors to a dedicated file
    new transports.File({
      filename: 'logs/error.log',
      level: 'error',
      ...fileOptions,
    }),
    // Write all logs (info, warn, error) to a combined file
    new transports.File({filename: 'logs/combined.log', ...fileOptions}),
  ],
});

/*
 * Kubernetes collects a container's logs by capturing what it writes to
 * stdout, so this transport is what makes the app visible to `kubectl logs`
 * and to any log collector at all. Gating it on a non-production environment
 * left the deployed pods writing nothing to stdout: the files above are only
 * reachable by exec'ing into the pod, and they go with it unless the chart's
 * PersistentVolume is enabled.
 *
 * Production inherits the logger's own JSON format — one object per line,
 * stack traces included, which is what a collector parses. Errors stay on
 * stdout with everything else rather than splitting to stderr; the two
 * streams can interleave out of order once a collector merges them back, and
 * `level` is already a field to query on.
 */
const consoleOptions =
  process.env.NODE_ENV === 'production'
    ? {}
    : {format: combine(colorize(), simple())};

logger.add(new transports.Console(consoleOptions));

/*
 * Warned rather than thrown: a bad level is not worth refusing to start over,
 * but it has to be visible — the symptom otherwise is logs that look normal at
 * the level nobody asked for.
 */
if (requestedLevel !== '' && !isKnownLevel) {
  logger
    .child({label: 'logger'})
    .warn(`unknown LOG_LEVEL "${requestedLevel}", logging at ${level} instead`);
}

export function getLogger(label: string): Logger {
  return logger.child({label});
}
