# Langlo screen and behavior design

**Status:** T005 design proposal and clickable prototype, 2026-10-10. This document
describes intended product behavior; the prototype uses synthetic data only and
implements no production backend, authentication, scheduling, or provider feature.

## Scope and non-goals

Covered: dashboard, curriculum map, lesson, practice, results, native flashcard
review, deck management, and settings — on phone and desktop, with keyboard
navigation, visible focus, accessible labels, and information conveyed beyond
color.

Not covered: production authentication/authorization (T010/T011), real mastery
thresholds (T017/T018), full deck/card editing UX (T034), production scheduling
and timezone behavior (T033/T036), live Anki delivery (T021–T024), any provider
call. The prototype's rendered screens are design artifacts, not shipped product
behavior. Design and assets are original; nothing is copied from Kwiziq or any
other product.

## Design principles

1. **Three signals stay separate.** Grammar mastery (skill evidence from
   exercises), flashcard recall/scheduling (FSRS card state), and session review
   progress are distinct concepts. They are never merged into a single "progress"
   number and are visually distinguished by label, icon, and section — not by
   color alone.
2. **Recommend, never gate.** Curriculum prerequisite edges express recommended
   teaching order only. A learner can open any lesson in an enrolled track at any
   mastery level; unmet prerequisites surface as guidance, not a lock.
3. **Honest uncertainty.** "Not sure" is a first-class answer path so a guess
   never masquerades as knowledge. Uncertain is a distinct outcome from correct
   and incorrect everywhere it appears.
4. **Langlo owns the cards.** Native decks, notes, scheduling, and review history
   are first-class. Anki is an optional, user-initiated, one-way export — no sync,
   no reimport, no required account.
5. **Undecided stays visible.** Unresolved product decisions (day-boundary
   cutoff, mastery thresholds, Cloze scope, scheduler fuzz) are labeled as
   pending in the UI and here, not silently chosen.
6. **Deny by default.** Private surfaces inherit the existing guard: without a
   verified session they do not render learner data. The prototype namespace is
   the only place synthetic screens are reachable today.

## Information architecture

Primary navigation for the signed-in app (five destinations):

| Nav item | Production intent | Prototype route       | Focus                                               |
| -------- | ----------------- | --------------------- | --------------------------------------------------- |
| Home     | `/app`            | `/prototype`          | Dashboard: continue learning, due reviews, snapshot |
| Map      | `/app/map`        | `/prototype/map`      | Curriculum map for enrolled tracks                  |
| Review   | `/app/review`     | `/prototype/review`   | Native flashcard due queue                          |
| Decks    | `/app/decks`      | `/prototype/decks`    | Decks, notes, draft approval, Anki export           |
| Settings | `/app/settings`   | `/prototype/settings` | Preferences incl. timezone and export               |

Task-flow screens reached from the above (not primary nav):

| Screen   | Production intent                   | Prototype route       |
| -------- | ----------------------------------- | --------------------- |
| Lesson   | `/app/lesson/[skill]`               | `/prototype/lesson`   |
| Practice | `/app/session/[id]` (practice mode) | `/prototype/practice` |
| Results  | `/app/session/[id]/results`         | `/prototype/results`  |

On phone, primary nav is a bottom tab bar (five tabs); on desktop it is a top
bar — the prototype styles one `<nav>` for both. Practice and review run in a
focus chrome: minimal navigation, a visible exit link, and no tabs, so the task
stays foregrounded.

## User journeys

**Daily loop.** Home → see due-review count → Review → rate each card →
queue-empty state → back to Home → "Continue French A1" → Lesson → Practice →
immediate feedback per item → Results → optionally send a mistake to card
drafts → Decks shows the new draft awaiting approval.

**Exploration.** Map → pick any skill → unmet prerequisites appear as a
"Recommended first" hint (still openable) → Lesson → Practice.

**Card lifecycle.** Results "Keep as flashcard" creates a `draft` note →
Decks → pending approvals → learner approves (enters scheduling) or rejects →
approved notes generate cards that appear in Review when due.

**Anki export.** Decks → per-deck "Export to Anki" → disclosure that this is a
one-way package (no due dates, FSRS state, or history) → user confirms →
downloadable `.apkg`. Optional and never required for native study.

## Screen specifications

### 1. Dashboard — `/prototype`

- **Content:** greeting; "Continue" card naming the next recommended skill and
  its track; three clearly separated panels — _Grammar mastery_ (per-skill
  status chips), _Review queue_ (due now / later today / new cards), _Recent
  sessions_ (outcome counts including uncertain); links into Map, Decks,
  Settings.
