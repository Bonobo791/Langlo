import {
  createDisposableFixture,
  disposeDisposableFixture,
  resetDisposableFixture
} from './database.ts';
import type { FixtureTarget } from '../../src/lib/server/db/fixture-target.ts';

const usage =
  'Use init, or migrate/seed/reset/dispose with --fixture-root ROOT --database-url file:URL';

function explicitTarget(args: string[]): FixtureTarget {
  if (
    args.length !== 4 ||
    args[0] !== '--fixture-root' ||
    args[2] !== '--database-url'
  ) {
    throw new Error(usage);
  }
  return { fixtureRoot: args[1], databaseUrl: args[3] };
}

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);
  if (command === 'init' && args.length === 0) {
    console.log(JSON.stringify(await createDisposableFixture()));
    return;
  }
  if (!['migrate', 'seed', 'reset', 'dispose'].includes(command))
    throw new Error(usage);
  const target = explicitTarget(args);
  if (command === 'migrate') {
    const { migrateFixtureDatabase } =
      await import('../../src/lib/server/db/migrate.ts');
    await migrateFixtureDatabase(target);
  }
  if (command === 'seed') {
    const { seedStudy } = await import('./study.ts');
    await seedStudy(target);
  }
  if (command === 'reset') await resetDisposableFixture(target);
  if (command === 'dispose') await disposeDisposableFixture(target);
  console.log(`Disposable fixture ${command} completed`);
}

try {
  await main();
} catch {
  // No wrapped DB/FS parameters, supplied URL, secrets, stack or answer text.
  console.error(`Disposable fixture command failed. ${usage}`);
  process.exitCode = 1;
}
