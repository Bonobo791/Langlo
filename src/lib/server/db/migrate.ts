import { migrate } from 'drizzle-orm/libsql/migrator';
import { openFixtureDatabase, type FixtureTarget } from './connection.ts';

/** Apply checked-in migrations only to an explicitly marked local disposable fixture. */
export async function migrateFixtureDatabase(
  target: FixtureTarget,
  migrationsFolder = 'drizzle'
): Promise<void> {
  const { db, close } = await openFixtureDatabase(target);
  try {
    await migrate(db, { migrationsFolder });
  } finally {
    close();
  }
}
