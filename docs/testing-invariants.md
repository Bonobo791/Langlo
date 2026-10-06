# Foundation invariant register

## CFG-01: remote origins cannot masquerade as local fixtures

Non-production app origins are exactly localhost, 127.0.0.1 or [::1], with no credentials, query, fragment or non-root path. Production requires an explicit HTTPS origin. The independent oracle is the stated allowlist, not the parser. Property inputs use arbitrary alphabetic lookalike suffixes. Detectable fault: change exact localhost equality to prefix matching. Regression: localhost.example. No live provider calls exist in this slice.

## LOG-01: diagnostics cannot include learner answers or arbitrary exception payloads

Diagnostics contain only the allowlisted operation, safe error category and server-generated UUID. The independent oracle is exact field equality. Property inputs use bounded arbitrary Unicode error messages. Detectable fault: include the Error.message in the projection. Regressions contain synthetic answer/token/body fields. Generated tests are stateless. Logging success proves only this projection; hosting log retention and access control remain operator gates.

## PBT-01: run controls are strict and reproducible

Default 100 runs; explicit positive safe integer run count; signed 32-bit seed; replay path requires seed and numeric colon-separated path. Invalid or empty supplied values fail. Ordinary npm test discovers properties; test:property is an additional filter. No zero-test passes are allowed. Failure replay and deliberate fault evidence are recorded separately from sample counts.

## DB-01: private relations and deduplication

Owner identity must match across enrollment, session, attempt, evaluation, card and delivery references. Versioned attempts retain their original content version on upgrades. SourceID identifies one owner/language/skill/canonical mistake delivery identity despite concurrent retries. Actual local libSQL constraints and migrations are the oracle, with a fresh disposable fixture per generated run. Details and DB-specific evidence are recorded by T009.

## Limits

No authentication, assessment, mastery, AI, cards workflow or real Windows delivery is implemented yet. These invariants do not establish those tasks or real provider integration. CI cannot be called passed until a remote run for an exact commit is observed. Stryker is deferred to T025; scoped concrete faults are required for this foundation.
