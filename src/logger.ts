import {Logger, createLogger, format, transports} from 'winston';

const {combine, colorize, errors, json, simple, timestamp} = format;

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
  level: 'info',
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

if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new transports.Console({
      format: combine(colorize(), simple()),
    }),
  );
}

export function getLogger(label: string): Logger {
  return logger.child({label});
}
