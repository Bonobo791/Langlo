import {
  mkdtemp,
  realpath,
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

/** Create a canonical marked private temporary root; marker failure cleans only this newly owned root. */
export async function createDisposableFixture(): Promise<FixtureTarget> {
  const fixtureRoot = await mkdtemp(
    join(await realpath(tmpdir()), 'langlo-fixture-')
  );
  try {
    await writeFile(
      join(fixtureRoot, fixtureMarkerName),
      fixtureMarkerContent,
      {
        mode: 0o600
      }
    );
  } catch (error) {
    // Only this call's newly created marker and empty root are owned here.
    await rm(join(fixtureRoot, fixtureMarkerName), { force: true });
    await rmdir(fixtureRoot);
    throw error;
  }
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

/** After clients close, remove a validated fixture only when it contains its marker and known database files. */
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
