# Curriculum import contract

This contract versions the grammar catalog and prerequisite graph as one bundle. It defines data shape and validation behavior for a future importer; it does not implement or provision an importer.

## Bundle manifest

`content/curriculum-manifest.json` is the entry point. `manifest_version` versions this manifest contract; `curriculum_version` versions the content bundle independently. The two paths are repository-relative and identify the CSV catalog and prerequisite JSON. `dependency_semantics` is fixed to `recommended_teaching_order`: links can guide lesson recommendations and never block learner access based on mastery.

`curriculum_version` uses semantic versioning. Increase the major number when IDs or field meanings become incompatible, the minor number when adding or retiring skills without changing field meanings, and the patch number for corrections that do not change the learning objective. Skill IDs are never reused. When a bundled objective is split, retain the existing ID for its continuing objective and assign a new ID to the separated objective.

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
| `evidence_status`     | `source-aligned`, `local-alignment`, or `provisional`.                             |
| `provenance`          | Ownership/provenance statement for the objective.                                  |

Rows must have non-empty values, unique IDs, supported language/level values, and registered source IDs. A catalog version can define a selected subset of a larger language inventory; coverage claims must name the subset and retain known gaps visibly.

## Prerequisite graph

`content/prerequisites.json` has `schema_version: 1` and one `nodes` entry per catalog skill. Each node contains a unique `skill_id` and an array of prerequisite skill IDs. IDs must match the catalog exactly. Import validation must reject missing or duplicate nodes, duplicate prerequisites, dangling or self edges, cross-language edges, edges from a higher level to a lower level, and cycles.

These edges express recommended teaching order only. A future importer must still reject structurally invalid bundle data, but must not use these edges as learner mastery gates. Any later mastery gates need a separate contract and explicit thresholds.

## Acceptance boundary

Validation checks structural integrity, source registration, version compatibility, and graph consistency. It does not validate CEFR certification, exam equivalence, mastery thresholds, or the truth of a placement solely from a source citation. Runtime import, database changes, and publication are downstream work.
