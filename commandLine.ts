import {writeFileSync} from 'fs';
import yargs from 'yargs';
import {hideBin} from 'yargs/helpers';
import {getLogger} from './src/logger.ts';
import {getRelationGpx} from './src/osm2gpx.ts';
import {getRelationKml, getRelationKmz} from './src/osm2kml.ts';
import type {RelationExporter} from './src/relation.ts';

const logger = getLogger('commandLine');

const formats = ['gpx', 'kml', 'kmz'] as const;

const exporters: Record<(typeof formats)[number], RelationExporter> = {
  gpx: getRelationGpx,
  kml: getRelationKml,
  kmz: getRelationKmz,
};

await yargs(hideBin(process.argv))
  .usage('Usage: $0 <command> [options]')
  .example(
    'node $0 getRelation 282071',
    'Exports the Israel National Trail into a gpx file',
  )
  .example(
    'node $0 getRelation 282071 -f kmz',
    'Exports the same trail as a Google Earth kmz file',
  )
  .command({
    command: 'getRelation <relationId>',
    describe: 'Exports the relation to a gpx, kml or kmz file',
    /*
     * Declared here rather than in the global `.options()` block below, which
     * yargs applies after the command and so leaves untyped in `argv` — the
     * one option whose value is used as a lookup key needs its union type.
     */
    builder: (command) =>
      command
        .positional('relationId', {
          describe: 'Open Street Maps Relation Id to export',
          type: 'number',
          demandOption: true,
        })
        .option('format', {
          alias: 'f',
          choices: formats,
          default: 'gpx' as const,
          describe: 'The output format',
        }),
    async handler(argv) {
      try {
        const {fileName, body} = await exporters[argv.format](argv);
        writeFileSync(fileName, body);
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
