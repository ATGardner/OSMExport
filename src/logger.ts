import {Logger, createLogger, format, transports} from 'winston';

const {combine, timestamp, label, simple} = format;

export function getLogger(name: string): Logger {
  return createLogger({
    level: 'verbose',
    format: combine(label({label: name}), timestamp(), simple()),
    transports: [new transports.Console()],
  });
}
