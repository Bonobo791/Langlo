import fc from 'fast-check';
import type { Transaction } from '@libsql/client/sqlite3';
import { expect, it } from 'vitest';
import { propertyOptions } from './property-options';
import {
  createDisposableFixture,
  disposeDisposableFixture
} from './fixtures/database';
import { seedStudy } from './fixtures/study';
import { openFixtureDatabase } from '../src/lib/server/db/connection';
import { migrateFixtureDatabase } from '../src/lib/server/db/migrate';

/** Capture ordered session/attempt rows so rejected writes and rollback leakage use an independent seeded baseline. */
async function studyState(database: Pick<Transaction, 'batch'>) {
  const results = await database.batch([
    'SELECT * FROM study_sessions ORDER BY id',
    'SELECT * FROM attempts ORDER BY id'
  ]);
  return results.map((result) => result.rows);
}

// DB-01 oracle: attaching owner B to owner A's enrollment is always forbidden.
it('generated foreign enrollment relations create no cross-owner session or attempt side effects', async () => {
  const target = await createDisposableFixture();
  try {
    await migrateFixtureDatabase(target);
    await seedStudy(target);
    const { client, close } = await openFixtureDatabase(target);
    try {
      const baseline = await studyState(client);
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 80 }),
          fc.constantFrom('practice', 'assessment', 'mixed-review'),
          async (foreignSessionId, mode) => {
            // Every generated case and shrink starts from the same seeded rows.
            expect(await studyState(client)).toEqual(baseline);
            const transaction = await client.transaction('write');
            try {
              await expect(
                transaction.execute({
                  sql: 'INSERT INTO study_sessions (id, owner_id, enrollment_id, language, mode) VALUES (?, ?, ?, ?, ?)',
                  args: [
                    `generated:${foreignSessionId}`,
                    'learner-b',
                    'enrollment-a',
                    'fr',
                    mode
                  ]
                })
              ).rejects.toThrow(/FOREIGN KEY/i);
              expect(await studyState(transaction)).toEqual(baseline);

              // Accepted writes make rollback observable even when the rejected
              // cross-owner insert correctly has no side effects.
              const validSessionId = `rollback:${foreignSessionId}`;
              expect(
                (
                  await transaction.execute({
                    sql: 'INSERT INTO study_sessions (id, owner_id, enrollment_id, language, mode) VALUES (?, ?, ?, ?, ?)',
                    args: [
                      validSessionId,
                      'learner-a',
                      'enrollment-a',
                      'fr',
                      mode
                    ]
                  })
                ).rowsAffected
              ).toBe(1);
              expect(
                (
                  await transaction.execute({
                    sql: "INSERT INTO attempts (id, owner_id, study_session_id, question_id, content_version_id, skill_id, language, submission_key, evidence_kind, answer) VALUES ('rollback-attempt', 'learner-a', ?, 'question-1', 'content-v1', 'fr-articles', 'fr', 'rollback-submit', 'independent', 'un')",
                    args: [validSessionId]
                  })
                ).rowsAffected
              ).toBe(1);
            } finally {
              try {
                await transaction.rollback();
              } finally {
                transaction.close();
              }
            }
            expect(await studyState(client)).toEqual(baseline);
          }
        ),
        propertyOptions()
      );
    } finally {
      close();
    }
  } finally {
    await disposeDisposableFixture(target);
  }
}, 10000);
