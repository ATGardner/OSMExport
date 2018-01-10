const {writeFileSync} = require('fs');
const {getLogger} = require('./src/logger');
const {getRelation} = require('./src/osm2gpx');

const logger = getLogger('commandLine');

const argv = require('yargs')
  .usage('Usage: $0 <command> [options]')
  .example(
    'node $0 -r 282071',
    'Exports the Israel National Trail into a gpx file',
  )
  .command({
    command: 'getRelation [relationId]',
    description: 'Exports the relation to a gpx file',
    handler: async argv => {
      try {
        const {fileName, gpx} = await getRelation(argv);
        writeFileSync(fileName, gpx);
      } catch (error) {
        logger.error(error);
      }
    },
  })
  .options({
    r: {
      alias: 'relationId',
      demandOption: true,
      describe: 'Open Street Maps Relation Id to export',
      type: 'number',
    },
    s: {
      alias: 'segmentLimit',
      default: 9000,
      describe: 'The maximum number of waypoints for each gpx track',
      type: 'number',
    },
    m: {
      alias: 'markerDiff',
      default: 1000,
      describe: 'The distance between markers. "0" to disable markers',
      type: 'number',
    },
    rev: {
      alias: 'reverse',
      default: false,
      describe: 'Reverse way sort and marker order',
      type: 'bool',
    },
  })
  .help('h')
  .alias('h', 'help')
  .epilog('copyright 2015').argv;
