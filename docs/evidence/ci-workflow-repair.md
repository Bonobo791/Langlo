# CI workflow repair — 2026-10-10

Branch: `codex/ci-baseline-fixes`, based on main `d6e7a46ec0a22f7be8455bcd6d0e7f1c48d13643`. Workflow repair commit: `4041059`. Kept separate from T003 and its uncommitted storage fixes.

## Reproduced failures

PR #6 at `65d18ff` failed its [ESLint installation](https://github.com/Bonobo791/Langlo/actions/runs/38080467972/job/114296147258): the workflow installed ESLint 8.10.0 despite the project requiring ESLint 10.12.0 and @eslint/js 10.0.1, producing ERESOLVE. It also referenced the absent `.eslintrc.js` rather than the repository's flat configuration.

The [Quality job](https://github.com/Bonobo791/Langlo/actions/runs/38080467984/job/114296147236) passed lint, then failed formatting on `.github/workflows/eslint.yml` and `.github/workflows/ossar.yml`. GitHub checked out merge `86a10ab`, incorporating these main-branch workflows. They are absent from the standalone T003 branch, explaining its passing local formatting check. Checking the original ESLint workflow through Prettier stdin independently returned exit 1.

## Repair and validation

The ESLint workflow uses Node 24.19.0/npm 11.9.0, `npm ci`, and `npm run lint` with the existing flat configuration. Its pinned SARIF formatter is installed without saving dependencies or changing the lockfile. The checkout uses the existing reviewed SHA and disables credential persistence. The existing scanner scope, triggers, permissions and result-upload behavior remain in place. Both affected workflows were formatted; no application dependencies or quality thresholds changed.

Validated in disposable worktree `/tmp/langlo-ci-repair`, using Node 24.19.0 and `npm exec --cache=/tmp/langlo-npm-cache --yes --package=npm@11.9.0 -- …` (subsequent commands add `--offline`):

- `npm ci`: passed, 215 packages; four moderate audit findings reported.
- `npm install --no-save --package-lock=false @microsoft/eslint-formatter-sarif@3.1.0`: passed; root ESLint remains 10.12.0. The formatter brings deprecated transitive packages; it is unchanged from the existing workflow's dependency choice.
- `npm run lint -- --format @microsoft/eslint-formatter-sarif --output-file /tmp/langlo-ci-eslint-results.sarif`: passed; generated SARIF 2.1.0, one run, zero findings. Output path alone differs from the workflow to keep the local artifact outside git.
- `npm run check`: zero errors/warnings.
- `npm run lint`, `npm run format:check`, `npm run build`: passed.
- `npm test`: 137 passed, 15 files.
- `npm run test:property`: three passed, two files.
- `npm run test:e2e`: 16 passed, desktop/mobile.

Tests used permitted child-process/local-server access and disposable synthetic fixtures. No production, provider or desktop access occurred. Hosted SARIF upload and a fresh GitHub run remain unverified until approved publication. No push, PR creation, merge or deployment was performed.
