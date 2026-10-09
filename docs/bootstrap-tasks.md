# Exact foundation contracts

Plan identity: language-app-adm-20261006. This record executes only T006–T009. T001 has since selected PolyForm Shield 1.0.0; license-file implementation, publication, authentication, real providers, curricula and Windows remain separate gates.

## T006 · C01/C02/C08/C09/A01: neutral repository and toolchain

Files: AGENTS.md, package.json/package-lock.json, .node-version, .gitignore, .env.example, tsconfig.json, vite.config.ts, README.md, BOOTSTRAP-LICENSE and this status record. One local dev repository with intended origin Bonobo791/Langlo; no prior app files, brand, learner rows or production configuration copied. Hand-authored app code; framework-generated node_modules/$app and .svelte-kit are ignored.

Configuration: Node 24.19.0, npm 11.9.0, exact stable dependency pins. Kit 3 uses vite.config.ts and $app/tsconfig, superseding the plan's old file contract. At this T006 checkpoint, package metadata was private/UNLICENSED and no LICENSE file was created. T001 records the later PolyForm Shield 1.0.0 selection; implementing the license file and updating metadata remain separate work.

Verification: clean local clone npm ci must preserve lockfile; npm run check and npm run build must compile the real Node adapter without provider credentials. Inspect tracked files and generated client output for copied names/IDs/credentials. Positive: reproducible frozen install/type/build. Negative: unused billing/YouTube/analytics/providers absent, real .env/DB/build ignored. Evidence T006.md; selected license implementation and publication remain pending.

## T007 · C03/C06/C07/T01/T02/T03/T04/T05/T06/T07: quality harness

Files: vitest.config.ts, playwright.config.ts, eslint.config.js, Prettier configuration, tests/property-options.ts with strict controls, ordinary deterministic/property tests, built browser/HTTP tests, .github/workflows/ci.yml and testing-invariants.md. No copied synthetic-array demonstration is counted as app coverage.

Commands: npm run check; npm run lint; npm run format:check; npm test; npm run test:property; npm run build; npm run test:e2e. Test discovery excludes e2e/generated/vendor paths and fails on no tests. The ordinary runner includes both config and fresh-per-run DB properties. Browser tests target npm start's built Node artifact on loopback, not dev.

CI: contents:read, pinned official action SHAs verified against their source action.yml, persist-credentials:false, bounded job and three-day synthetic failure artifacts. Fork PRs receive no secrets. No pull_request_target, deployment, production migrations or write credentials. Actual CI/branch protection is pending remote publication and observation.

Independent invariants: exact loopback hosts; diagnostics contain only the allowlisted projection; cross-owner enrollment/session FK rejects any generated foreign session ID; canonical delivery identity unique and stable. Controls: default 100 runs; strict positive safe integer count; signed 32-bit seed; numeric replay path requires seed. Concrete disposable faults alter exact-host matching, add exception text to diagnostics, delete ownership FK, and remove unique indices. Originals stay untouched. Evidence T007.md and T009.md; Stryker/domain mutation T025 remains pending.

Positive: real examples/properties/migrations execute in normal suite. Negative: absent test selection exits 1; malformed replay controls fail; fork workflow has no secret exposure. Browser rendering is currently blocked by this executor's Chromium IPC restriction and the cloud browser's loopback refusal. No skip/green substitution is used; full e2e acceptance remains open.

## T008 · C04/C05/A01/A02: private config and safe runtime

Files/exports: src/env.ts explicit private dynamic variables; src/lib/server/config.ts parseRuntimeConfig/ConfigError; diagnostics.ts safeDiagnostic/safeError; hooks.server.ts handle/handleError; App locals/error declarations; root error page; public shell and health/build endpoints; routes.md/environment.md. Schema/provider/authorization stays server-only and no private locals are serialized to clients.

Configuration: APP_ENV development/test/production; exact loopback HTTP origin outside production and explicit credential-free HTTPS origin in production; strict true/false DATA_ENABLED defaults false; local fixture file DB only when explicitly enabled; remote libSQL/token only for selected production settings, with no connection implemented here; APP_BUILD_SHA unknown or lowercase 40-character SHA. Invalid values are never reflected. Liveness bypasses config/DB; readiness is honest foundation-in-progress 503.

Behavior: every response through the hook has a new server-generated UUID and no-store. Private /app plus reserved login/recover/reset paths use private,no-store and noindex/nofollow including errors/slash variants. Root trailingSlash:ignore avoids framework normalization redirects outside that hook. Signed-out private GET redirects /login; mutations deny safely until auth exists. Diagnostics exclude arbitrary errors, bodies, URLs, cookies, tokens, account IDs and answer text.

Tests: config accepted/invalid values, enabled-incomplete DB, unsafe origins and redaction; independent properties and shrunk localhost.a.example regression; built invalid config returns safe 503 while liveness remains 200; HTTP private GET/POST/slash headers, fresh correlation IDs and safe readiness; synthetic secret absent from actual built client files. Evidence T008.md. No provider success, auth/session validity, log-retention policy or hosted readiness is inferred.

## T009 · A04/A05: owner/versioned schema and guarded migrations

Files: src/lib/server/db schema, sqlite3-only local connection, target guard, migrations and SourceID helper; Drizzle config; drizzle SQL/meta; synthetic fixture/CLI and actual DB tests. Auth-library fields intentionally await T010. schema.md defines each table/field/relation/nullability/source/classification.

Configuration: fixture tools accept only an explicitly marked private canonical temporary root and its exact file-backed test.sqlite URL. No ambient database URL/token fallback. Static traversal, symlink/hardlink/sidecar/marker/production/network mistakes fail before opening/resetting. This is not a same-UID filesystem race sandbox.

Commands: npm run db:fixture prints exact synthetic root/URL; db:migrate, db:seed:test, db:test:reset and db:fixture:dispose require explicit --fixture-root/--database-url arguments. db:generate uses the project schema config and never provisions a database. Clean/reset/repeat/initial upgrade tests run actual file-backed libSQL.

Invariants: composite owner/language/version FKs preserve related private identity; submission/canonical mistake/delivery uniqueness; immutable card and delivery SourceID identity; insert-time approval and safe claimed/delivered shape; positive safe integer content versions and integral delivery counters/timestamps; real batch rollback. Additive 0002 hardening validates older rows before installing hand-authored strict numeric/immutability triggers. Future table rebuilds must preserve those triggers.

Positive: clean migrations and supported upgrade preserve owned versioned attempts/evaluations; independent-process release-barrier duplicates produce one identity. Negative: forged owner/version, unapproved enqueue, malformed claims/acknowledgements, retargeted delivery, non-integral versions/counters, production target and filesystem escapes fail without unrelated changes. Each generated ownership run gets its own migrated/seeding fixture. Evidence T009.md. Maintained auth, session-derived query authorization, all curricula, full card/lease service, Turso sandbox/recovery and Windows delivery remain pending.

## N/A and later work

Billing, OAuth, user uploads, analytics and Redis/worker services were not selected and are excluded. Full curriculum authoring/import, study/mastery/assessment, maintained authentication/recovery, AI spend controls, export/deletion, email, real Anki and release/recovery remain explicit later plan tasks. The full plan is not completed by this foundation.
