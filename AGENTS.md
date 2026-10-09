# Langlo repository guidance

This isolated repository is a local implementation of Language Grammar Coach. Keep code neutral, private configuration server-only, and every learner record owner-scoped. Do not copy branding, credentials, production settings or learner data from other projects.

Use Node 24.19.0 and npm 11.9.0. Run npm ci, npm run check, npm run lint, npm run format:check, npm test, npm run test:property, npm run build and npm run test:e2e. Ordinary tests include properties and must fail with no tests. Browser tests target the built Node server with synthetic fixtures.

Write behavior tests first, record observed red and green output, and preserve unrelated work. Document evidence and pending acceptance in docs/evidence. Local checks do not prove live provider, Windows Anki, CI or release success.

Only disposable local fixture databases may be created or migrated in this phase. No real provider calls, production database, credentials, account access, paid calls, remote publication, deployment, SSH, DNS or desktop access are authorized. T001 records Bonobo791/Langlo as the repository and PolyForm Shield 1.0.0 as the selected license; license-file implementation and remote publication remain pending. Commits may be made locally; do not push.

Keep generated .svelte-kit and build files, database files, real .env files and learner data out of git. Server-only modules must stay in src/lib/server. Fork CI must have no production secrets or privileged write triggers.