- **Phone:** single column, panels stack; Continue and due counts first.
- **Desktop:** two-column grid; Continue card spans, panels side by side.
- **States:** loading (skeleton rows, `aria-busy`); empty/first-run (no sessions
  yet — prompts first lesson, zero-counts shown as "No reviews due" not hidden);
  error (panel-level error with retry button, not a page crash); forbidden is
  handled by the route guard, not rendered here.

### 2. Curriculum map — `/prototype/map`

- **Content:** enrolled-track selector; topic-grouped skill list (groups match
  catalog `topic` values); each row: skill name, mastery status (text + icon),
  prerequisite chips that anchor to the prerequisite row, and a "Recommended
  first" hint where unmet prerequisites exist. Legend explains statuses and that
  order is a suggestion. Retired skills are not shown to learners.
- **Phone:** single-column topic sections (same markup, narrower).
- **Desktop:** same list wider; topic groups as sections.
- **Keyboard:** rows are links; prerequisite chips are in-page anchor links;
  `:target` highlighting marks the jumped-to skill.
- **States:** loading; empty (track with no published skills); error;
  forbidden (requested track not enrolled → explains access is limited to
  enrolled tracks; mastery never causes this state).

### 3. Lesson — `/prototype/lesson`

- **Content:** skill title and track; plain-language explanation with original
  examples; "Recommended first" strip listing unmet prerequisites (dismissible,
  non-blocking); common-mistake note; CTA "Practice this skill".
- **States:** loading; error loading content; unavailable content (content
  version `quarantined` → honest "temporarily unavailable" notice); empty is not
  applicable (unpublished skills are unreachable from the map).
- **Notes:** explanation language follows the enrollment setting (e.g. English
  explanations for French; Brazilian Portuguese for the English track —
  prototype shows English for readability).

### 4. Practice — `/prototype/practice`

- **Content:** focus chrome; progress "Item 2 of 4"; one exercise at a time.
  The prototype walks through all four formats as a 4-item session:
  multiple-choice, typed-blank, translation, correction. Each item: prompt,
  answer control, **Submit**, **Not sure**, and per-item feedback after submit
  (correct / incorrect / uncertain with a short explanation, in a `role=status`
  live region), then **Next**.
- **Keyboard:** options are real radios/buttons; Enter submits the typed answer;
  feedback moves focus to **Next**; `Not sure` is a labeled button, not a
  hidden gesture.
- **States:** loading next item (brief disabled state); submission error with
  retry (idempotent — safe to retry); paused/resume banner; uncertain path
  exercised by pressing **Not sure**.

### 5. Results — `/prototype/results`

- **Content:** outcome counts as three numbers (correct / incorrect /
  uncertain — never a single percentage); per-skill evidence changes labeled
  as _grammar evidence_; missed items offered as card drafts ("Keep as
  flashcard" → creates a draft visible in Decks); next-step links (Review due
  cards, back to Map).
- **States:** loading; error (results could not be loaded — session history is
  retained, show safe message); partial/pending evaluation (one item still
  evaluating → honest "evaluating" badge, not a guess).

### 6. Flashcard review — `/prototype/review`

- **Content:** focus chrome; "Card 3 of 12 · French mistakes"; card front
  (Basic front or Cloze with the deletion hidden); **Reveal answer**
  (Space/Enter); then four rating buttons — Again / Hard / Good / Easy — each
  showing its next-due interval and a number-key hint (1–4). A "Suspended"
  badge is never possible here (suspended cards are excluded by the queue).
- **Keyboard:** Space/Enter reveals; 1–4 rate; rating buttons are focusable
  buttons; after rating, next card auto-advances with an `aria-live`
  announcement of progress.
- **States:** loading queue; empty queue ("All caught up" + next-due summary);
  error loading card; forbidden covered by guard. Interval labels are
  illustrative — real scheduling is server-owned FSRS.

### 7. Deck management — `/prototype/decks`

- **Content:** deck list with counts (new / learning / due, labeled as
  _scheduling_ state, not mastery); **Pending approval** section listing draft
  notes with Approve / Reject buttons; note list per deck with kind
  (Basic/Cloze), suspend toggle, and status badges; per-deck **Export to Anki**
  with the one-way disclosure; empty-deck and no-drafts states.
- **States:** loading; empty (no decks yet — create-deck affordance disabled in
  prototype with note that editing ships in T034); error; drafts-empty.
  Approve/reject and suspend are interactive in the prototype (local state
  only).

