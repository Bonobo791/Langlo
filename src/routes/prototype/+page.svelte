<script lang="ts">
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import Chip from '../../lib/prototype/Chip.svelte';
  import StateSwitcher from '../../lib/prototype/StateSwitcher.svelte';
  import {
    frenchA1,
    learner,
    masteryLabel,
    outcomeLabel,
    recentSessions,
    reviewQueue
  } from '../../lib/prototype/data';

  const screenState = $derived(page.url.searchParams.get('state') ?? 'normal');
  const masterySymbols = {
    'not-started': '○',
    introduced: '◐',
    practising: '◑',
    strong: '●'
  } as const;
  const outcomeSymbols = {
    correct: '✓',
    incorrect: '✗',
    uncertain: '?'
  } as const;
  const dashboardSkills = frenchA1;
</script>

<svelte:head><title>Home | Langlo prototype</title></svelte:head>

<StateSwitcher states={['normal', 'loading', 'empty', 'error']} />

<h1>Welcome back, {learner.displayName}</h1>

{#if screenState === 'loading'}
  <div class="panel" aria-busy="true" aria-label="Loading dashboard">
    <div class="skel"></div>
    <div class="skel"></div>
    <div class="skel short"></div>
    <p class="muted">Loading your study overview…</p>
  </div>
{:else if screenState === 'empty'}
  <section class="panel" aria-labelledby="first-run">
    <h2 id="first-run">Start your first lesson</h2>
    <p>
      No sessions yet. Your grammar mastery, review queue, and session history
      will appear here once you begin.
    </p>
    <ul>
      <li>Grammar mastery: nothing recorded yet</li>
      <li>Review queue: no reviews due — no cards yet</li>
      <li>Recent sessions: none</li>
    </ul>
    <a class="button" href={resolve('/prototype/lesson')}>Open first lesson</a>
  </section>
{:else if screenState === 'error'}
  <div class="panel" role="alert">
    <h2>Overview unavailable</h2>
    <p>
      Your progress could not be loaded right now. Nothing was lost — the
      recorded history is unchanged.
    </p>
    <a class="button" href={resolve('/prototype')}>Retry</a>
  </div>
{:else}
  <section class="panel continue" aria-labelledby="continue-heading">
    <p class="eyebrow">Continue · French A1 · Present tense</p>
    <h2 id="continue-heading">
      Use être and avoir in common present-tense patterns
    </h2>
    <p class="hint">
      Recommended first: Use subject pronouns with common verbs (Not started).
      You can still open this lesson.
    </p>
    <div class="actions">
      <a class="button" href={resolve('/prototype/lesson')}>Open lesson</a>
      <a href={resolve('/prototype/map')}>Browse the map</a>
    </div>
  </section>

  <div class="grid">
    <section class="panel" aria-labelledby="mastery-heading">
      <h2 id="mastery-heading">Grammar mastery</h2>
      <p class="signal-note">
        From exercise evidence — separate from flashcard recall.
      </p>
      <ul class="skill-list">
        {#each dashboardSkills as skill (skill.id)}
          <li>
            <span class="skill-name">{skill.name}</span>
            <Chip
              variant="mastery"
              symbol={masterySymbols[skill.mastery]}
              label={masteryLabel[skill.mastery]}
            />
          </li>
        {/each}
      </ul>
      <a href={resolve('/prototype/map')}>Full curriculum map</a>
    </section>

    <section class="panel" aria-labelledby="queue-heading">
      <h2 id="queue-heading">Review queue</h2>
      <p class="signal-note">
        Flashcard scheduling — separate from grammar mastery.
      </p>
      <dl class="queue">
        <div>
          <dt>Due now</dt>
          <dd>{reviewQueue.dueNow}</dd>
        </div>
        <div>
          <dt>Later today</dt>
          <dd>{reviewQueue.laterToday}</dd>
        </div>
        <div>
          <dt>New cards available</dt>
          <dd>{reviewQueue.newAvailable}</dd>
        </div>
      </dl>
      <a class="button" href={resolve('/prototype/review')}>Start review</a>
      <p class="muted">
        <a href={resolve('/prototype/decks')}>Manage decks and drafts</a>
      </p>
    </section>

    <section class="panel" aria-labelledby="sessions-heading">
      <h2 id="sessions-heading">Recent sessions</h2>
      <ul class="sessions">
        {#each recentSessions as session (session.when)}
          <li>
            <span class="skill-name"
              >{session.when} · {session.mode} — {session.skill}</span
            >
            <span class="outcomes">
              <Chip
                variant="outcome"
                symbol={outcomeSymbols.correct}
                label="{session.correct} {outcomeLabel.correct.toLowerCase()}"
              />
              <Chip
                variant="outcome"
                symbol={outcomeSymbols.incorrect}
                label="{session.incorrect} {outcomeLabel.incorrect.toLowerCase()}"
              />
              <Chip
                variant="outcome"
                symbol={outcomeSymbols.uncertain}
                label="{session.uncertain} {outcomeLabel.uncertain.toLowerCase()}"
              />
            </span>
          </li>
        {/each}
      </ul>
      <p class="muted">
        <a href={resolve('/prototype/settings')}>Preferences and timezone</a>
      </p>
    </section>
  </div>
{/if}

<style>
  .panel {
    padding: 1.25rem;
    background: white;
    border: 1px solid #d9e2ef;
    border-radius: 0.8rem;
    margin-bottom: 1.25rem;
  }
  .grid {
    display: grid;
    gap: 1.25rem;
    grid-template-columns: 1fr;
  }
  @media (min-width: 720px) {
    .grid {
      grid-template-columns: 1fr 1fr;
    }
    .grid .panel:last-child {
      grid-column: 1 / -1;
    }
  }
  .eyebrow {
    color: #49617a;
    font-weight: 650;
    margin: 0;
  }
  .hint {
    color: #5d4a12;
    background: #fbf3dd;
    border: 1px solid #e4cf9a;
    border-radius: 0.5rem;
    padding: 0.5rem 0.8rem;
  }
  .actions {
    display: flex;
    gap: 1rem;
    align-items: center;
    flex-wrap: wrap;
  }
  .button {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    padding: 0.4rem 1.1rem;
    background: #1b5982;
    color: white;
    border-radius: 0.6rem;
    text-decoration: none;
    font-weight: 650;
  }
  .signal-note {
    color: #49617a;
    font-size: 0.85rem;
    margin-top: -0.5rem;
  }
  .skill-list,
  .sessions {
    list-style: none;
    margin: 0 0 1rem;
    padding: 0;
  }
  .skill-list li,
  .sessions li {
    display: flex;
    justify-content: space-between;
    gap: 0.8rem;
    padding: 0.45rem 0;
    border-bottom: 1px solid #edf1f7;
    align-items: baseline;
  }
  .skill-name {
    min-width: 0;
  }
  .queue {
    display: flex;
    gap: 1.5rem;
    margin: 0 0 1rem;
  }
  .queue div {
    text-align: center;
  }
  .queue dt {
    color: #49617a;
    font-size: 0.85rem;
  }
  .queue dd {
    margin: 0;
    font-size: 1.8rem;
    font-weight: 700;
  }
  .outcomes {
    display: inline-flex;
    gap: 0.4rem;
    flex-wrap: wrap;
  }
  .muted {
    color: #49617a;
    font-size: 0.9rem;
  }
  .skel {
    height: 1.1rem;
    border-radius: 0.4rem;
    background: #e8eef6;
    margin-bottom: 0.8rem;
  }
  .skel.short {
    width: 55%;
  }
</style>
