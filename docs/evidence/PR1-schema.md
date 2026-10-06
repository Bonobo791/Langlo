# PR 1: persisted track and SourceID review

Date: 2026-10-06. Reviewed head: `29a779d63018872c965be8acfa38e6c65f6b69af`.

## Verified findings and local changes

- [Unsupported French A2 enrollment](https://github.com/Bonobo791/Langlo/pull/1#discussion_r4200298805): the separate language and level checks accepted `fr/A2`. The plan's R001 supports French A1, German A1/A2 and English A1/A2. Migration `0003_review_invariants.sql` adds insert/update guards for those five pairs. `REPLACE` also goes through the insert guard. Explanation-language selection remains unchanged.
- [Embedded NUL in SourceID](https://github.com/Bonobo791/Langlo/pull/1#discussion_r4200298816): `createSourceId()` accepted both leading and trailing NUL. SQLite `length()` stops at NUL, so its view of the same identity differs. The helper now rejects NUL in any of its four fields before hashing.
- [Whitespace-only canonical mistakes](https://github.com/Bonobo791/Langlo/pull/1#discussion_r4200298762): SQLite's one-argument `trim()` retained tabs, newlines, NBSP, Unicode spaces and BOM that JavaScript `String.trim()` removes. Migration 0003 rejects blank identity text using the explicit ECMAScript whitespace codepoints, and rejects embedded NUL. The guards cover user IDs, skill IDs and canonical mistakes, the free-text SourceID identity fields. Existing enum checks constrain language. Nonblank identity text keeps its exact spelling and whitespace; the migration does not normalize or rehash it.

Migrations 0000, 0001 and 0002 are unchanged. Before creating triggers, 0003 checks existing enrollment and identity rows through a zero-invalid-rows constraint. An invalid existing row aborts the upgrade; no row is repaired or deleted. Schema comments call out the hand-authored guards so future table rebuilds can preserve them. Existing ownership foreign keys, card identity immutability and account-deletion cascades remain in place.

## Observed red and green

Dependency-free native assertions first ran against the reviewed helper and checked-in SQL on fresh, owned temporary SQLite files with Node 24.19.0. Seven cases failed with `Missing expected exception`: four NUL helper cases, unsupported enrollment paths, whitespace/NUL identity paths and the absent invalid-history upgrade guard. SQLite also reported `length(trim(char(9))) = 1`, confirming the whitespace mismatch.

After the local changes, `node --test tests/native-review-invariants.mjs` passed 7/7 cases. Coverage includes:

- Each helper identity field with leading and trailing NUL
- All five supported track pairs and French A2 rejection on insert/update/replace
- Each ECMAScript trim whitespace codepoint, mixed whitespace and NUL identity text
- Direct identity inserts, updates and replacements; exact nonblank text preservation
- Existing attempts/evaluations preserved through a valid upgrade and failed invalid-history transaction
- Owned card/study-history deletion cascade, the unrelated owner retained and an empty foreign-key check

`git diff --check` passed. Added Vitest/libSQL regressions in `tests/db-review-invariants.test.ts` and `tests/db-migrations.test.ts`, including the migration journal count change from three to four. Dependency setup initially stopped; a later explicitly approved pinned install succeeded with a disposable writable cache and an unchanged lockfile. The actual libSQL regressions then passed. All five invalid-history cases rejected the Drizzle upgrade with migration count still three, rows unchanged and no new guards recorded; valid clean/repeated/upgraded fixtures passed. A pre-existing enum test initially failed only because the new supported-track trigger rejected the same invalid row before the older enum check; its accepted constraint-error wording was updated. The subsequent targeted database suite passed 31/31 and whole ordinary suite passed 121/121. Exact final check/lint/format/property/build results are recorded in the review checkpoint. The prior published-head CI pass still does not verify this patch's remote CI.

## Scope limits

These guards address the reviewed supported-track, NUL and whitespace-blank findings. They do not establish future evaluation append-only history, curriculum release readiness or complete helper/database equivalence for all length-counting semantics. `created_at` defaults still have one-second resolution and can tie. No provider, production database, credential, remote publication or prepared-study change formed part of this patch.
