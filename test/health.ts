import assert from 'node:assert/strict';
import {mkdtemp, rm, writeFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {after, before, describe, it} from 'node:test';
import express from 'express';
import type {HealthOptions} from '../src/health.ts';
import {createHealthRouter, ensureDataDirs} from '../src/health.ts';

/*
 * A real listening server rather than a hand-rolled req/res pair: these are
 * Express routes, and a fake would only be asserting the fake.
 */
async function get(
  path: string,
  options: HealthOptions,
): Promise<{status: number; body: unknown}> {
  const app = express();
  app.use(createHealthRouter(options));
  const server = createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, resolve);
  });
  try {
    const {port} = server.address() as {port: number};
    const response = await fetch(`http://127.0.0.1:${port}${path}`);
    return {status: response.status, body: await response.json()};
  } finally {
    server.close();
  }
}

describe('Health', () => {
  // Assigned in `before`, which node:test runs ahead of every case below.
  let writable = '';

  before(async () => {
    writable = await mkdtemp(join(tmpdir(), 'osmexport-health-'));
  });

  after(async () => {
    await rm(writable, {recursive: true, force: true});
  });

  describe('/healthz', () => {
    it('reports ok', async () => {
      const {status, body} = await get('/healthz', {dirs: []});
      assert.equal(status, 200);
      assert.equal((body as {status: string}).status, 'ok');
    });

    /*
     * The distinction the two endpoints exist to draw: a restart cannot fix an
     * unwritable volume or a pod on its way out, so liveness must not fail for
     * either.
     */
    it('stays ok while draining, and with an unusable data dir', async () => {
      const {status} = await get('/healthz', {
        dirs: [join(writable, 'missing')],
        isDraining: () => true,
      });
      assert.equal(status, 200);
    });
  });

  describe('/readyz', () => {
    it('is ready when every data dir is writable', async () => {
      const {status, body} = await get('/readyz', {dirs: [writable]});
      assert.equal(status, 200);
      assert.deepEqual(body, {status: 'ready'});
    });

    it('is unavailable when a data dir is missing', async () => {
      const missing = join(writable, 'missing');
      const {status, body} = await get('/readyz', {dirs: [writable, missing]});
      assert.equal(status, 503);
      assert.deepEqual(body, {
        status: 'unavailable',
        checks: [{dir: missing, error: 'ENOENT'}],
      });
    });

    /*
     * Ahead of the directory checks, and without reaching the disk at all: a
     * pod that is shutting down should stop taking traffic whatever the state
     * of its volume.
     */
    it('is draining once shutdown has begun', async () => {
      const {status, body} = await get('/readyz', {
        dirs: [join(writable, 'missing')],
        isDraining: () => true,
      });
      assert.equal(status, 503);
      assert.deepEqual(body, {status: 'draining'});
    });
  });

  describe('ensureDataDirs', () => {
    it('creates the data dirs, and readiness then passes', async () => {
      const created = join(writable, 'nested', 'logs');
      await ensureDataDirs([created]);
      const {status} = await get('/readyz', {dirs: [created]});
      assert.equal(status, 200);
    });

    /*
     * Logged and swallowed rather than thrown: a pod that starts and stays
     * unready says what is wrong, where one that exits on boot only crash
     * loops. The readiness probe is what reports it, which the case above
     * covers.
     */
    it('does not throw when a dir cannot be created', async () => {
      // A file where the directory would go: mkdir fails with ENOTDIR.
      const blocked = join(writable, 'blocker');
      await writeFile(blocked, '');
      await ensureDataDirs([join(blocked, 'logs')]);
    });
  });
});
