import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { cp, mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import assert from 'node:assert/strict';
import { expect, it } from 'vitest';
import {
  createDisposableFixture,
  disposeDisposableFixture
} from './fixtures/database';
import { seedStudy } from './fixtures/study';
import {
  openFixtureDatabase,
  type FixtureTarget
} from '../src/lib/server/db/connection';
import { migrateFixtureDatabase } from '../src/lib/server/db/migrate';
import { createSourceId } from '../src/lib/server/db/source-id';

const mistake = 'indefinite-article-gender';
interface WriterResult {
  pid: number;
  rowsAffected: number;
  sourceId: string;
}
interface Writer {
  process: ChildProcessWithoutNullStreams;
  ready: Promise<number>;
  completed: Promise<WriterResult>;
  exited: Promise<void>;
  release(): void;
  stop(): void;
}

/** Start one guarded Node writer with bounded ready/release/exit coordination and explicit cleanup controls. */
function startWriter(
  target: FixtureTarget,
  proposedId: string,
  ownerId: string
): Writer {
  const child = spawn(
    process.execPath,
    [
      'tests/fixtures/concurrent-writer.ts',
      target.fixtureRoot,
      target.databaseUrl,
      proposedId,
      ownerId,
      mistake
    ],
    { stdio: 'pipe' }
  );
  const lines = createInterface({ input: child.stdout });
  let readyResolve!: (pid: number) => void;
  let readyReject!: (error: Error) => void;
  let completedResolve!: (result: WriterResult) => void;
  let completedReject!: (error: Error) => void;
  let exitedResolve!: () => void;
  let exitedReject!: (error: Error) => void;
  const ready = new Promise<number>((resolve, reject) => {
    readyResolve = resolve;
    readyReject = reject;
  });
  const completed = new Promise<WriterResult>((resolve, reject) => {
    completedResolve = resolve;
    completedReject = reject;
  });
  const exited = new Promise<void>((resolve, reject) => {
    exitedResolve = resolve;
    exitedReject = reject;
  });
  // Attach rejection handlers immediately so an early child failure does not leak unhandled rejections.
  void ready.catch(() => {});
  void completed.catch(() => {});
  void exited.catch(() => {});
  let didReady = false;
  let didComplete = false;
  let failureOutput = '';
  let timer = setTimeout(
    () => fail(new Error('Concurrent fixture writer startup timed out')),
    10000
  );
  /** Reject readiness/result promises and kill the failed child; exit handlers complete cleanup reporting. */
  function fail(error: Error) {
    clearTimeout(timer);
    readyReject(error);
    completedReject(error);
    child.kill('SIGKILL');
  }
  child.stderr.on('data', (data: Buffer) => {
    failureOutput = `${failureOutput}${data.toString()}`.slice(-4096);
  });
  child.on('error', fail);
  child.stdin.on('error', fail);
  lines.on('line', (line) => {
    try {
      const message = JSON.parse(line) as WriterResult & { event: string };
      if (message.event === 'ready') {
        didReady = true;
        clearTimeout(timer);
        readyResolve(message.pid);
      } else if (message.event === 'completed') {
        didComplete = true;
        completedResolve(message);
      } else {
        fail(new Error('Unexpected fixture writer event'));
      }
    } catch {
      fail(new Error('Malformed fixture writer event'));
    }
  });
  child.on('close', (code, signal) => {
    clearTimeout(timer);
    lines.close();
    if (code !== 0 || signal || !didReady || !didComplete) {
      const error = new Error(
        `Concurrent fixture writer failed (${code ?? signal}): ${failureOutput}`
      );
      readyReject(error);
      completedReject(error);
      exitedReject(error);
    } else {
      exitedResolve();
    }
  });
  return {
    process: child,
    ready,
    completed,
    exited,
    release() {
      timer = setTimeout(
        () =>
          fail(new Error('Concurrent fixture writer insertion/exit timed out')),
        5000
      );
      child.stdin.end('release\n');
    },
    stop() {
      clearTimeout(timer);
      if (child.exitCode === null) child.kill('SIGKILL');
      lines.close();
    }
  };
}

/** Release independent fixture writers at one barrier, then collect insert effects and persisted identities. */
async function raceWriters(
  target: FixtureTarget,
  counts: { ownerA: number; ownerB: number }
) {
  const writers = [
    ...Array.from({ length: counts.ownerA }, (_, index) =>
      startWriter(target, `proposed-a-${index}`, 'learner-a')
    ),
    ...Array.from({ length: counts.ownerB }, (_, index) =>
      startWriter(target, `proposed-b-${index}`, 'learner-b')
    )
  ];
  try {
    const pids = await Promise.all(writers.map((writer) => writer.ready));
    expect(new Set(pids).size).toBe(writers.length);
    expect(pids).not.toContain(process.pid);
    const before = await openFixtureDatabase(target);
    try {
      expect(
        (await before.client.execute('SELECT * FROM card_drafts')).rows
      ).toEqual([]);
    } finally {
      before.close();
    }
    // All child connections have signaled readiness; none has permission to insert before this release.
    writers.forEach((writer) => writer.release());
    const completed = await Promise.all(
      writers.map((writer) => writer.completed)
    );
    await Promise.all(writers.map((writer) => writer.exited));
    const after = await openFixtureDatabase(target);
    try {
      const rows = (
        await after.client.execute(
          'SELECT owner_id, source_id FROM card_drafts ORDER BY owner_id, id'
        )
      ).rows;
      return { completed, rows };
    } finally {
      after.close();
    }
  } finally {
    writers.forEach((writer) => writer.stop());
    await Promise.allSettled(writers.map((writer) => writer.exited));
  }
}

/** Apply the same one-identity/one-insert oracle to genuine constraints and private missing-uniqueness faults. */
function assertSingleOwnerIdentity(
  result: Awaited<ReturnType<typeof raceWriters>>
) {
  assert.equal(
    result.rows.filter((row) => row.owner_id === 'learner-a').length,
    1,
    'concurrent duplicate writers must persist one owner-A identity'
  );
  assert.equal(
    result.completed
      .filter(
        (row) =>
          row.sourceId ===
          createSourceId({
            ownerId: 'learner-a',
            language: 'fr',
            skillId: 'fr-articles',
            canonicalMistake: mistake
          })
      )
      .reduce((sum, row) => sum + row.rowsAffected, 0),
    1,
    'duplicate insert effects must total one'
  );
}

it('separate ready/released Node processes persist one duplicate identity and a distinct other-owner identity', async () => {
  const target = await createDisposableFixture();
  try {
    await migrateFixtureDatabase(target);
    await seedStudy(target);
    const result = await raceWriters(target, { ownerA: 3, ownerB: 1 });
    assertSingleOwnerIdentity(result);
    expect(result.rows).toEqual([
      {
        owner_id: 'learner-a',
        source_id: createSourceId({
          ownerId: 'learner-a',
          language: 'fr',
          skillId: 'fr-articles',
          canonicalMistake: mistake
        })
      },
      {
        owner_id: 'learner-b',
        source_id: createSourceId({
          ownerId: 'learner-b',
          language: 'fr',
          skillId: 'fr-articles',
          canonicalMistake: mistake
        })
      }
    ]);
  } finally {
    await disposeDisposableFixture(target);
  }
}, 20000);

it('the same concurrency oracle detects removed SQL uniqueness in a disposable migration copy', async () => {
  const target = await createDisposableFixture();
  const copy = await mkdtemp(join(tmpdir(), 'langlo-concurrency-fault-'));
  try {
    await cp('drizzle', copy, { recursive: true });
    const file = join(copy, '0001_card_delivery_identity.sql');
    const original = await readFile(file, 'utf8');
    const fault = original.replace(
      /CREATE UNIQUE INDEX `card_drafts_(?:canonical_identity_unique|source_unique)`[^;]+;/g,
      'SELECT 1;'
    );
    expect(fault).not.toBe(original);
    expect(
      (
        original.match(
          /CREATE UNIQUE INDEX `card_drafts_(?:canonical_identity_unique|source_unique)`/g
        ) ?? []
      ).length
    ).toBe(2);
    await writeFile(file, fault);
    await migrateFixtureDatabase(target, copy);
    await seedStudy(target);
    const result = await raceWriters(target, { ownerA: 2, ownerB: 0 });
    expect(result.rows).toHaveLength(2);
    expect(
      result.completed.reduce((sum, row) => sum + row.rowsAffected, 0)
    ).toBe(2);
    expect(() => assertSingleOwnerIdentity(result)).toThrow(
      'concurrent duplicate writers must persist one owner-A identity'
    );
  } finally {
    await disposeDisposableFixture(target);
    await rm(copy, { recursive: true, force: true });
  }
}, 20000);
