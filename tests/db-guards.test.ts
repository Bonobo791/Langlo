import { afterEach, describe, expect, it } from 'vitest';
import {
  readFile,
  writeFile,
  mkdtemp,
  rm,
  symlink,
  unlink,
  link
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  openFixtureDatabase,
  type FixtureTarget
} from '../src/lib/server/db/connection';
import { migrateFixtureDatabase } from '../src/lib/server/db/migrate';
import {
  createDisposableFixture,
  disposeDisposableFixture,
  resetDisposableFixture
} from './fixtures/database';

const fixtures: FixtureTarget[] = [];
afterEach(async () => {
  await Promise.all(fixtures.splice(0).map(disposeDisposableFixture));
});
async function fixture() {
  const target = await createDisposableFixture();
  fixtures.push(target);
  return target;
}

describe('explicit disposable database target safety', () => {
  it.each([
    'libsql://production.turso.io',
    'https://production.turso.io',
    'wss://localhost:8080',
    ':memory:',
    'file::memory:'
  ])('refuses %s before connection or migration', async (databaseUrl) => {
    const target = { ...(await fixture()), databaseUrl };
    await expect(migrateFixtureDatabase(target)).rejects.toThrow(
      /fixture|local|file/i
    );
  });

  it('rejects outside-root, traversal, query/fragment and remote file authorities', async () => {
    const target = await fixture();
    for (const databaseUrl of [
      pathToFileURL(join(target.fixtureRoot, '../production.sqlite')).href,
      `${target.databaseUrl}?mode=ro`,
      `${target.databaseUrl}#production`,
      'file://production-server/share/test.sqlite',
      `file://${target.fixtureRoot}/%2e%2e/production.sqlite`
    ]) {
      await expect(
        openFixtureDatabase({ ...target, databaseUrl })
      ).rejects.toThrow(/fixture|local|file/i);
      await expect(
        resetDisposableFixture({ ...target, databaseUrl })
      ).rejects.toThrow(/fixture|local|file/i);
    }
  });

  it('requires a real explicit temporary fixture root and its non-symlink marker', async () => {
    const target = await fixture();
    await expect(
      resetDisposableFixture({ ...target, fixtureRoot: tmpdir() })
    ).rejects.toThrow(/fixture/i);
    await expect(
      resetDisposableFixture({ ...target, fixtureRoot: '.' })
    ).rejects.toThrow(/fixture/i);
    await unlink(join(target.fixtureRoot, '.langlo-disposable-fixture'));
    await expect(resetDisposableFixture(target)).rejects.toThrow(/fixture/i);
    await writeFile(
      join(target.fixtureRoot, '.langlo-disposable-fixture'),
      'langlo synthetic fixture v1\n'
    );
  });

  it('refuses symlinked roots, database files and sidecars without touching an outside sentinel', async () => {
    const target = await fixture();
    const outside = await mkdtemp(join(tmpdir(), 'langlo-outside-'));
    const sentinel = join(outside, 'sentinel.sqlite');
    const rootLink = join(outside, 'root-link');
    await writeFile(sentinel, 'must survive');
    try {
      await symlink(target.fixtureRoot, rootLink);
      await expect(
        openFixtureDatabase({
          fixtureRoot: rootLink,
          databaseUrl: pathToFileURL(join(rootLink, 'test.sqlite')).href
        })
      ).rejects.toThrow(/fixture|symlink/i);
      await symlink(sentinel, join(target.fixtureRoot, 'test.sqlite'));
      await expect(openFixtureDatabase(target)).rejects.toThrow(
        /fixture|symlink/i
      );
      await expect(resetDisposableFixture(target)).rejects.toThrow(
        /fixture|symlink/i
      );
      await unlink(join(target.fixtureRoot, 'test.sqlite'));
      await symlink(sentinel, join(target.fixtureRoot, 'test.sqlite-wal'));
      await expect(resetDisposableFixture(target)).rejects.toThrow(
        /fixture|symlink/i
      );
      await unlink(join(target.fixtureRoot, 'test.sqlite-wal'));
      expect(await readFile(sentinel, 'utf8')).toBe('must survive');
    } finally {
      await rm(outside, { recursive: true, force: true });
    }
  });

  it('refuses hard-linked database files and a replaced marker', async () => {
    const target = await fixture();
    const outside = await mkdtemp(join(tmpdir(), 'langlo-outside-'));
    const sentinel = join(outside, 'sentinel.sqlite');
    await writeFile(sentinel, 'must survive');
    try {
      await link(sentinel, join(target.fixtureRoot, 'test.sqlite'));
      await expect(resetDisposableFixture(target)).rejects.toThrow(
        /fixture|link/i
      );
      await unlink(join(target.fixtureRoot, 'test.sqlite'));
      const marker = join(target.fixtureRoot, '.langlo-disposable-fixture');
      await unlink(marker);
      await symlink(sentinel, marker);
      await expect(resetDisposableFixture(target)).rejects.toThrow(
        /fixture|symlink/i
      );
      await unlink(marker);
      await writeFile(marker, 'langlo synthetic fixture v1\n');
      expect(await readFile(sentinel, 'utf8')).toBe('must survive');
    } finally {
      await rm(outside, { recursive: true, force: true });
    }
  });

  it('resets only the explicit fixture database and keeps unrelated files unchanged', async () => {
    const target = await fixture();
    await migrateFixtureDatabase(target);
    const sentinel = join(target.fixtureRoot, 'unrelated.txt');
    await writeFile(sentinel, 'must survive');
    await resetDisposableFixture(target);
    expect(await readFile(sentinel, 'utf8')).toBe('must survive');
    const { client, close } = await openFixtureDatabase(target);
    try {
      expect(
        (
          await client.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
          )
        ).rows
      ).toEqual([]);
    } finally {
      close();
      await unlink(sentinel);
    }
    await migrateFixtureDatabase(target);
    const recreated = await openFixtureDatabase(target);
    try {
      expect(
        (
          await recreated.client.execute(
            "SELECT name FROM sqlite_master WHERE name='attempts'"
          )
        ).rows
      ).toHaveLength(1);
    } finally {
      recreated.close();
    }
  });
});
