import assert from 'node:assert/strict';
import {
  createDisposableFixture,
  disposeDisposableFixture
} from './database.ts';
import { openFixtureDatabase } from '../../src/lib/server/db/connection.ts';
import { migrateFixtureDatabase } from '../../src/lib/server/db/migrate.ts';

const target = await createDisposableFixture();
try {
  await migrateFixtureDatabase(target);
  const { client, close } = await openFixtureDatabase(target);
  try {
    const tables = (
      await client.execute("SELECT name FROM sqlite_master WHERE type='table'")
    ).rows;
    assert.ok(
      tables.some((row) => row.name === 'attempts'),
      'clean migration must create actual owner-scoped attempts table'
    );
  } finally {
    close();
  }
} finally {
  await disposeDisposableFixture(target);
}
