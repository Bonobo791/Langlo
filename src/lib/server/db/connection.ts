import { createClient } from '@libsql/client/sqlite3';
import { validateFixtureTarget, type FixtureTarget } from './fixture-target.ts';
export { validateFixtureTarget, type FixtureTarget } from './fixture-target.ts';

/** Guarded sqlite3-only seam for SQL-only fixture operations. No ORM/schema initialization. */
export async function openFixtureClient(target: FixtureTarget) {
  await validateFixtureTarget(target);
  // The sqlite3-only client cannot connect to a network endpoint, even if the guard regresses.
  const client = createClient({ url: target.databaseUrl });
  try {
    await client.execute('PRAGMA foreign_keys = ON');
    await client.execute('PRAGMA busy_timeout = 5000');
    return { client, close: () => client.close() };
  } catch (error) {
    client.close();
    throw error;
  }
}

/** Local fixtures only. Never reads ambient DATABASE_URL or accepts credentials. */
export async function openFixtureDatabase(target: FixtureTarget) {
  const { client, close } = await openFixtureClient(target);
  try {
    const [{ drizzle }, schema] = await Promise.all([
      import('drizzle-orm/libsql'),
      import('./schema.ts')
    ]);
    return { client, db: drizzle(client, { schema }), close };
  } catch (error) {
    close();
    throw error;
  }
}
