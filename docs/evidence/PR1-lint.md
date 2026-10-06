# PR 1 runtime-lint correction

Date: 2026-10-06. Reviewed foundation head:
`29a779d63018872c965be8acfa38e6c65f6b69af`; results below apply to the
uncommitted local review patch, not the published CI head.

## Reproduction and correction

The old config exposed both browser and Node globals everywhere. Actual
`ESLint.lintText` calls accepted `process.cwd()` inside a Svelte component and
`window.location` inside a server module without errors. The test-first command
`npm test -- tests/lint-runtime.test.ts` observed **15 failures and 13 passes**:
all forbidden-runtime assertions failed because ESLint returned no restriction
messages; legitimate controls already passed.

The minimal flat-config change makes Node the default for server modules, tools
and unit tests, and uses browser globals for universal/application source. Server
hooks, `*.server` modules, `+server` endpoints and source unit tests retain Node
rules. JS/TS module extensions (`.mjs`, `.cjs`, `.mts`, `.cts`) follow the same
source/server boundary. Runtime-exclusive value references are restricted explicitly, including
static `globalThis` and Node `global` access, because TypeScript's recommended config disables
`no-undef`. Shared Web APIs remain available in Node. Local bindings and
TypeScript-only references remain allowed. Playwright files retain both sets of
globals for Node orchestration and browser-side `evaluate` callbacks.

A second regression pass covered the module-extension selector and Node's
`global` alias. Before those corrections, the expanded command observed **6
failures and 30 passes**; after them, **36/36 passed**, exit 0.

## Verified results

- `npm test -- tests/lint-runtime.test.ts`: **36/36 passed**, exit 0
- `npm run lint`: exit 0, no lint diagnostics
- `npm run check`: exit 0, zero errors and warnings
- `npm test`: **121/121 passed across 14 files**, exit 0

The 21 negative probes include JavaScript, TypeScript, Svelte, Node globals in
application code, browser globals in server modules/hooks/endpoints, tools and
unit tests. The 15 positive probes include browser/Svelte code, Node code, shared
Web APIs, local bindings, type-only references and a Playwright browser callback.
The existing npm environment emits its `http-proxy` configuration warning; it is
not a lint or test failure.

## Retained scope

This is a static runtime-global guard, not module-graph enforcement or a complete
runtime compatibility proof. Explicit Node imports and dynamically computed
global lookups are outside this change. Playwright's mixed-runtime files do not
receive callback-specific restrictions. Browser globals in universal source
still require appropriate SSR-safe execution. New runtimes or file conventions
need their own scoped lint policy and controls. No dependencies, package scripts,
remote review state or published branch were changed.
