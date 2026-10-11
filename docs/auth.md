# Langlo authentication contract

**Status:** T010a selection and implementation plan, approved 2026-10-10 (three
days ahead of the recorded October 13 schedule; owner approved the early start
in-session). This document defines the contract only. **No authentication is
implemented yet** — the `/app` guard still denies by default and no route
accepts credentials. Implementation is T010b; acceptance is T010c.

## Selection

Selected by owner decision on 2026-10-10: **Better Auth 1.7.x** with its Drizzle
adapter on the existing libSQL client, plus Nodemailer behind a `Mailer`
interface for the Proton SMTP submission path.

| Component                      | Selected version                                                    | Evidence                                        |
| ------------------------------ | ------------------------------------------------------------------- | ----------------------------------------------- |
| `better-auth`                  | `1.7.7` (published 2026-09-30)                                      | `npm view better-auth version`                  |
| `@better-auth/drizzle-adapter` | `1.7.7` (same release train)                                        | `npm view @better-auth/drizzle-adapter version` |
| `nodemailer`                   | `10.0.13` (published 2026-09-30; `10.1.0` is newer but <7 days old) | `npm view nodemailer versions`                  |
| `@better-auth/cli`             | resolved at install; dev-time schema generation only                | —                                               |

Pins satisfy the repository's ≥7-day preference as of 2026-10-10. T010b must
re-verify current releases and re-apply the age rule at install time; the
contract constrains the major line (`1.7.x`), not the exact patch.

### Alternatives considered

| Option                                                                                                                   | Verdict                                                                                                                                                                                                                                              |
| ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hand-rolled sessions on `node:crypto` (Argon2id verified present in this Node 24.19.0 runtime), Copenhagen Book guidance | Viable — smallest dependency surface and full control — but every security-critical line is ours to own. Not selected.                                                                                                                               |
| Better Auth 1.7.x                                                                                                        | **Selected.** Maintained internals for hashing, sessions, reset flow, and rate limiting; official SvelteKit integration; Drizzle adapter on our existing libSQL client. Cost: larger dependency surface and framework-owned schema/routes/internals. |
| `lucia` v3 + `@oslojs/*`                                                                                                 | Rejected — Lucia deprecated March 2025; all `@oslojs/*` packages except `@oslojs/encoding` deprecated July 2026.                                                                                                                                     |
| Auth.js / `@auth/sveltekit`                                                                                              | Rejected — project in maintenance mode under the Better Auth team since 2025-09-22; SvelteKit package experimental; credentials+database sessions are its weakest path.                                                                              |
| Hosted identity (Clerk, Supabase Auth, Keycloak, …)                                                                      | Rejected — external identity dependency; conflicts with own learner accounts, private provisioning, and the no-public-registration requirement.                                                                                                      |

### Sources inspected 2026-10-10

