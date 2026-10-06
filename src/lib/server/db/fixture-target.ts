import { lstat, readFile, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export interface FixtureTarget {
  fixtureRoot: string;
  databaseUrl: string;
}

export const fixtureMarkerName = '.langlo-disposable-fixture';
export const fixtureMarkerContent = 'langlo synthetic fixture v1\n';
export const fixtureDatabaseName = 'test.sqlite';
export const fixtureDatabaseFiles = [
  fixtureDatabaseName,
  `${fixtureDatabaseName}-wal`,
  `${fixtureDatabaseName}-shm`,
  `${fixtureDatabaseName}-journal`
] as const;

function rejected(): Error {
  // Deliberately omit supplied paths, URLs, tokens and wrapped filesystem errors.
  return new Error(
    'Invalid disposable fixture: use its explicit local file database and temporary fixture root'
  );
}

async function regularPrivateFile(
  path: string,
  optional = false
): Promise<void> {
  try {
    const stat = await lstat(path);
    if (
      !stat.isFile() ||
      stat.isSymbolicLink() ||
      stat.nlink !== 1 ||
      (await realpath(path)) !== path
    )
      throw rejected();
    if (process.getuid && stat.uid !== process.getuid()) throw rejected();
  } catch (error) {
    if (optional && (error as NodeJS.ErrnoException).code === 'ENOENT') return;
    throw rejected();
  }
}

export async function validateFixtureTarget(
  target: FixtureTarget
): Promise<{ rootPath: string; databasePath: string }> {
  try {
    const rootPath = target.fixtureRoot;
    if (
      typeof rootPath !== 'string' ||
      !isAbsolute(rootPath) ||
      resolve(rootPath) !== rootPath
    )
      throw rejected();
    if (!/^langlo-fixture-[A-Za-z0-9_-]+$/.test(basename(rootPath)))
      throw rejected();
    const temporaryRoot = await realpath(tmpdir());
    if (
      dirname(rootPath) !== temporaryRoot ||
      (await realpath(rootPath)) !== rootPath
    )
      throw rejected();
    const root = await lstat(rootPath);
    if (
      !root.isDirectory() ||
      root.isSymbolicLink() ||
      (root.mode & 0o077) !== 0
    )
      throw rejected();
    if (process.getuid && root.uid !== process.getuid()) throw rejected();
    const marker = join(rootPath, fixtureMarkerName);
    await regularPrivateFile(marker);
    if ((await readFile(marker, 'utf8')) !== fixtureMarkerContent)
      throw rejected();
    if (typeof target.databaseUrl !== 'string') throw rejected();
    const url = new URL(target.databaseUrl);
    if (
      url.protocol !== 'file:' ||
      url.host ||
      url.search ||
      url.hash ||
      url.username ||
      url.password
    )
      throw rejected();
    const databasePath = join(rootPath, fixtureDatabaseName);
    if (
      fileURLToPath(url) !== databasePath ||
      target.databaseUrl !== pathToFileURL(databasePath).href
    )
      throw rejected();
    for (const file of fixtureDatabaseFiles)
      await regularPrivateFile(join(rootPath, file), true);
    return { rootPath, databasePath };
  } catch {
    throw rejected();
  }
}
