const {loggers, format, transports} = require('winston');
const {combine, timestamp, label, simple} = format;

function getLogger(name) {
  return loggers.get(name, {
    level: 'verbose',
    format: combine(label({label: name}), timestamp(), simple()),
    transports: [new transports.Console()],
  });
}

module.exports = {
  getLogger,
};