- [Better Auth: SvelteKit integration](https://better-auth.com/docs/integrations/svelte-kit) — `svelteKitHandler`, `sveltekitCookies` plugin (requires SvelteKit ≥ 2.20; this repo pins 3.0.1)
- [Better Auth: Drizzle adapter](https://better-auth.com/docs/adapters/drizzle) — `provider: 'sqlite'`, field/model mapping support
- [Better Auth: email & password](https://better-auth.com/docs/authentication/email-password) and [options reference](https://better-auth.com/docs/reference/options) — `disableSignUp`, `sendResetPassword`, `resetPasswordTokenExpiresIn`, `revokeSessionsOnPasswordReset`, custom `password.hash`/`verify`
- [Better Auth: rate limit](https://better-auth.com/docs/concepts/rate-limit) — built-in sign-in rule, `customRules`, `storage: 'memory'|'database'|'secondary-storage'`; disabled by default outside production, so tests must enable explicitly
- [Better Auth: database/secondary storage](https://better-auth.com/docs/concepts/database) — session/rate-limit/verification storage options, including `verification.storeIdentifier: 'hashed'` (newer option; availability in the installed release must be confirmed at T010b)
- [Lucia deprecation/migration](https://lucia-auth.com/lucia-v3/migrate) and [pilcrowonpaper Oslo deprecation post](https://pilcrowonpaper.com/blog/18) (2026-07-29)
- [Auth.js joins Better Auth](https://better-auth.com/blog/authjs-joins-better-auth) (2025-09-22) and [@auth/sveltekit reference](https://authjs.dev/reference/sveltekit) (experimental)
- [Node.js crypto documentation](https://nodejs.org/docs/latest-v24.x/api/crypto.html) — `crypto.argon2`/`argon2Sync` (added Node 24.7, verified working on the pinned runtime)
- [Proton: SMTP submission](https://proton.me/support/smtp-submission) — host `smtp.protonmail.ch`, port `587` STARTTLS, PLAIN/LOGIN auth, per-app SMTP tokens
- [Nodemailer](https://nodemailer.com/) and [npm registry metadata](https://www.npmjs.com/package/nodemailer) — v10 requires Node ≥ 20, zero runtime dependencies, MIT-0

## Contract by requirement

### 1. Privately provisioned accounts; no registration

- `emailAndPassword.enabled: true` with `emailAndPassword.disableSignUp: true`.
  No public or alternate registration path may exist: no sign-up route, no
  reachable sign-up endpoint, no social/OAuth provider configuration.
- Account creation is a server-only provisioning operation (see §6), never an
  HTTP endpoint.
- T010c must prove that every sign-up path exposed by the framework rejects.

### 2. Sessions: creation, expiry, logout, revocation, request protections

- Database-backed sessions via the Drizzle adapter (`provider: 'sqlite'`) on the
  existing libSQL client. Session rows live in this database, so logout and
  revocation delete server state — not just a cookie.
- `session.expiresIn` and `session.updateAge` are set explicitly in
  `auth.ts` (starting contract: `expiresIn` = 7 days, `updateAge` = 1 day;
  T010b records final values). Session cookie cache
  (`session.cookieCache`) stays **disabled**: every request re-validates the
  session row so revocation takes effect immediately.
- Cookie contract (asserted by T010c, not assumed): `HttpOnly`,
  `SameSite=Lax`, `Secure` whenever the origin is HTTPS, `Path=/`. Better Auth
  sets these attributes itself; T010b records actual emitted `Set-Cookie`
  headers for the pinned version.
- Request protections: `trustedOrigins: [APP_ORIGIN]`; Better Auth's CSRF/origin
  checks stay enabled (`advanced.disableCSRFCheck` never set); SvelteKit's
  built-in form-action origin checking remains untouched.
- `emailAndPassword.revokeSessionsOnPasswordReset: true` — a completed
  recovery invalidates every other session for that account.
- Session-token-at-rest form is framework-owned internals; T010b records the
  actual stored column semantics. If the token column is stored unhashed, that
  residual is documented openly in T010b evidence (database-at-rest
  confidentiality is the compensating control).
- `BETTER_AUTH_SECRET` is required configuration (secret env, ≥ 32 chars); it
  signs/encrypts framework tokens. Never committed, never logged.

### 3. Recovery: single-use, expiring, replay- and concurrency-safe

- `emailAndPassword.sendResetPassword` delivers the reset link through the
  `Mailer` interface (§6); `resetPasswordTokenExpiresIn: 1800` (30 minutes).
- `verification.storeIdentifier: 'hashed'` is configured if available in the
  installed release; otherwise T010b documents the actual storage form and any
  compensating control.
- Single-use: a redeemed token must be unusable again (replay), and two
  concurrent redemptions of the same token must produce exactly one success.
  The atomic-consume mechanism is verified behavior-first in T010b and proven
  under a real process barrier in T010c (same technique as
  `tests/db-concurrency.test.ts`). If framework redemption is not atomic, T010b
  adds a compensating atomic guard rather than accepting the gap.
- A successful reset revokes all existing sessions (§2) and issues a fresh
  session only through the normal sign-in path or framework-authenticated
  response.

### 4. Enumeration resistance and rate limits

- Uniform responses: unknown and known emails produce the same status and
  body shape on login-failure and reset-request paths. T010c asserts response
  equality, not copy text.
- Timing: `sendResetPassword` must not be awaited before the response (Better
  Auth's own docs warn about this timing channel); delivery is fire-and-forget
  with failure confined to safe logs.
- Rate limits (contract values; T010c asserts deterministic 429 behavior):
  - `/sign-in/email`: 3 attempts per 10 seconds per client (framework default
    rule retained), plus a configured stricter window — 5 per 5 minutes.
  - Reset-request endpoint(s): 3 per 10 minutes per client.
  - `rateLimit.storage: 'database'` so limits survive process restart (single
    Node adapter); `rateLimit.enabled: true` is set explicitly in every
    environment, since the framework default only enforces in production.

### 5. Learner ownership across sessions

- The hook resolves `auth.api.getSession({ headers })` once per request and
  populates `event.locals.user`/`event.locals.session`.
- `event.locals.user.id` maps to the existing `LearnerSession { userId }`
  consumed by `flashcards.ts` and future owner-scoped services. The service
  signature does not change.
- All owner isolation stays enforced where it already is: `owner_id` filters
  plus composite foreign keys on `enrollments`, `study_sessions`, `attempts`,
  `evaluations`, `skill_evidence`, `card_drafts`, `deliveries`, and the native
  flashcard tables. Auth adds the verified principal; it does not replace the
  ownership model. T011 still owns query-authorization hardening.
- The `/app/**` deny-by-default guard is preserved: without a valid session it
  behaves exactly as today (GET → `/login`, mutation → safe denial).

### 6. Provisioning and mail delivery

- **Provisioning** (`npm run accounts:provision`, server-only): an operator CLI
  in the style of `tests/fixtures/cli.ts` — explicit targets, guarded against
  ambient env, no credential logging. It creates the user row and the
  credential/account row using the framework's own password hasher (single
  source of truth). Preferred path: the framework's server-side API; if
  `disableSignUp` also blocks server-side creation, T010b falls back to a
  direct adapter insert using the context password hasher and records which
  path was verified. Provisioning a real account on a real database is a
  separate authorized step, not part of T010b.
- **Mailer interface** (`src/lib/server/mail.ts`): one method, e.g.
  `send({ to, subject, text })`. Implementations:
  - `SmtpMailer` — Nodemailer transport: host `smtp.protonmail.ch`,
    port `587`, `secure: false` (STARTTLS), `auth.user` = the custom-domain
    sender address, `auth.pass` = a per-app **SMTP token**.
  - `CaptureMailer` — test/dev implementation recording messages for
    assertions; the only mailer usable in tests.
- **Provider requirements (Proton)**: a paid Proton plan, an active
  **custom-domain** address (SMTP tokens are unavailable for `@proton.me`
  addresses), a generated per-app SMTP token (shown once), and the domain's
  anti-spoofing DNS (SPF/DKIM/DMARC) intact. Mail sent this way is not
  end-to-end encrypted through the relay.
- **Unresolved setup steps (explicit):** purchase/confirm paid plan; verify a
  custom domain on the account; configure SPF/DKIM/DMARC; generate the
  `langlo-app` SMTP token; place it in the operator secret store as
  `PROTON_SMTP_TOKEN`; send a real recovery email end-to-end (a live-provider
  acceptance gate, not provable locally).

### 7. Safe logging

- Better Auth's internal logger is disabled or routed through `safeDiagnostic`;
  the app logs only fixed event categories (e.g. `login`, `recovery`,
  `session`, `provision`) with outcome and correlation ID.
- Never logged: passwords, password hashes, session tokens/cookies, recovery
  tokens/URLs, SMTP credentials, `BETTER_AUTH_SECRET`, email bodies. Email
  addresses are treated as private data — logged at most as non-reversible
  identifiers (e.g. HMAC of normalized address) when an event needs an actor,
  and T010b records what is actually emitted.
- T010c asserts secret-free logs with sentinel values (synthetic password,
  token, SMTP token) across login/recovery flows.

## Schema plan — migration `0005_auth_contract.sql` (next free version; 0004 is taken)

- `@better-auth/cli generate` produces the framework schema for review; output
  is merged by hand into `src/lib/server/db/schema.ts` and expressed as a
  checked-in migration — never applied by a CLI against any real database.
- Core tables expected: `user`, `session`, `account`, `verification`, plus
  `rate_limit` (database rate-limit storage). The existing `users` table
  serves as the `user` model where column mapping is clean (add `email`,
  `email_verified`, `name`, `updated_at`); otherwise a mapped `user` table is
  added — T010b records the final mapping. Framework default model names are
  kept to minimize configuration drift.
- All tables get `owner`-style FK treatment where applicable: `session` and
  `account` rows reference the user and cascade on delete, consistent with the
  existing model.
- Migration 0005 is additive only; it must not rebuild existing tables, so the
  hand-authored triggers from 0001–0003 are unaffected. `drizzle-kit check`
  and clean/repeat migration tests apply.

## Planned interfaces

- `src/lib/server/auth.ts` — `createAuth(config: RuntimeConfig, db)` building
  the configured `betterAuth` instance; server-only.
- `src/lib/server/mail.ts` — `Mailer` interface + `SmtpMailer` + `CaptureMailer`.
- `hooks.server.ts` — `svelteKitHandler` mounted on `/api/auth/**` only;
  existing correlation/header/guard logic wraps it unchanged.
- `src/app.d.ts` — `Locals.user`/`session` typing.
- Routes `/login`, `/recover`, `/reset` — real forms replacing the placeholder;
  `private, no-store` + `noindex` headers already in place.
- `src/lib/server/accounts-provision.ts` + `npm run accounts:provision` —
  guarded operator CLI.
- `src/env.ts` + `docs/environment.md` additions: `BETTER_AUTH_SECRET`
  (secret), `PROTON_SMTP_TOKEN` (secret), `MAIL_FROM`, optional `SMTP_HOST`
  (default `smtp.protonmail.ch`), `SMTP_PORT` (default `587`) — registered when
  implemented, not before.
- `event.cookies`/framework cookie writes must flow through the existing
  header pipeline so `private, no-store` is preserved on auth responses.

## T010b implementation boundaries

May do: add the pinned dependencies (re-verified ≥7 days old at install);
create migration 0005 and auth/mail/provision modules; wire the hook, locals,
and the three auth pages; extend `env.ts`/`environment.md`/`routes.md` for the
now-real paths; write unit/integration tests for implemented behavior;
document actual observed framework behavior (cookie flags, token storage,
error shapes) in evidence.

Must not: provision real accounts or call live SMTP/Turso; add any public or
alternate registration path; change the `LearnerSession` service seam or
owner-scoped queries; weaken existing guards, assertions, or headers;
introduce OAuth/social providers, passkeys, 2FA, email verification flows, or
admin/organization plugins (out of pilot scope); merge, push, or deploy
without explicit authorization.

## T010c acceptance tests

Behavior tests against real routes, real session persistence on disposable
fixture databases, and the capture mailer — no live email claims:

1. **No registration**: every sign-up path the framework exposes (form POSTs
   and `/api/auth` sign-up endpoints) rejects; no account row is created.
2. **Cross-learner isolation**: learner A's valid session cannot read or
   mutate learner B's decks, notes, cards, drafts, sessions, attempts, or
   review history — at route level and service level.
3. **Login/logout**: wrong and right credentials produce the specified
   outcomes; session rows are created on login and deleted on logout;
   emitted cookie attributes match §2.
4. **Session expiry and revocation**: expired sessions deny; password-reset
   revocation kills all pre-existing sessions for that account.
5. **Recovery lifecycle**: token issuance produces a captured message
   containing a usable link; an expired token rejects; a consumed token
   rejects on replay; two concurrent redemptions (real process barrier)
   yield exactly one success and one unchanged-password outcome.
6. **Enumeration resistance**: identical status and response shape for known
   vs unknown emails on login and reset-request paths.
7. **Rate limits**: configured thresholds produce deterministic 429s on both
   login and recovery; counters persist across server restart (database
   storage).
8. **Request protections**: mismatched-Origin POSTs reject; cookie flags as
   specified; `private, no-store` and `noindex` preserved on all auth routes.
9. **Secret-free logs**: synthetic password, session token, recovery token,
   and SMTP token sentinels never appear in captured diagnostics.
10. **Provisioning**: the CLI creates a working credential against a guarded
    fixture; logs contain no password/hash; the provisioned account then
    passes the real login path.

Tests must not match exact website wording, must not weaken existing
assertions, and must not present the capture adapter as proof of live Proton
delivery.

## Remaining provider and release gates

- Proton: paid plan, custom-domain verification, SPF/DKIM/DMARC, SMTP-token
  generation, secret storage, and a real delivery check are all unresolved
  external steps.
- Turso production provisioning, real account provisioning, deployment,
  reverse-proxy trust settings, and release acceptance remain separate gates.
- T010a selected the contract only; it does not prove implementation,
  delivery, or live access.
