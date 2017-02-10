const fs = require('fs');
const winston = require('winston');
const { getRelation } = require('./src/osm2gpx');

winston.level = 'verbose';

const argv = require('yargs')
  .usage('node Usage: $0 <command> [options]')
  .example(
    'node $0 -r 282071',
    'Exports the Israel National Trail into a gpx file'
  )
  .options({
    r: {
      alias: 'relationId',
      demandOption: true,
      describe: 'Open Street Maps Relation Id to export',
      type: 'number'
    },
    c: {
      alias: 'combineWays',
      default: true,
      describe: 'Combine OSM ways to gpx tracks, or leave original ways',
      type: 'bool'
    },
    s: {
      alias: 'segmentLimit',
      default: 9000,
      describe: 'The maximum number of waypoints for each gpx track',
      type: 'number'
    },
    m: {
      alias: 'markerDiff',
      default: 1000,
      describe: 'The distance between markers. "0" to disable markers',
      type: 'number'
    }
  })
  .help('h')
  .alias('h', 'help')
  .epilog('copyright 2015').argv;

getRelation(argv).then(
  ({ fileName, gpx }) => {
    fs.writeFileSync(fileName, gpx);
  },
  error => {
    console.error(error);
  }
);
