import {getLogger} from './src/logger.ts';
import {getRelation} from './src/osm2gpx.ts';
import {hideBin} from 'yargs/helpers';
import {writeFileSync} from 'fs';
import yargs from 'yargs';

const logger = getLogger('commandLine');

await yargs(hideBin(process.argv))
  .usage('Usage: $0 <command> [options]')
  .example(
    'node $0 getRelation 282071',
    'Exports the Israel National Trail into a gpx file',
  )
  .command({
    command: 'getRelation <relationId>',
    describe: 'Exports the relation to a gpx file',
    builder: (command) =>
      command.positional('relationId', {
        describe: 'Open Street Maps Relation Id to export',
        type: 'number',
        demandOption: true,
      }),
    async handler(argv) {
      try {
        const {fileName, gpx} = await getRelation(argv);
        writeFileSync(fileName, gpx);
        logger.info(`Done writing file "${fileName}"`);
      } catch (error) {
        logger.error(error);
      }
    },
  })
  .options({
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
      type: 'boolean',
    },
  })
  .help('h')
  .alias('h', 'help')
  .epilog('copyright 2015')
  .parse();
