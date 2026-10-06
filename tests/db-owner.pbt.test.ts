import fc from 'fast-check';
import { expect, it } from 'vitest';
import { propertyOptions } from './property-options';
import {
  createDisposableFixture,
  disposeDisposableFixture
} from './fixtures/database';
import { seedStudy } from './fixtures/study';
import { openFixtureDatabase } from '../src/lib/server/db/connection';
import { migrateFixtureDatabase } from '../src/lib/server/db/migrate';

// DB-01 oracle: attaching owner B to owner A's enrollment is always forbidden.
it('generated foreign enrollment relations create no cross-owner session or attempt side effects', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.string({ minLength: 1, maxLength: 80 }),
      fc.constantFrom('practice', 'assessment', 'mixed-review'),
      async (foreignSessionId, mode) => {
        const target = await createDisposableFixture();
        try {
          await migrateFixtureDatabase(target);
          await seedStudy(target);
          const { client, close } = await openFixtureDatabase(target);
          try {
            const beforeSessions = (
              await client.execute('SELECT * FROM study_sessions ORDER BY id')
            ).rows;
            const beforeAttempts = (
              await client.execute('SELECT * FROM attempts ORDER BY id')
            ).rows;
            await expect(
              client.execute({
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
            expect(
              (await client.execute('SELECT * FROM study_sessions ORDER BY id'))
                .rows
            ).toEqual(beforeSessions);
            expect(
              (await client.execute('SELECT * FROM attempts ORDER BY id')).rows
            ).toEqual(beforeAttempts);
          } finally {
            close();
          }
        } finally {
          await disposeDisposableFixture(target);
        }
      }
    ),
    propertyOptions()
  );
}, 10000);
