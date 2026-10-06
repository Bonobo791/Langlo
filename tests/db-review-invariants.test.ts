import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  openFixtureDatabase,
  type FixtureTarget
} from '../src/lib/server/db/connection';
import { migrateFixtureDatabase } from '../src/lib/server/db/migrate';
import { createSourceId } from '../src/lib/server/db/source-id';
import {
  createDisposableFixture,
  disposeDisposableFixture
} from './fixtures/database';
import { seedStudy } from './fixtures/study';

let target: FixtureTarget;
beforeEach(async () => {
  target = await createDisposableFixture();
  await migrateFixtureDatabase(target);
  await seedStudy(target);
});
afterEach(async () => {
  await disposeDisposableFixture(target);
});

const identity = {
  ownerId: 'learner-a',
  language: 'fr',
  skillId: 'fr-articles',
  canonicalMistake: 'article-gender'
};
// ECMAScript String.trim whitespace, including Unicode space separators and BOM.
const whitespace =
  '\u0009\u000a\u000b\u000c\u000d\u0020\u00a0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u2028\u2029\u202f\u205f\u3000\ufeff';

describe('reviewed persisted identity and track invariants', () => {
  it.each(['ownerId', 'language', 'skillId', 'canonicalMistake'] as const)(
    'rejects embedded NUL in SourceID %s before hashing',
    (field) => {
      for (const value of ['\0x', 'x\0']) {
        expect(() => createSourceId({ ...identity, [field]: value })).toThrow(
          /identity/i
        );
      }
    }
  );

  it('accepts all five supported enrollment pairs', async () => {
    const { client, close } = await openFixtureDatabase(target);
    try {
      const pairs = [
        ['fr', 'A1'],
        ['de', 'A1'],
        ['de', 'A2'],
        ['en', 'A1'],
        ['en', 'A2']
      ];
      for (const [index, [language, level]] of pairs.entries()) {
        await client.execute({
          sql: 'INSERT INTO users (id) VALUES (?)',
          args: [`track-owner-${index}`]
        });
        await client.execute({
          sql: 'INSERT INTO enrollments (id, owner_id, language, starting_level, explanation_language) VALUES (?, ?, ?, ?, ?)',
          args: [
            `track-${index}`,
            `track-owner-${index}`,
            language,
            level,
            language === 'en' ? 'pt' : 'en'
          ]
        });
      }
      expect(
        (
          await client.execute(
            "SELECT count(*) AS n FROM enrollments WHERE id LIKE 'track-%'"
          )
        ).rows[0].n
      ).toBe(5);
    } finally {
      close();
    }
  });

  it.each(['INSERT', 'UPDATE', 'REPLACE'] as const)(
    'rejects French A2 through %s without changing historical rows',
    async (operation) => {
      const { client, close } = await openFixtureDatabase(target);
      try {
        await client.execute(
          "INSERT INTO users (id) VALUES ('unsupported-track-owner')"
        );
        const before = (
          await client.execute('SELECT * FROM enrollments ORDER BY id')
        ).rows;
        const attempts = (await client.execute('SELECT * FROM attempts')).rows;
        const statements = {
          INSERT:
            "INSERT INTO enrollments (id, owner_id, language, starting_level, explanation_language) VALUES ('unsupported-track', 'unsupported-track-owner', 'fr', 'A2', 'en')",
          UPDATE:
            "UPDATE enrollments SET starting_level='A2' WHERE id='enrollment-a'",
          REPLACE:
            "REPLACE INTO enrollments (id, owner_id, language, starting_level, explanation_language) VALUES ('enrollment-a', 'learner-a', 'fr', 'A2', 'en')"
        };
        await expect(client.execute(statements[operation])).rejects.toThrow(
          /supported track/i
        );
        expect(
          (await client.execute('SELECT * FROM enrollments ORDER BY id')).rows
        ).toEqual(before);
        expect((await client.execute('SELECT * FROM attempts')).rows).toEqual(
          attempts
        );
      } finally {
        close();
      }
    }
  );

  it('rejects whitespace-only and NUL-containing persisted SourceID text', async () => {
    const { client, close } = await openFixtureDatabase(target);
    try {
      for (const value of [...whitespace, whitespace, '\0x', 'x\0']) {
        for (const statement of [
          { sql: 'INSERT INTO users (id) VALUES (?)', args: [value] },
          {
            sql: "INSERT INTO skills (id, language, level) VALUES (?, 'fr', 'A1')",
            args: [value]
          },
          {
            sql: "INSERT INTO card_drafts (id, owner_id, language, skill_id, canonical_mistake, source_id, format, fields_json) VALUES ('invalid-card', 'learner-a', 'fr', 'fr-articles', ?, ?, 'cloze', '{}')",
            args: [value, createSourceId(identity)]
          }
        ]) {
          await expect(client.execute(statement)).rejects.toThrow(/identity/i);
        }
      }
      expect((await client.execute('SELECT * FROM card_drafts')).rows).toEqual(
        []
      );
    } finally {
      close();
    }
  });

  it('guards direct identity updates and replacements while preserving exact nonblank text', async () => {
    const { client, close } = await openFixtureDatabase(target);
    const canonicalMistake = `${whitespace}nonblank${whitespace}`;
    try {
      await client.execute("INSERT INTO users (id) VALUES ('isolated-owner')");
      await client.execute(
        "INSERT INTO skills (id, language, level) VALUES ('isolated-skill', 'fr', 'A1')"
      );
      const sourceId = createSourceId({ ...identity, canonicalMistake });
      await client.execute({
        sql: "INSERT INTO card_drafts (id, owner_id, language, skill_id, canonical_mistake, source_id, format, fields_json) VALUES ('card-a', 'learner-a', 'fr', 'fr-articles', ?, ?, 'cloze', '{}')",
        args: [canonicalMistake, sourceId]
      });
      for (const value of ['\t\u00a0', 'x\0']) {
        for (const statement of [
          {
            sql: "UPDATE users SET id=? WHERE id='isolated-owner'",
            args: [value]
          },
          {
            sql: "UPDATE skills SET id=? WHERE id='isolated-skill'",
            args: [value]
          },
          { sql: 'REPLACE INTO users (id) VALUES (?)', args: [value] },
          {
            sql: "REPLACE INTO skills (id, language, level) VALUES (?, 'fr', 'A1')",
            args: [value]
          },
          {
            sql: "REPLACE INTO card_drafts (id, owner_id, language, skill_id, canonical_mistake, source_id, format, fields_json) VALUES ('card-a', 'learner-a', 'fr', 'fr-articles', ?, ?, 'cloze', '{}')",
            args: [value, sourceId]
          },
          {
            sql: "UPDATE card_drafts SET canonical_mistake=? WHERE id='card-a'",
            args: [value]
          }
        ]) {
          await expect(client.execute(statement)).rejects.toThrow(/identity/i);
        }
      }
      expect(
        (
          await client.execute(
            "SELECT canonical_mistake, source_id FROM card_drafts WHERE id='card-a'"
          )
        ).rows
      ).toEqual([{ canonical_mistake: canonicalMistake, source_id: sourceId }]);
      expect((await client.execute('PRAGMA foreign_key_check')).rows).toEqual(
        []
      );
    } finally {
      close();
    }
  });
});
