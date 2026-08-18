import {constants} from 'node:fs';
import {access, mkdir} from 'node:fs/promises';
import {Router} from 'express';
import {getLogger} from './logger.ts';

const logger = getLogger('health');

/*
 * Relative, because that is how winston names its transports — `logs/error.log`
 * and `logs/combined.log`, resolved against the process's cwd, which is /app in
 * the image. It is also the only directory this app writes to, and the one the
 * chart can mount somebody else's disk at.
 */
const dataDirs = ['logs'] as const;

let draining = false;

/*
 * Flipped by the SIGTERM handler rather than read from a signal here, so the
 * module stays a plain readiness check the tests can drive.
 */
export function beginDraining(): void {
  draining = true;
}

/*
 * Called once at startup, so a volume the pod cannot write to fails the
 * readiness probe immediately instead of surfacing later as a log line that
 * silently never landed. Not fatal: a pod that starts and never goes ready
 * says what is wrong in `kubectl describe`, where a crash loop only says it
 * died.
 */
export async function ensureDataDirs(
  dirs: readonly string[] = dataDirs,
): Promise<void> {
  await Promise.all(
    dirs.map(async (dir) => {
      try {
        await mkdir(dir, {recursive: true});
      } catch (error) {
        logger.error(`could not create ${dir}`, error);
      }
    }),
  );
}

interface DirCheck {
  dir: string;
  error?: string;
}

/*
 * `W_OK` on the directory rather than a probe write: it answers the question
 * that actually goes wrong here — values.yaml's own `podSecurityContext`
 * comment notes that a freshly provisioned volume is owned by root, leaving it
 * unwritable by the unprivileged image user so winston cannot create its log
 * files — without adding a create and unlink to every probe cycle.
 */
function checkDataDirs(dirs: readonly string[]): Promise<DirCheck[]> {
  return Promise.all(
    dirs.map(async (dir) => {
      try {
        await access(dir, constants.W_OK);
        return {dir};
      } catch (error) {
        return {dir, error: (error as NodeJS.ErrnoException).code ?? 'EACCES'};
      }
    }),
  );
}

export interface HealthOptions {
  dirs?: readonly string[];
  isDraining?: () => boolean;
}

/*
 * A factory rather than a ready-made router, so the tests can point the checks
 * at a temp directory and supply their own drain flag instead of mutating
 * module state the next test would inherit.
 */
export function createHealthRouter({
  dirs = dataDirs,
  isDraining = () => draining,
}: HealthOptions = {}): Router {
  const router = Router();

  /*
   * Liveness answers one question — can this process still run a handler — so
   * it checks nothing else on purpose. A liveness probe that failed on an
   * unwritable volume or an unreachable OSM API would restart a pod that a
   * restart cannot fix, and the restart would take a running export with it.
   * It stays 200 while draining too; that is readiness's business.
   */
  router.get('/healthz', (req, res) => {
    res.send({status: 'ok', uptime: Math.round(process.uptime())});
  });

  /*
   * Readiness answers whether this pod should be sent traffic. Deliberately
   * not tied to whether an export is in flight: a large relation takes minutes
   * to fetch and build, and going unready for its duration would pull the only
   * replica out of the Service — failing every other caller to report that one
   * request is slow. Latency is what the histogram in metrics.ts is for.
   */
  router.get('/readyz', async (req, res) => {
    if (isDraining()) {
      res.status(503).send({status: 'draining'});
      return;
    }

    const checks = await checkDataDirs(dirs);
    const failed = checks.filter(({error}) => error);
    if (failed.length > 0) {
      res.status(503).send({status: 'unavailable', checks: failed});
      return;
    }

    res.send({status: 'ready'});
  });

  return router;
}
