# PR 1 triage

Date: 2026-10-06. [PR 1](https://github.com/Bonobo791/Langlo/pull/1), `dev` → `main`.
Reviewed head: `29a779d63018872c965be8acfa38e6c65f6b69af`.
This record covers the published foundation and its separate, focused review
patch. Prepared-study feature work is excluded.

## Checks

The [foundation CI run](https://github.com/Bonobo791/Langlo/actions/runs/37528181007)
completed successfully for the reviewed head: check, lint, formatting, 62 ordinary
tests, three default properties, build and 14 desktop/mobile Playwright cases.
Successful-run screenshots were not uploaded or visually inspected. This run
does not verify the later local review patch.

CodeRabbit, cubic, Codex, Gitar, Amazon Q and Semgrep completed their reviews.
CodeAnt Quality Gates and SCR failed. The public summary reports 14 antipatterns;
its three public code suggestions are a separate list. Test Coverage reports a
success status but no enabled coverage data, which is not a measured coverage
pass.

## Reproduced findings with local fixes

- [Local token retention](https://github.com/Bonobo791/Langlo/pull/1#discussion_r4200266460)
  and [remote token padding](https://github.com/Bonobo791/Langlo/pull/1#discussion_r4200298791):
  local and disabled configurations now omit the remote token; only a validated
  remote libSQL branch returns its trimmed token. Native Node assertions observed
  both original failures, then passed after the minimal parser change.
- [Symlinked TMPDIR](https://github.com/Bonobo791/Langlo/pull/1#discussion_r4200266474),
  [marker-write cleanup](https://github.com/Bonobo791/Langlo/pull/1#discussion_r4200298823)
  and [root-link test setup](https://github.com/Bonobo791/Langlo/pull/1#discussion_r4200298749):
  fixture creation uses a canonical temporary parent; failed marker writes remove
  only the newly owned marker and empty directory. The root-link test reaches the
  intended defenses. Native creation regressions observed 0/3 passing before and
  3/3 after. Details: `PR1-fixtures.md`.
- [Unsupported French A2](https://github.com/Bonobo791/Langlo/pull/1#discussion_r4200298805),
  [embedded NUL](https://github.com/Bonobo791/Langlo/pull/1#discussion_r4200298816)
  and [blank identity text](https://github.com/Bonobo791/Langlo/pull/1#discussion_r4200298762):
  the helper rejects NUL; additive migration 0003 validates history and adds
  supported enrollment-pair and identity-text guards. Native SQLite regressions
  observed seven failures before and 7/7 passes after. Existing migrations
  0000–0002 are byte-identical to the reviewed head. Details: `PR1-schema.md`.

The config assertion now requires the exact fixed error string, protecting
username, password, query-token and fragment values. Documentation now includes
skill in the SourceID tuple, the liveness validation exception, whole-second
timestamp resolution and the absence of evaluation append-only enforcement.
Historical local verification is explicitly distinguished from exact-head CI.

Two further review gaps are addressed:

- [Runtime-specific globals](https://github.com/Bonobo791/Langlo/pull/1#discussion_r4200298756):
  actual ESLint probes reproduced Node globals accepted in client code and browser
  globals accepted in server code. Scoped runtime rules now reject those values
  across supported module extensions and static global aliases, while preserving
  shared Web APIs, type references and Playwright callbacks. All 36 negative and
  positive controls pass. Details: `PR1-lint.md`
- [Unexpected server errors](https://github.com/Bonobo791/Langlo/pull/1#discussion_r4200298683):
  a retained built-server regression registers a synthetic throwing endpoint only
  in an in-memory manifest. It verifies the actual compiled hooks, safe 500 body,
  correlation ID and diagnostic allowlist. A private faulty compiled copy that
  reflected the exception message failed the same assertion; the original build
  passed both project executions. No production throw route is added. Details:
  `PR1-errors.md`

## False positive

[Amazon Q's empty production-origin claim](https://github.com/Bonobo791/Langlo/pull/1#discussion_r4200226670)
is not supported by the code. Missing, empty and whitespace origins fail inside
`new URL()` and throw `ConfigError: Invalid APP_ORIGIN`. Native assertions verified
all three values and a synthetic credential/query/fragment URL. No change to
origin validation was needed.

## Pending or retained limits

- The missing-page browser case exercises 404 handling; the new server-only
  regression separately covers `handleError`. Local rendered browser validation
  remains restricted, and the new patch has no observed remote CI run yet
- Runtime-global lint rules are a quality guard, not a browser/server sandbox.
  Explicit Node imports, dynamic global lookup and precise browser callback
  scope analysis remain outside this small correction
- Default 100-run database properties passed the reviewed-head CI. Fresh fixture
  isolation is retained. A prior 1,000-run experiment exceeded the unchanged 10s
  test cap; no extended database or universal performance claim is made
- Evaluation append-only service behavior remains T017/T018. The review patch
  corrects the current documentation instead of inventing those later features
- PR title `Dev` can be made more descriptive. No remote title or review-thread
  state was changed

## Verification and remaining review-data gap

Dependency setup initially stopped. A later explicitly approved pinned install
succeeded with a disposable writable cache and an unchanged lockfile. Actual
Drizzle/libSQL migration regressions then passed, including invalid-history
rollback and unchanged applied-migration count. The subsequent whole ordinary
suite passed 121 tests; default properties, check, lint, formatting, build,
Drizzle metadata checks and server-only regressions are recorded in the final
review checkpoint. Independent review found no Critical or Important code issue.
Native SQLite evidence is retained separately from actual libSQL acceptance.
Local verification does not establish remote CI for a new patch commit. Merge
readiness also depends on resolving the remaining CodeAnt gate.

The [CodeAnt result](https://app.codeant.ai/quality-gates/results?repo=Bonobo791/Langlo&commit_id=29a779d63018872c965be8acfa38e6c65f6b69af&service=github)
redirects the cloud browser to provider sign-in. No connected CodeAnt tool or
public location list was available. The fourteen exact locations need an
authorized report export or account access before they can be triaged. No sign-in,
OAuth grant, external reviewer-agent command, threshold relaxation, remote comment
or merge formed part of local triage. Publishing the verified fixes is a separate
owner-approved step.
