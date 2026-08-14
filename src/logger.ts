import {Logger, createLogger, format, transports} from 'winston';

const {combine, colorize, errors, json, simple, timestamp} = format;

const logger = createLogger({
  level: 'info',
  format: combine(timestamp(), errors({stack: true}), json()),
  transports: [
    // Write all errors to a dedicated file
    new transports.File({filename: 'logs/error.log', level: 'error'}),
    // Write all logs (info, warn, error) to a combined file
    new transports.File({filename: 'logs/combined.log'}),
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
