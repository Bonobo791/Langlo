import { afterEach, describe, expect, it } from 'vitest';
import {
  mkdtemp,
  readFile,
  writeFile,
  mkdir,
  copyFile,
  rm
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  openFixtureDatabase,
  type FixtureTarget
} from '../src/lib/server/db/connection';
import { migrateFixtureDatabase } from '../src/lib/server/db/migrate';
import {
  createDisposableFixture,
  disposeDisposableFixture
} from './fixtures/database';
import { seedStudy } from './fixtures/study';
import * as schema from '../src/lib/server/db/schema';

const fixtures: FixtureTarget[] = [];
afterEach(async () => {
  await Promise.all(fixtures.splice(0).map(disposeDisposableFixture));
});

async function fixture() {
  const target = await createDisposableFixture();
  fixtures.push(target);
  return target;
}

describe('disposable libSQL migrations', () => {
  it('fails a hardening upgrade closed when the previous schema contains a text version', async () => {
    const target = await fixture();
    const previous = await mkdtemp(join(tmpdir(), 'langlo-migrations-'));
    try {
      const journal = JSON.parse(
        await readFile('drizzle/meta/_journal.json', 'utf8')
      );
      journal.entries = journal.entries.slice(0, 2);
      await mkdir(join(previous, 'meta'));
      await writeFile(
        join(previous, 'meta/_journal.json'),
        JSON.stringify(journal)
      );
      for (const entry of journal.entries) {
        await copyFile(
          `drizzle/${entry.tag}.sql`,
          join(previous, `${entry.tag}.sql`)
        );
      }
      await migrateFixtureDatabase(target, previous);
      await seedStudy(target);
      const old = await openFixtureDatabase(target);
      await old.client.execute(
        "UPDATE content_versions SET version='invalid-text' WHERE id='content-v1'"
      );
      const before = (await old.client.execute('SELECT * FROM attempts')).rows;
      old.close();
      await expect(migrateFixtureDatabase(target)).rejects.toThrow(
        /CHECK|CONSTRAINT/i
      );
      const unchanged = await openFixtureDatabase(target);
      try {
        expect(
          (
            await unchanged.client.execute(
              'SELECT count(*) AS n FROM __drizzle_migrations'
            )
          ).rows[0].n
        ).toBe(2);
        expect(
          (await unchanged.client.execute('SELECT * FROM attempts')).rows
        ).toEqual(before);
        expect(
          (
            await unchanged.client.execute(
              "SELECT version FROM content_versions WHERE id='content-v1'"
            )
          ).rows[0].version
        ).toBe('invalid-text');
      } finally {
        unchanged.close();
      }
    } finally {
      await rm(previous, { recursive: true, force: true });
    }
  });
  it('creates authentic owner/versioned study and card tables on a clean database', async () => {
    const target = await fixture();
    await migrateFixtureDatabase(target);
    const { client, close } = await openFixtureDatabase(target);
    try {
      const result = await client.execute(
        "SELECT name FROM sqlite_master WHERE type='table'"
      );
      expect(result.rows.map((row) => row.name)).toEqual(
        expect.arrayContaining([
          'users',
          'enrollments',
          'skills',
          'prerequisites',
          'content_versions',
          'questions',
          'study_sessions',
          'attempts',
          'evaluations',
          'skill_evidence',
          'card_drafts',
          'deliveries'
        ])
      );
      expect(
        (await client.execute('PRAGMA foreign_keys')).rows[0].foreign_keys
      ).toBe(1);
    } finally {
      close();
    }
  });

  it('matches every Drizzle table export to the actual migrated columns', async () => {
    const target = await fixture();
    await migrateFixtureDatabase(target);
    const { db, close } = await openFixtureDatabase(target);
    try {
      for (const table of Object.values(schema)) {
        expect(await db.select().from(table)).toEqual([]);
      }
    } finally {
      close();
    }
  });

  it('repeating all migrations preserves existing rows and records each migration once', async () => {
    const target = await fixture();
    await migrateFixtureDatabase(target);
    await seedStudy(target);
    await migrateFixtureDatabase(target);
    const { client, close } = await openFixtureDatabase(target);
    try {
      expect(
        (
          await client.execute(
            'SELECT owner_id, content_version_id, evidence_kind FROM attempts'
          )
        ).rows
      ).toEqual([
        {
          owner_id: 'learner-a',
          content_version_id: 'content-v1',
          evidence_kind: 'independent'
        }
      ]);
      expect(
        (
          await client.execute(
            'SELECT count(*) AS count FROM __drizzle_migrations'
          )
        ).rows[0].count
      ).toBe(3);
    } finally {
      close();
    }
  });

  it('upgrades the supported initial schema without changing owned attempts or evaluations', async () => {
    const target = await fixture();
    const previous = await mkdtemp(join(tmpdir(), 'langlo-migrations-'));
    try {
      const journal = JSON.parse(
        await readFile('drizzle/meta/_journal.json', 'utf8')
      );
      journal.entries = journal.entries.slice(0, 1);
      await mkdir(join(previous, 'meta'));
      await writeFile(
        join(previous, 'meta/_journal.json'),
        JSON.stringify(journal)
      );
      await copyFile(
        `drizzle/${journal.entries[0].tag}.sql`,
        join(previous, `${journal.entries[0].tag}.sql`)
      );
      await migrateFixtureDatabase(target, previous);
      await seedStudy(target);
      const beforeDb = await openFixtureDatabase(target);
      const beforeAttempts = (
        await beforeDb.client.execute('SELECT * FROM attempts')
      ).rows;
      const beforeEvaluations = (
        await beforeDb.client.execute('SELECT * FROM evaluations')
      ).rows;
      beforeDb.close();
      await migrateFixtureDatabase(target);
      const { client, close } = await openFixtureDatabase(target);
      try {
        expect((await client.execute('SELECT * FROM attempts')).rows).toEqual(
          beforeAttempts
        );
        expect(
          (await client.execute('SELECT * FROM evaluations')).rows
        ).toEqual(beforeEvaluations);
        expect(
          (
            await client.execute(
              "SELECT name FROM sqlite_master WHERE name='deliveries'"
            )
          ).rows
        ).toHaveLength(1);
        expect((await client.execute('PRAGMA foreign_key_check')).rows).toEqual(
          []
        );
      } finally {
        close();
      }
    } finally {
      await rm(previous, { recursive: true, force: true });
    }
  });
});
