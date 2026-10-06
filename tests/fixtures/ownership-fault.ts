// Deliberate local fault experiment; expected exit 1. Never changes checked-in migrations.
import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  createDisposableFixture,
  disposeDisposableFixture
} from './database.ts';
import { seedStudy } from './study.ts';
import { openFixtureDatabase } from '../../src/lib/server/db/connection.ts';
import { migrateFixtureDatabase } from '../../src/lib/server/db/migrate.ts';

const copy = await mkdtemp(join(tmpdir(), 'langlo-fault-migrations-'));
const target = await createDisposableFixture();
try {
  await cp('drizzle', copy, { recursive: true });
  const file = join(copy, '0000_initial_study.sql');
  const original = await readFile(file, 'utf8');
  const fault = original.replace(
    /^\s*FOREIGN KEY \(`enrollment_id`,`owner_id`,`language`\) REFERENCES `enrollments`.*\n/m,
    ''
  );
  assert.notEqual(
    fault,
    original,
    'fault must remove actual composite ownership constraint'
  );
  await writeFile(file, fault);
  await migrateFixtureDatabase(target, copy);
  await seedStudy(target);
  const { client, close } = await openFixtureDatabase(target);
  try {
    await assert.rejects(
      client.execute(
        "INSERT INTO study_sessions (id, owner_id, enrollment_id, language, mode) VALUES ('forged', 'learner-b', 'enrollment-a', 'fr', 'practice')"
      ),
      /FOREIGN KEY/i,
      'ownership invariant must detect deleted composite FK'
    );
  } finally {
    close();
  }
} finally {
  await disposeDisposableFixture(target);
  await rm(copy, { recursive: true, force: true });
}
