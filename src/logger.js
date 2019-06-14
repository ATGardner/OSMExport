'use strict';

import winston from 'winston';
// import {createLogger, format, transports} from 'winston';

const {combine, timestamp, label, simple} = winston.format;

export function getLogger(name) {
  return winston.createLogger({
    level: 'verbose',
    format: combine(label({label: name}), timestamp(), simple()),
    transports: [new winston.transports.Console()],
  });
}
