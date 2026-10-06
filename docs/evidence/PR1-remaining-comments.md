# PR 1: remaining review dispositions

Date: 2026-10-06. Reviewed public head: `a2d7964a3cf785ff2360cd9c17273222518495cc`, tree `68ab53c3b5e6c9b206ce1cb90b1fdddeec140c7a`. This records a local follow-up bundle, not a published commit or a review-thread resolution.

## Complete current inline review

The fresh PR snapshot has 21 inline threads: six unresolved and 15 resolved. Consolidated reviews and standalone comments were also inspected. The six unresolved findings have these dispositions:

1. [Empty production origin](https://github.com/Bonobo791/Langlo/pull/1#discussion_r4200226670): no change. Missing, empty and whitespace-only origins fail `new URL` and produce the fixed `ConfigError: Invalid APP_ORIGIN` before a configuration can be returned. Existing configuration tests cover these exact cases and redaction. The suggested fallback is not an accepted production origin.
2. [Property fixture setup cost](https://github.com/Bonobo791/Langlo/pull/1#discussion_r4200298692): corrected locally. One guarded fixture is migrated and seeded per property assertion. Every generated case and shrink uses a fresh real write transaction with rollback and complete session/attempt baseline comparisons. Valid owned writes make lost rollback observable. The generator, default 100 cases, replay controls and 10-second timeout are unchanged. See [observed timeout RED, GREEN and deliberate faults](PR1-owner-property.md).
3. [Timestamp resolution](https://github.com/Bonobo791/Langlo/pull/1#discussion_r4200298700): accepted limitation, no migration change. `unixepoch() * 1000` has whole-second resolution. Current records have explicit identities and uniqueness constraints; no implemented service promises unique timestamps or timestamp-only ordering. [The schema contract](../schema.md) already documents the precision and requires a future ordering service to define a tie-breaker. Millisecond precision would still not establish uniqueness. Rewriting the published initial migration would change its integrity hash without correcting a current service failure.
4. [Whitespace-only card identity](https://github.com/Bonobo791/Langlo/pull/1#discussion_r4200298762): already corrected in the published checkpoint. Additive migration `0003_review_invariants.sql` rejects the full JavaScript-trim whitespace set and embedded NULs for persisted identities, including inserts, updates and replacements; invalid older rows fail the upgrade without coercion. Actual libSQL regression tests cover these paths. The historical `0001` file remains unchanged.
5. [Unavailable verification commit](https://github.com/Bonobo791/Langlo/pull/1#discussion_r4200298783): corrected locally. [Canonical verification](verification.json) now identifies the available public `a2d7964` source commit, exact tree and two successful CI runs for that SHA. Its 121 tests, three properties and 16 Playwright executions were checked against job logs. The previous local record is preserved byte-for-byte as [historical evidence](verification-local-foundation-20261006.json). The canonical record explicitly excludes this unpublished follow-up; it does not invent a self-referential future commit hash.
6. [Stale migration count](https://github.com/Bonobo791/Langlo/pull/1#discussion_r4200907661): corrected locally. The schema's review-hardening paragraph now says four migrations, matching the four-entry journal. A direct journal/count assertion failed before the one-word correction and passed afterward.

The old consolidated French A2, NUL and marker-cleanup suggestions were also reconciled against `a2d7964`; its supported-track guards, identity guards and safe marker-failure cleanup already address them. They do not require another migration or a recursive-delete change.

## Standalone documentation warning

CodeRabbit reported 16.67% docstring coverage against its 80% threshold, without identifying the missing functions. The local bundle adds purposeful JSDoc describing runtime validation, privacy boundaries, guarded filesystem operations, health semantics, property controls and test fixture cleanup. It changes no production behavior.

A local TypeScript AST inventory finds JSDoc on all 32 named function declarations and the constructor combined. That explicitly bounded inventory excludes variable arrows, object methods, callbacks and unsupported file types; it is not CodeRabbit's denominator or a repository-wide coverage claim. The external coverage result must be rechecked on the eventual published follow-up.

## Supplied CodeAnt SQL findings

The three supplied locations do not justify SQL changes:

- Quoting the current legal SQLite identifiers is stylistic. The actual approval query has the same indexed lookup with and without quoting. Approved cards pass; draft/rejected cards fail the trigger; missing or wrong-owner cards fail the enforced foreign key. See [SQLite identifier rules](https://www.sqlite.org/lang_keywords.html) and [foreign-key enforcement](https://www.sqlite.org/foreignkeys.html#fk_enable).
- The numeric upgrade queries already filter rows in `WHERE` before counting them. Actual SQLite query plans and VM instructions confirm filtering before `AggStep`. There is no outer predicate or subquery boundary to push through. The one-time audit must inspect potentially invalid history; a scan is not proof of misplaced filtering. See [SELECT processing](https://www.sqlite.org/lang_select.html#simple_select_processing) and [predicate push-down](https://www.sqlite.org/optoverview.html#the_predicate_push_down_optimization).
- The type, range and nullable timestamp checks protect distinct constraints. Simplifying them away would weaken the fail-closed upgrade gate. Eight actual invalid-history upgrades failed without changing original rows or applying the new migration; valid history passed. See [SQLite typeof](https://www.sqlite.org/lang_corefunc.html#typeof).

These experiments used the repository's pinned local libSQL client, SQLite 3.45.1, synthetic disposable fixtures and enforced foreign keys. All four published migrations remain byte-identical. CodeAnt still reports 14 antipatterns; the other locations remain unavailable behind its report access. These three dispositions do not establish that the entire gate is resolved.

## Integrated verification and limits

Final integrated local checks, Node 24.19.0 and npm 11.9.0, all exited zero:

- `npm run check`: zero errors and warnings
- `npm run lint` and `npm run format:check`
- `npm test`: 121/121 tests, 14 files, 19.49 seconds
- `npm run test:property`: 3/3 properties, two files, default 100 cases each, 2.31 seconds
- `npm run build`: Node adapter build passed
- `npx drizzle-kit check --config src/lib/server/db/drizzle.config.ts`
- `node --test tests/native-review-invariants.mjs`: 7/7 native controls
- `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e -- --grep 'private routes|server generates|invalid runtime|reserved private|unexpected server errors'`: 10/10 server-level project executions, 5.9 seconds; no rendered browser fixture
- Direct assertions: 32/32 narrowly scoped declarations documented, all 17 other changed source/test files identical after comment removal, canonical public SHA/tree/counts correct, historical evidence byte-identical, four-entry journal/count consistent
- `git diff --exit-code -- drizzle tests/property-options.test.ts package.json package-lock.json vitest.config.ts` and `git diff --check`

Independent review found zero Critical or Important issues. It freshly passed 29 targeted owner/replay-control/config/identity tests and the owner property with 1,000 cases, seed 20261006, in 4.16 seconds. Its two Minor evidence-wording findings were corrected and re-reviewed. Stress timings vary; they are not a universal CI runtime guarantee.

The previous public CI proves its stated `a2d7964` checkpoint only. New remote CI and external review results require publication of this follow-up. Local rendered Chromium remains blocked by the previously observed IPC socket restriction; no rendered pass is inferred from the server-only subset.

Prepared-study remains separate. The main branch, dependency lockfile, package settings, migrations and license are unchanged. No review reply or resolution, merge, deployment, real provider call, production database or Windows test is part of this bundle.
