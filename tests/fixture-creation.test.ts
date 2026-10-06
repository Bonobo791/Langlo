import { execFile } from 'node:child_process';
import { mkdtemp, realpath, rmdir, symlink, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';

const runNode = promisify(execFile);
const helperUrl = new URL('./fixtures/database.ts', import.meta.url).href;
const validatorUrl = new URL(
  '../src/lib/server/db/fixture-target.ts',
  import.meta.url
).href;

describe('disposable fixture creation', () => {
  it('returns a canonical valid fixture when TMPDIR is a real symlink', async () => {
    const harness = await mkdtemp(
      join(await realpath(tmpdir()), 'langlo-temp-')
    );
    const alias = `${harness}-alias`;
    await symlink(harness, alias);
    try {
      const { stdout } = await runNode(
        process.execPath,
        [
          '--input-type=module',
          '-e',
          `
          import fs from 'node:fs/promises';
          import assert from 'node:assert/strict';
          import { pathToFileURL } from 'node:url';
          import { join } from 'node:path';
          const { createDisposableFixture } = await import(${JSON.stringify(helperUrl)});
          const { validateFixtureTarget, fixtureMarkerName } = await import(${JSON.stringify(validatorUrl)});
          const target = await createDisposableFixture();
          try {
            assert.equal(target.fixtureRoot, await fs.realpath(target.fixtureRoot));
            assert.equal(target.databaseUrl, pathToFileURL(join(target.fixtureRoot, 'test.sqlite')).href);
            await validateFixtureTarget(target);
            console.log('canonical fixture validated');
          } finally {
            await fs.unlink(join(target.fixtureRoot, fixtureMarkerName));
            await fs.rmdir(target.fixtureRoot);
          }
          `
        ],
        { env: { ...process.env, TMPDIR: alias } }
      );
      expect(stdout.trim()).toBe('canonical fixture validated');
    } finally {
      await unlink(alias);
      await rmdir(harness);
    }
  });

  it.each([false, true])(
    'removes only the new root on marker failure (partial marker: %s)',
    async (partialMarker) => {
      const harness = await mkdtemp(
        join(await realpath(tmpdir()), 'langlo-temp-')
      );
      try {
        const { stdout } = await runNode(
          process.execPath,
          [
            '--input-type=module',
            '-e',
            `
            import fs from 'node:fs/promises';
            import assert from 'node:assert/strict';
            import { syncBuiltinESMExports } from 'node:module';
            import { join } from 'node:path';
            const originalWrite = fs.writeFile;
            const sentinel = join(process.env.TMPDIR, 'sentinel.txt');
            await originalWrite(sentinel, 'must survive');
            const failure = new Error('synthetic marker write failure');
            fs.writeFile = async (path, ...args) => {
              if (String(path).endsWith('/.langlo-disposable-fixture')) {
                ${partialMarker ? "await originalWrite(path, 'partial marker');" : ''}
                throw failure;
              }
              return originalWrite(path, ...args);
            };
            syncBuiltinESMExports();
            const { createDisposableFixture } = await import(${JSON.stringify(helperUrl)});
            try {
              await assert.rejects(createDisposableFixture(), (error) => error === failure);
              assert.deepEqual(await fs.readdir(process.env.TMPDIR), ['sentinel.txt']);
              assert.equal(await fs.readFile(sentinel, 'utf8'), 'must survive');
              console.log('owned root cleaned');
            } finally {
              // Test-owned leak cleanup only; never recursively remove a directory.
              for (const entry of await fs.readdir(process.env.TMPDIR)) {
                if (entry.startsWith('langlo-fixture-')) {
                  const root = join(process.env.TMPDIR, entry);
                  await fs.rm(join(root, '.langlo-disposable-fixture'), { force: true });
                  await fs.rmdir(root);
                }
              }
              await fs.unlink(sentinel);
            }
            `
          ],
          { env: { ...process.env, TMPDIR: harness } }
        );
        expect(stdout.trim()).toBe('owned root cleaned');
      } finally {
        await rmdir(harness);
      }
    }
  );
});
