# Curriculum import contract

This contract versions the grammar catalog, lifecycle ledger, and prerequisite graph as one bundle. It defines validation behavior for a future importer; it does not implement or provision an importer.

## Bundle manifest and approval

`content/curriculum-manifest.json` is the bundle entry point. `manifest_version` versions this contract. `curriculum_version` is semantic versioning and remains a pre-release while `publication_status` is `draft`. Evidence status on a skill describes its source/placement support and is separate from publication approval. A future importer must reject any bundle whose status is not exactly `approved`; no row status can override a draft bundle.

The manifest names and SHA-256 hashes the coverage CSV, prerequisite JSON, and append-only skill ID registry. Bundle and previous-registry paths must resolve to files inside the repository; absolute paths, traversal outside the repository, and symlinks that resolve outside it are rejected before file contents are read. Validation must reject missing files, malformed digests, or digest mismatches. Any edit to a hashed file requires updating its digest and the curriculum version according to the version rules below. `dependency_semantics` must equal `recommended_teaching_order`; other values are invalid and must be rejected, not interpreted as mastery gates.

`included_tracks` declares the five audited tracks. `selected_subset_tracks` explicitly identifies French A1 as a selected subset; French A2 is out of scope. A selected-subset declaration prevents the bundle from implying complete coverage of a larger reference inventory.

For approved versions, increase the major number for incompatible schema or meaning changes, the minor number for adding or retiring skills, and the patch number for corrections that do not change learning objectives. Until owner approval and specialist review are complete, retain a `0.x.y` pre-release version and `publication_status: draft`.

## Coverage catalog

`docs/curriculum-coverage.csv` is UTF-8 CSV with a header row and these required columns, in order:

| Column                | Meaning                                                                            |
| --------------------- | ---------------------------------------------------------------------------------- |
| `id`                  | Stable, unique skill identifier.                                                   |
| `language`            | `French`, `German`, or `English`.                                                  |
| `level`               | Local track placement: `A1` or `A2`.                                               |
| `topic`               | Short grammar grouping.                                                            |
| `skill`               | Original Langlo learning objective.                                                |
| `source_ids`          | One or more semicolon-separated reference IDs recorded in `docs/evidence/T004.md`. |
| `placement_rationale` | Reason for scope and level placement, including local instructional judgment.      |
| `evidence_status`     | Exactly `source-aligned`, `local-alignment`, or `provisional`.                     |
| `provenance`          | Ownership/provenance statement for the objective.                                  |
| `lifecycle_status`    | `active` or `retired`; retired rows remain as ID tombstones.                       |
| `replaced_by`         | Optional semicolon-separated active IDs; required values must resolve.             |

Every row must match the header width. Every field except `replaced_by` must be non-empty after trimming. The allowed track pairs are French A1, German A1/A2, and English A1/A2. Source IDs must be registered in the evidence file. Evidence status is validated exactly, including whitespace. Active rows have no replacement mapping. Retired rows remain in the catalog; replacements, when present, must point to active IDs.

An ID's learning meaning must not be narrowed, broadened, or reassigned. If an objective is split or retired, retain its row as retired and create new active IDs for the changed objectives. `en-a1-002` therefore remains recorded with its original combined `be`/`have got` meaning and is retired in favor of `en-a1-019` and `en-a1-024`. Existing learner evidence remains attached to the retired ID; replacement IDs do not inherit mastery automatically.

`content/curriculum-id-registry.json` records every ID used. The validator checks uniqueness, requires every catalog ID to be registered, and requires every registered ID to resolve to an active row or a retired catalog tombstone. It accepts a repository-relative earlier registry path as an optional argument (`npm run validate:curriculum -- <previous-registry-path>`), validates its schema version and non-empty unique string IDs, and rejects IDs removed from that registry. Malformed JSON or registry data must fail validation rather than disable the comparison. Approval of later versions must compare the new registry with the previous approved registry. This first bundle has no previous approved registry, so continuity with prior unapproved drafts is checked and recorded separately.

## Prerequisite graph

`content/prerequisites.json` has `schema_version: 1` and one node for every catalog ID, including retired tombstones. Each node contains a `skill_id` and an array of prerequisite IDs. IDs must match the catalog exactly. The validator rejects missing or duplicate nodes, duplicate prerequisites, dangling or self edges, dependencies on retired skills, cross-language edges, edges from a higher level to a lower level, and cycles. Retired nodes have no prerequisites.

These edges express recommended teaching order only. A future importer must reject structurally invalid bundle data and any dependency semantics other than `recommended_teaching_order`, but must not use edges as learner mastery gates. Any later mastery gates need a separate contract and explicit thresholds.

## Acceptance boundary

Validation covers manifest shape, version syntax, approval status, file digests, CSV schema, source registration, skill lifecycle, ID registry, and graph consistency. It does not validate CEFR certification, exam equivalence, mastery thresholds, or placement truth from citations alone. Runtime import, historical registry comparison, learner-evidence migration, and publication remain separate approval gates.