### 8. Settings — `/prototype/settings`

- **Content:** profile (synthetic learner, no real identity); per-enrollment
  explanation language; **learner timezone** (IANA, stored separately from the
  device zone) and **day boundary** field explicitly labeled _"proposed default
  04:00 — not yet decided (T036)"_; daily review and new-card caps; Anki section
  (export is always user-initiated; no connection settings because no sync
  exists); keyboard-shortcut help.
- **States:** saved confirmation (`role=status`); error saving; disabled
  controls carry reason text.

## Cross-cutting requirements

### States matrix

| Screen    | Loading       | Empty               | Error        | Uncertain          | Forbidden           |
| --------- | ------------- | ------------------- | ------------ | ------------------ | ------------------- |
| Dashboard | skeleton      | first-run copy      | panel retry  | —                  | guard-level         |
| Map       | skeleton      | no published skills | retry        | —                  | unenrolled track    |
| Lesson    | skeleton      | n/a                 | retry        | —                  | quarantined content |
| Practice  | item spinner  | n/a                 | submit retry | "Not sure" path    | guard-level         |
| Results   | skeleton      | n/a                 | safe reload  | pending-eval badge | guard-level         |
| Review    | queue spinner | all caught up       | card retry   | —                  | guard-level         |
| Decks     | skeleton      | no decks/drafts     | retry        | —                  | guard-level         |
| Settings  | n/a           | n/a                 | save retry   | —                  | guard-level         |

Loading uses `aria-busy` on the affected region; errors use `role=alert` with a
retry action; success/feedback uses `role=status`. Nothing relies on color
alone: outcomes pair text labels with distinct symbols, mastery chips carry
their status name, and the three progress signals sit in separately labeled
sections.

### Accessibility

- Full keyboard operability; no keyboard traps; focus-visible outlines on all
  interactive elements (extends the existing global link style to buttons,
  radios, switches, tabs).
- Skip link (existing), `header`/`nav`/`main`/`footer` landmarks, one `h1` per
  screen, logical focus order; after view changes, focus moves to the new
  heading or the primary control.
- Minimum 44×44 px touch targets; options have visible labels (no icon-only
  controls without names); form fields use associated `label` elements.
- `prefers-reduced-motion` respected; no auto-playing animation; contrast
  targets WCAG AA (4.5:1 text).
- Rating buttons announce label + interval + shortcut; feedback regions are
  live regions; the map's status chips expose status in text.

### Visual language (prototype tokens)

Reuses the existing foundation palette: `#f5f7fb` background, `#172d46` text,
`#1b5982` links, `#d38e17` focus outline, white cards with `#d9e2ef` borders.
Mastery statuses: Not started / Introduced / Practising / Strong (illustrative
labels pending T018) — each with a distinct symbol. Scheduling states: New /
Learning / Due / Suspended. Outcomes: Correct / Incorrect / Uncertain. These
three vocabularies never share a label.

## Decisions this task

- Prototypes live in-app under `/prototype/**` with synthetic data (approved
  2026-10-10) — validated by the normal checks; the `/app` guard is unchanged.
- Curriculum map is a topic-grouped list (approved); no canvas DAG.
- "Uncertain" is learner-declared via an explicit "Not sure" path (approved).
- Practice gives immediate per-item feedback (approved).

## Open questions kept explicit

- Day-boundary cutoff and learner-timezone change behavior — T036; prototype
  labels the 04:00 default as proposed only.
- Mastery thresholds and labels — T017/T018; prototype statuses illustrative.
- Full Cloze contract and deck editing UX — T034; prototype shows read-only
  notes plus draft approval and suspend.
- Scheduler fuzz and final FSRS parameters — T033; interval labels illustrative.
- Multi-device review resume — server-owned state is designed for it; not
  exercised by the prototype.
- Assessment and mixed-review session modes — schema modes exist; prototype
  demos the practice mode only.

## Prototype implementation notes

- Routes under `src/routes/prototype/`; synthetic dataset in
  `src/lib/prototype/data.ts` (client-safe, no server-only imports).
- `?state=` query selects rendered variants (normal/loading/empty/error/
  forbidden) via a per-screen state switcher in the prototype layout, so every
  state is reachable for review and e2e.
- Interactions (reveal/rate, answer/feedback, approve/reject, suspend) run
  client-side only; nothing persists.
- Prototype routes are excluded from indexing (robots meta + header) and carry
  a visible "Design prototype — synthetic data" banner.
