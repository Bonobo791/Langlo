<script lang="ts">
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import StateSwitcher from '../../../lib/prototype/StateSwitcher.svelte';
  import { ratingIntervals, reviewCards } from '../../../lib/prototype/data';

  const screenState = $derived(page.url.searchParams.get('state') ?? 'normal');

  let index = $state(0);
  let revealed = $state(false);
  let rated = $state(0);
  let lastRating = $state('');

  const card = $derived(reviewCards[index]);
  const finished = $derived(rated >= reviewCards.length);
  const remaining = $derived(reviewCards.length - rated);

  function rate(rating: string) {
    if (!revealed || finished) return;
    lastRating = rating;
    rated += 1;
    if (index < reviewCards.length - 1) {
      index += 1;
      revealed = false;
    }
  }

  function onKeydown(event: KeyboardEvent) {
    if (screenState !== 'normal' || finished) return;
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
    if (!revealed && event.key === ' ') {
      event.preventDefault();
      revealed = true;
      return;
    }
    if (revealed) {
      const match = ratingIntervals.find((r) => r.key === event.key);
      if (match) rate(match.rating);
    }
  }
</script>

<svelte:window onkeydown={onKeydown} />
<svelte:head><title>Review | Langlo prototype</title></svelte:head>

<StateSwitcher states={['normal', 'loading', 'empty', 'error']} />

<h1>Flashcard review</h1>

{#if screenState === 'loading'}
  <div class="panel" aria-busy="true" aria-label="Loading review queue">
    <div class="skel"></div>
    <div class="skel short"></div>
    <p class="muted">Loading your due cards…</p>
  </div>
{:else if screenState === 'error'}
  <div class="panel" role="alert">
    <h2>Card could not be loaded</h2>
    <p>The next due card could not be loaded. Your review history is intact.</p>
    <a class="button" href={resolve('/prototype/review')}>Retry</a>
    <a href={resolve('/prototype')}>Exit session</a>
  </div>
{:else if screenState === 'empty' || finished}
  <section class="panel" aria-labelledby="caught-up">
    <h2 id="caught-up">All caught up</h2>
    <p>
      No cards are due right now.
      {#if rated > 0}
        You rated {rated} card{rated === 1 ? '' : 's'} this session{lastRating
          ? ` (last rating: ${lastRating})`
          : ''}.
      {/if}
      The next card is scheduled for later today — queue boundaries follow your learner
      timezone from Settings.
    </p>
    <a class="button" href={resolve('/prototype')}>Back to Home</a>
    <a href={resolve('/prototype/decks')}>Manage decks</a>
  </section>
{:else}
  <p class="progress" role="status">
    Card {rated + 1} of {reviewCards.length} · {card.deck} · {remaining}
    remaining
  </p>

  <section class="card panel" aria-label="Flashcard">
    <p class="kind">{card.kind === 'cloze' ? 'Cloze deletion' : 'Basic'}</p>
    <div class="side front">
      <h2 class="sr-label">Prompt</h2>
      <p>{card.front}</p>
    </div>
    {#if revealed}
      <div class="side back">
        <h2 class="sr-label">Answer</h2>
        <p>{card.back}</p>
      </div>
    {/if}
  </section>

  {#if !revealed}
    <button class="button" type="button" onclick={() => (revealed = true)}>
      Reveal answer <span class="key-hint">(Space)</span>
    </button>
  {:else}
    <fieldset class="ratings">
      <legend>How well did you recall it?</legend>
      <div class="rating-row">
        {#each ratingIntervals as interval (interval.rating)}
          <button
            class="rating"
            type="button"
            onclick={() => rate(interval.rating)}
            aria-label="{interval.label} — next review {interval.interval} (key {interval.key})"
          >
            <span class="rating-label">{interval.label}</span>
            <span class="rating-interval">{interval.interval}</span>
            <span class="key-hint">{interval.key}</span>
          </button>
        {/each}
      </div>
      <p class="muted">
        Intervals are illustrative — real scheduling is server-owned FSRS.
        Ratings feed flashcard recall only, never grammar mastery.
      </p>
    </fieldset>
  {/if}
{/if}

<style>
  .progress {
    color: #49617a;
    font-weight: 600;
  }
  .panel {
    padding: 1.5rem;
    background: white;
    border: 1px solid #d9e2ef;
    border-radius: 0.8rem;
    margin-bottom: 1.25rem;
  }
  .card .kind {
    color: #49617a;
    font-size: 0.85rem;
    font-weight: 650;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    margin: 0 0 0.8rem;
  }
  .sr-label {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    clip-path: inset(50%);
    white-space: nowrap;
  }
  .front p {
    font-size: 1.35rem;
    font-weight: 600;
  }
  .back {
    border-top: 1px solid #d9e2ef;
    margin-top: 0.8rem;
    padding-top: 0.8rem;
  }
  .back p {
    font-size: 1.15rem;
  }
  .button {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    padding: 0.5rem 1.2rem;
    background: #1b5982;
    color: white;
    border: none;
    border-radius: 0.6rem;
    text-decoration: none;
    font-weight: 650;
    font-size: 1rem;
    cursor: pointer;
  }
  .key-hint {
    opacity: 0.8;
    font-size: 0.85em;
    font-weight: 500;
  }
  .ratings {
    border: none;
    margin: 0;
    padding: 0;
  }
  .ratings legend {
    font-weight: 650;
    margin-bottom: 0.6rem;
    padding: 0;
  }
  .rating-row {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0.6rem;
  }
  @media (max-width: 560px) {
    .rating-row {
      grid-template-columns: repeat(2, 1fr);
    }
  }
  .rating {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.15rem;
    min-height: 44px;
    padding: 0.6rem 0.4rem;
    background: white;
    border: 1px solid #b8c6d8;
    border-radius: 0.6rem;
    cursor: pointer;
    font-size: 1rem;
  }
  .rating-label {
    font-weight: 700;
  }
  .rating-interval {
    color: #49617a;
    font-size: 0.85rem;
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
