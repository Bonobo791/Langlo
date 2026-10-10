<script lang="ts">
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import StateSwitcher from '../../../lib/prototype/StateSwitcher.svelte';
  import { learner } from '../../../lib/prototype/data';

  const screenState = $derived(page.url.searchParams.get('state') ?? 'normal');

  let explanationLanguages = $state<Record<string, string>>(
    Object.fromEntries(
      learner.enrollments.map((e) => [e.trackId, e.explanationLanguage])
    )
  );
  let timezone = $state('America/New_York');
  let dayBoundary = $state('04:00');
  let reviewCap = $state(40);
  let newCardCap = $state(10);
  let showExport = $state(true);
  let saved = $state(false);

  const timezones = [
    'America/New_York',
    'America/Sao_Paulo',
    'Europe/Lisbon',
    'Europe/Berlin',
    'UTC'
  ];
  const languages = ['English', 'Brazilian Portuguese'];
</script>

<svelte:head><title>Settings | Langlo prototype</title></svelte:head>

<StateSwitcher states={['normal', 'error']} />

<h1>Settings</h1>

{#if saved}
  <p class="notice" role="status">
    Preferences saved — prototype only, nothing persisted.
  </p>
{/if}
{#if screenState === 'error'}
  <div class="panel" role="alert">
    <h2>Could not save</h2>
    <p>Your preferences were not changed. Try again.</p>
    <a class="button" href={resolve('/prototype/settings')}>Back to settings</a>
  </div>
{:else}
  <form
    onsubmit={(event) => {
      event.preventDefault();
      saved = true;
    }}
  >
    <section class="panel" aria-labelledby="profile-heading">
      <h2 id="profile-heading">Profile</h2>
      <p>
        Signed in as <strong>{learner.displayName}</strong> (synthetic learner — real
        accounts arrive with T010).
      </p>
    </section>

    <section class="panel" aria-labelledby="language-heading">
      <h2 id="language-heading">Explanation language</h2>
      <p class="muted">Per enrollment — the language lessons are written in.</p>
      {#each learner.enrollments as enrollment (enrollment.trackId)}
        <label class="field">
          <span>{enrollment.label} explanations</span>
          <select bind:value={explanationLanguages[enrollment.trackId]}>
            {#each languages as language (language)}
              <option value={language}>{language}</option>
            {/each}
          </select>
        </label>
      {/each}
    </section>

    <section class="panel" aria-labelledby="schedule-heading">
      <h2 id="schedule-heading">Review schedule</h2>
      <p class="muted">
        Scheduling state belongs to flashcard recall; these limits never change
        grammar mastery.
      </p>
      <label class="field">
        <span>Your timezone</span>
        <select bind:value={timezone}>
          {#each timezones as zone (zone)}
            <option value={zone}>{zone}</option>
          {/each}
        </select>
      </label>
      <p class="muted">
        Stored separately from your device's timezone — day boundaries follow
        this zone even while travelling.
      </p>
      <label class="field">
        <span>Day boundary for due queues</span>
        <input type="time" bind:value={dayBoundary} />
      </label>
      <p class="undecided">
        Proposed default 04:00 local — this boundary is <strong
          >not yet decided</strong
        > (T036 covers zone changes, DST, and missed cutoffs).
      </p>
      <label class="field">
        <span>Daily review cap</span>
        <input type="number" min="1" max="500" bind:value={reviewCap} />
      </label>
      <label class="field">
        <span>New cards per day</span>
        <input type="number" min="0" max="100" bind:value={newCardCap} />
      </label>
    </section>

    <section class="panel" aria-labelledby="anki-heading">
      <h2 id="anki-heading">Anki export</h2>
      <p>
        Langlo owns your cards and schedule. Export is optional, manual, and
        one-way — there is no Anki connection or sync to configure here.
      </p>
      <label class="check">
        <input type="checkbox" bind:checked={showExport} />
        Show the “Export to Anki” action in Decks
      </label>
    </section>

    <section class="panel" aria-labelledby="keyboard-heading">
      <h2 id="keyboard-heading">Keyboard shortcuts</h2>
      <dl class="keys">
        <div>
          <dt>Space / Enter</dt>
          <dd>Reveal answer (review)</dd>
        </div>
        <div>
          <dt>1–4</dt>
          <dd>Rate Again / Hard / Good / Easy</dd>
        </div>
        <div>
          <dt>Enter</dt>
          <dd>Submit a written answer (practice)</dd>
        </div>
        <div>
          <dt>Tab / Shift+Tab</dt>
          <dd>Move between controls everywhere</dd>
        </div>
      </dl>
    </section>

    <section class="panel" aria-labelledby="data-heading">
      <h2 id="data-heading">Your data</h2>
      <button class="secondary" type="button" disabled>
        Export all my data — arrives with the data-lifecycle task (T026)
      </button>
      <button class="secondary danger" type="button" disabled>
        Delete account — not available yet
      </button>
    </section>

    <div class="actions">
      <button class="button" type="submit">Save preferences</button>
      <a href={resolve('/prototype')}>Back to Home</a>
    </div>
  </form>
{/if}

<style>
  .notice {
    padding: 0.5rem 0.8rem;
    background: #e8f3ec;
    border: 1px solid #bcd8c4;
    border-radius: 0.5rem;
    font-weight: 600;
  }
  .panel {
    padding: 1.25rem;
    background: white;
    border: 1px solid #d9e2ef;
    border-radius: 0.8rem;
    margin-bottom: 1.25rem;
  }
  .field {
    display: block;
    margin: 0.9rem 0;
  }
  .field span {
    display: block;
    font-weight: 600;
    margin-bottom: 0.3rem;
  }
  .field select,
  .field input {
    min-height: 44px;
    padding: 0.4rem 0.7rem;
    font-size: 1rem;
    border: 1px solid #b8c6d8;
    border-radius: 0.6rem;
    min-width: 14rem;
  }
  .check {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    min-height: 44px;
  }
  .check input {
    width: 1.2rem;
    height: 1.2rem;
  }
  .undecided {
    color: #5d4a12;
    background: #fbf3dd;
    border: 1px solid #e4cf9a;
    border-radius: 0.5rem;
    padding: 0.5rem 0.8rem;
    max-width: 34rem;
  }
  .muted {
    color: #49617a;
    font-size: 0.9rem;
  }
  .keys div {
    display: flex;
    gap: 1rem;
    padding: 0.3rem 0;
  }
  .keys dt {
    font-weight: 700;
    min-width: 8rem;
  }
  .keys dd {
    margin: 0;
  }
  .secondary {
    display: block;
    min-height: 44px;
    padding: 0.4rem 1rem;
    margin: 0.4rem 0;
    background: white;
    color: #172d46;
    border: 1px solid #b8c6d8;
    border-radius: 0.6rem;
    font-weight: 650;
    cursor: pointer;
  }
  .secondary:disabled {
    color: #7d92a8;
    cursor: not-allowed;
  }
  .danger {
    border-color: #c99;
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
    border: none;
    border-radius: 0.6rem;
    text-decoration: none;
    font-weight: 650;
    font-size: 1rem;
    cursor: pointer;
  }
</style>
