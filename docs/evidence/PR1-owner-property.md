# PR 1: owner property fixture isolation and setup cost

Date: 2026-10-06. Local baseline: `de449d2`. Public review head: `a2d7964`.

## Review finding and bounded correction

The [owner-property setup comment](https://github.com/Bonobo791/Langlo/pull/1#discussion_r4200298692) identifies repeated fixture creation, migration, seeding and disposal inside the generated predicate. The default 100 cases passed locally, but the unchanged property timed out when asked to run 1,000 cases under its existing 10,000 ms timeout.

`tests/db-owner.pbt.test.ts` now creates, migrates and seeds one guarded disposable fixture for each property assertion. Each generated case, including shrinking, uses a fresh real libSQL write transaction and rolls it back in `finally`. The client closes before the fixture is disposed; transaction close is a fallback if rollback itself throws.

The original oracle remains: a session owned by learner B cannot reference learner A's enrollment, and rejection leaves every session and attempt row unchanged. Sorted, complete session and attempt snapshots must equal the seeded baseline before each case, immediately after the rejected insert, and after rollback. Each case also accepts a correctly owned session and related attempt, checking that each inserted one row. Both accepted writes must disappear after rollback. These controls make rollback leakage observable even when the cross-owner rejection correctly writes nothing.

The input domain is unchanged: strings of length 1–80 and all three session modes. The default remains 100 cases; strict `FC_NUM_RUNS`, `FC_SEED` and `FC_PATH` validation is unchanged. Neither the property timeout nor the global test timeout was increased. The property correction changes no production behavior, migration, dependency, package setting or prepared-study source. The integrated follow-up also adds JSDoc to production modules and test helpers; those additions are comments only.

## Observed RED and GREEN

Node 24.19.0, npm 11.9.0, existing pinned dependencies, synthetic disposable local SQLite fixtures. Vitest duration includes its startup and test work; shell elapsed additionally includes npm startup. Local timings do not establish a CI runtime guarantee.

- Baseline, `FC_SEED=20261006 npm test -- tests/db-owner.pbt.test.ts`: exit 0, 1/1 test, default 100 cases, Vitest 4.21 s, shell 5.113 s
- RED before editing, `FC_NUM_RUNS=1000 FC_SEED=20261006 npm test -- tests/db-owner.pbt.test.ts`: exit 1, `Test timed out in 10000ms`, reported test time 10,010 ms, Vitest 10.49 s, shell 11.377 s
- GREEN final patch, same 1,000-case command, seed and timeout: exit 0, 1/1 test, Vitest 8.31 s, shell 9.133 s
- GREEN final patch, same default-100 command as the baseline: exit 0, 1/1 test, Vitest 1.45 s, shell 2.196 s
- `FC_SEED=20261006 npm test -- tests/db-owner.pbt.test.ts tests/property-options.test.ts`: exit 0, 2/2 tests, including strict replay-control validation, Vitest 1.76 s

## Deliberate fault sensitivity

Two private temporary copies reused the installed Vitest and pinned dependencies. Each ran `FC_NUM_RUNS=100 FC_SEED=20261006 node node_modules/vitest/vitest.mjs run tests/db-owner.pbt.test.ts` from that copy, with the same generator and 10,000 ms timeout. The checked-in migrations and source were never mutated for these experiments.

- Removing only the actual composite `study_sessions(enrollment_id, owner_id, language)` foreign key from the copied initial migration caused exit 1 after the first case. The rejected-insert assertion reported that the promise resolved with one inserted row instead of rejecting. It shrank twice to `[" ", "practice"]`, seed `20261006`, replay path `0:0:0`; Vitest 1.14 s
- Replacing only the copied property transaction's rollback with commit caused exit 1 after the first case. The baseline comparison exposed both the accepted session and accepted attempt that leaked into subsequent state. It shrank twice to `[" ", "practice"]`, seed `20261006`, replay path `0:0:0`; Vitest 3.53 s

These failures establish sensitivity to the concrete ownership-FK fault and loss of per-case rollback isolation. They are separate from the timeout RED.

## Property-only repository verification

These checks were observed on the property correction before the separate JSDoc and evidence-documentation changes were integrated. Final integrated verification is recorded in [PR1-remaining-comments.md](PR1-remaining-comments.md). In particular, the last comparison below was clean at this earlier stage; `tests/property-options.ts` subsequently received a JSDoc comment.

- `npm test`: exit 0, 121/121 tests across 14 files, Vitest 27.70 s, shell 28.603 s
- `npm run test:property`: exit 0, 3/3 properties across two files, default 100 cases each, Vitest 2.44 s
- `npm run check`: exit 0, zero errors and zero warnings
- `npm run lint`: exit 0
- `npm run format:check`: exit 0
- `git diff --check`: exit 0
- `git diff --exit-code -- drizzle tests/property-options.ts tests/property-options.test.ts package.json package-lock.json vitest.config.ts`: exit 0

No install, provider call, account access, production database, remote publication, review-thread resolution or merge was performed. This is local test evidence; remote CI and rendered browser acceptance remain separate.
