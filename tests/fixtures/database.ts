import {
  mkdtemp,
  writeFile,
  rm,
  readdir,
  unlink,
  rmdir
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  fixtureMarkerName,
  fixtureMarkerContent,
  fixtureDatabaseName,
  fixtureDatabaseFiles,
  validateFixtureTarget,
  type FixtureTarget
} from '../../src/lib/server/db/fixture-target.ts';

export async function createDisposableFixture(): Promise<FixtureTarget> {
  const fixtureRoot = await mkdtemp(join(tmpdir(), 'langlo-fixture-'));
  await writeFile(join(fixtureRoot, fixtureMarkerName), fixtureMarkerContent, {
    mode: 0o600
  });
  return {
    fixtureRoot,
    databaseUrl: pathToFileURL(join(fixtureRoot, fixtureDatabaseName)).href
  };
}

/** Caller closes every connection first. No recursive deletion, ambient target or production URL. */
export async function resetDisposableFixture(
  target: FixtureTarget
): Promise<void> {
  const { rootPath } = await validateFixtureTarget(target);
  for (const file of fixtureDatabaseFiles)
    await rm(join(rootPath, file), { force: true });
}

export async function disposeDisposableFixture(
  target: FixtureTarget
): Promise<void> {
  const { rootPath } = await validateFixtureTarget(target);
  const allowed = new Set<string>([fixtureMarkerName, ...fixtureDatabaseFiles]);
  const entries = await readdir(rootPath);
  if (entries.some((entry) => !allowed.has(entry)))
    throw new Error('Disposable fixture cleanup refused unexpected files');
  await resetDisposableFixture(target);
  await unlink(join(rootPath, fixtureMarkerName));
  await rmdir(rootPath);
}
