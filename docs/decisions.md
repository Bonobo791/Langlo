# Owner decisions

This record captures the owner decisions reconciled for T001 (LANGLO-23, It’s a Plan issue 870) on 2026-10-09. The source comments are 6874–6877. These decisions define the planning scope; they do not claim that the pilot or its integrations are implemented or released.

## Pilot scope — retained

Retain the approved private, two-learner grammar pilot and its existing scope:

- Language tracks recorded in [the schema contract](schema.md): French A1, German A1/A2, and English A1/A2.
- Exercise formats recorded by the question schema: multiple-choice, typed-blank, translation, and correction.
- Existing progress scope: practice, assessment, and mixed-review sessions; submitted attempts; evaluations; and skill evidence. Their schema records do not establish a complete learner-facing progress experience.
- Existing Anki scope: private per-learner card drafts and reviewed Windows delivery. The schema’s Anki card formats are cloze and question-answer.

Open-source alternatives were researched. No migration to an alternative and no replacement of the approved scope was authorized.

## Execution capacity and budget

- Plan and execute one task per calendar day.
- No fixed hours commitment and no guaranteed launch date are set. Task dates remain planning targets subject to review and prerequisites.
- Budget is deferred. No budget ceiling, purchase, paid upgrade, or spending authorization is established.

## Repository and license

- Repository: `Bonobo791/Langlo`.
- Selected license: PolyForm Shield 1.0.0, matching the license identified in Bonobo791/Moderaty’s [LICENSE](https://github.com/Bonobo791/Moderaty/blob/main/LICENSE) (blob `f88d3d68982bd77db576b39874b59e251ba74a94`). The license text is at [PolyForm Shield 1.0.0](https://polyformproject.org/licenses/shield/1.0.0).
- This records the choice only. Langlo still needs a separate license-file and package-metadata implementation, including appropriate notices. No license file was created or publication authorized by T001.

## Anki profile setup

Both learners already have separate Anki profiles. Retain a later per-learner way to connect to those existing profiles. Do not create profiles, connect to them now, or make setup a blocker for this scope review. Profile identity checks and delivery validation remain implementation-phase gates.
