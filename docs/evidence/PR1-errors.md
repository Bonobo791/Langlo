# PR #1 unexpected-server-error regression

Verified locally on 2026-10-06 with Node 24.19.0 and npm 11.9.0.

## Gap and scope

The existing error-page test covers a missing route (404). The new
`tests/e2e/server-error.spec.ts` covers a synthetic endpoint exception (500) through
the built SvelteKit server's actual `handle` and `handleError` hooks.

`tests/fixtures/unexpected-error-probe.mjs` imports `build/server/index.js` and its
manifest in an isolated Node process. It clones the route list in memory and adds
one test-only throwing endpoint. It never adds a production route, modifies the
built app, mocks the hooks or diagnostics, opens a socket, or calls a provider.
The existing Playwright runner still starts its ordinary local web server; this
test uses no browser or HTTP client fixture.

## Assertions

- The synthetic endpoint ran exactly once, and the response status is 500
- The complete response body contains only status, the safe message, and a valid
  server-generated UUID v4 matching the `x-correlation-id` response header
- The untrusted incoming correlation header is not reused
- The only warning is one JSON diagnostic with exactly `operation: request`,
  `kind: unexpected`, and the same UUID
- Response headers, body, and warning do not reflect synthetic exception-message,
  learner-answer, provider-token, query, request-body, or incoming-header markers
- No stack, answer, or token fields appear; the process succeeds with empty stderr

The child receives only PATH from its parent and uses explicit synthetic runtime
configuration with data disabled. Its runtime is bounded to ten seconds.

## Observed RED and GREEN

To prove sensitivity without changing tracked production source or the real
build, a disposable private copy of `build/server` was placed under a fresh
temporary directory, with ESM package metadata. In that copy alone, the compiled
`handleError` return was changed from `safeError(event.locals.correlationId)` to
`{ message: error.message, correlationId: event.locals.correlationId }`.

The same retained test was run with `LANGLO_TEST_SERVER_BUILD` pointing to that
copy:

`npx playwright test tests/e2e/server-error.spec.ts --project=desktop`

Observed RED: **1 failed**, exit 1, at the exact response-body equality assertion:
expected `Something went wrong. Please try again.`, received
`synthetic-error-message`. The temporary copy was removed by a cleanup trap.
There was no checked-in production mutation or dependency symlink.

With the original built server and no override:

`npx playwright test tests/e2e/server-error.spec.ts`

Observed GREEN: **2 passed**, covering the configured desktop and mobile projects.
These are two executions of the same server-only regression, not browser-rendering
coverage.

Additional local checks:

- `npm test`: **14 files, 113 tests passed**
- `npm run check`: **0 errors, 0 warnings**
- `npx eslint tests/e2e/server-error.spec.ts tests/fixtures/unexpected-error-probe.mjs`:
  exit 0
- `npx prettier --check tests/e2e/server-error.spec.ts tests/fixtures/unexpected-error-probe.mjs docs/evidence/PR1-errors.md`:
  exit 0

The ordinary Vitest suite excludes E2E files. Existing CI already builds before
running Playwright, so this regression requires no package or CI changes.
The local runner emitted npm proxy-setting and Node color-environment warnings;
the isolated probe's stderr was empty. No remote CI result, live provider,
deployment, production data, or account behavior is established by these checks.
