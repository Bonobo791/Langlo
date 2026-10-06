# PR1 disposable fixture fixes

Reviewed baseline: `29a779d63018872c965be8acfa38e6c65f6b69af` (PR #1).
Verification date: 2026-10-06. Runtime: Node 24.19.0.

## Verified findings and patch

- A real symlinked `TMPDIR` produced a raw alias in the returned fixture root,
  contradicting the validator's canonical-path requirement. Creation now uses
  `realpath(tmpdir())` as the parent for `mkdtemp`; the returned root and file URL
  are canonical. No validator checks changed.
- Marker-write failure leaked the new directory, both before any marker existed
  and after a partial marker write. The failure path now removes only that call's
  marker and then its empty root. It never recursively deletes a root. An
  unexpected root entry prevents directory removal rather than being deleted.
- The root-symlink negative test previously failed its basename/parent checks.
  Its alias now has a valid `langlo-fixture-*` basename directly under the
  canonical temporary directory, with explicit alias cleanup.

## Observed RED → GREEN

The three cases in `tests/fixture-creation.test.ts` were written before changing
`createDisposableFixture`. Each uses a separate real Node subprocess. Marker
failure is injected only into that subprocess's marker write; there is no
production fault-injection API. A neighboring sentinel is asserted unchanged.

Because dependencies could not be installed, the same test body was temporarily
run with Node's native test runner: the Vitest import was replaced with
`node:test`, `assert.equal` for `expect(...).toBe(...)`, and an `it.each` adapter.
The temporary runner file was removed after each run.

Command: `node --test tests/.fixture-creation-native.ts`

- RED, exit 1: 0 passed / 3 failed. The symlink case asserted different raw and
  canonical roots; both marker-failure cases found a leaked `langlo-fixture-*`
  directory beside the sentinel.
- GREEN, exit 0: 3 passed / 0 failed. The symlink case validated the canonical
  root and exact database URL. Both marker-failure cases preserved the original
  injected error, removed the owned root, and retained the sentinel contents.
- Syntax check: `node --check tests/fixture-creation.test.ts`, exit 0.

A separate dependency-free `node --input-type=module` guard probe created the
same valid-name/direct-parent root symlink and observed rejection. A bounded,
subprocess-local mutation bypassing the redundant root-link defenses
(`realpath` for the alias subtree and `lstat` for the alias root) accepted the
same target. This proves the corrected setup reaches root-link defenses rather
than failing an earlier name/parent check. The filesystem functions were
restored and only the created alias and owned fixture were removed. The actual
validator source was never edited.

## Limits

Dependency setup initially stopped, so those native results did not establish
Vitest or whole-project acceptance. A later explicitly approved pinned install
succeeded with a disposable writable npm cache and an unchanged lockfile. The
actual fixture creation and database/sidecar/hardlink/marker/network guard suites
then passed as part of the 121-test ordinary suite. Check, lint, formatting,
default properties and build are recorded in the final review checkpoint.
This Linux symlink regression is not a macOS or Windows execution claim. No
provider, production database, credentials, remote comments, push, or merge was
used.
