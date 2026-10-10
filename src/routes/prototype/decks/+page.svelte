<script lang="ts">
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import Chip from '../../../lib/prototype/Chip.svelte';
  import StateSwitcher from '../../../lib/prototype/StateSwitcher.svelte';
  import {
    decks as initialDecks,
    schedulingLabel,
    type Deck
  } from '../../../lib/prototype/data';

  const screenState = $derived(page.url.searchParams.get('state') ?? 'normal');

  const schedulingSymbols = {
    new: '✚',
    learning: '↻',
    due: '●',
    suspended: '❚❚'
  } as const;
  const statusLabel = {
    draft: 'Draft',
    approved: 'Approved',
    rejected: 'Rejected'
  } as const;

  let decks = $state<Deck[]>(structuredClone(initialDecks));
  let exportOpen = $state<string | null>(null);
  let exported = $state<string | null>(null);
  let notice = $state('');

  function setNoteStatus(
    deck: Deck,
    noteId: string,
    status: 'approved' | 'rejected'
  ) {
    const note = deck.notes.find((n) => n.id === noteId);
    if (note) {
      note.status = status;
      notice = `“${note.preview}” ${statusLabel[status].toLowerCase()}.`;
    }
  }
  function toggleSuspend(deck: Deck, noteId: string) {
    const note = deck.notes.find((n) => n.id === noteId);
    if (note) {
      note.scheduling =
        note.scheduling === 'suspended' ? 'learning' : 'suspended';
      notice = `“${note.preview}” ${note.scheduling === 'suspended' ? 'suspended — it will not appear in review' : 'resumed'}.`;
    }
  }
  const pendingDrafts = $derived(
    decks.flatMap((deck) =>
      deck.notes
        .filter((note) => note.status === 'draft')
        .map((note) => ({ deck, note }))
    )
  );
</script>

<svelte:head><title>Decks | Langlo prototype</title></svelte:head>

<StateSwitcher states={['normal', 'loading', 'empty', 'error']} />

<h1>Decks and card drafts</h1>
<p class="signal-note">
  Scheduling state (New / Learning / Due / Suspended) describes flashcard recall
  — it never changes grammar mastery.
</p>

{#if notice}
  <p class="notice" role="status">{notice}</p>
{/if}

{#if screenState === 'loading'}
  <div class="panel" aria-busy="true" aria-label="Loading decks">
    <div class="skel"></div>
    <div class="skel"></div>
    <div class="skel short"></div>
    <p class="muted">Loading your decks…</p>
  </div>
{:else if screenState === 'empty'}
  <section class="panel" aria-labelledby="no-decks">
    <h2 id="no-decks">No decks yet</h2>
    <p>
      Decks hold your notes and the cards generated from them. Keep a mistake
      from a practice session and it will arrive here as a draft.
    </p>
    <button class="secondary" type="button" disabled
      >New deck (editing arrives with T034)</button
    >
  </section>
{:else if screenState === 'error'}
  <div class="panel" role="alert">
    <h2>Decks unavailable</h2>
    <p>Your decks could not be loaded. No cards were changed.</p>
    <a class="button" href={resolve('/prototype/decks')}>Retry</a>
  </div>
{:else}
  <section class="panel" aria-labelledby="drafts-heading">
    <h2 id="drafts-heading">Pending approval ({pendingDrafts.length})</h2>
    {#if pendingDrafts.length === 0}
      <p class="muted">
        No drafts waiting. Mistakes you keep from practice sessions appear here
        until you approve or reject them.
      </p>
    {:else}
      <ul class="drafts">
        {#each pendingDrafts as { deck, note } (note.id)}
          <li>
            <div class="draft-info">
              <span class="kind"
                >{note.kind === 'cloze' ? 'Cloze' : 'Basic'}</span
              >
              <span>{note.preview}</span>
              <span class="muted">in {deck.name}</span>
            </div>
            <div class="draft-actions">
              <button
                class="secondary"
                type="button"
                onclick={() => setNoteStatus(deck, note.id, 'approved')}
                >Approve</button
              >
              <button
                class="secondary"
                type="button"
                onclick={() => setNoteStatus(deck, note.id, 'rejected')}
                >Reject</button
              >
            </div>
          </li>
        {/each}
      </ul>
    {/if}
  </section>

  {#each decks as deck (deck.id)}
    <section class="panel" aria-labelledby="deck-{deck.id}">
      <h2 id="deck-{deck.id}">{deck.name}</h2>
      <ul class="counts" aria-label="Scheduling counts">
        <li>
          <Chip
            variant="schedule"
            symbol={schedulingSymbols.new}
            label="{deck.counts.new} new"
          />
        </li>
        <li>
          <Chip
            variant="schedule"
            symbol={schedulingSymbols.learning}
            label="{deck.counts.learning} learning"
          />
        </li>
        <li>
          <Chip
            variant="schedule"
            symbol={schedulingSymbols.due}
            label="{deck.counts.due} due"
          />
        </li>
        <li>
          <Chip
            variant="schedule"
            symbol={schedulingSymbols.suspended}
            label="{deck.counts.suspended} suspended"
          />
        </li>
      </ul>

      <table class="notes">
        <caption class="sr-only">Notes in {deck.name}</caption>
        <thead>
          <tr>
            <th scope="col">Note</th>
            <th scope="col">Status</th>
            <th scope="col">Scheduling</th>
            <th scope="col">Suspended</th>
          </tr>
        </thead>
        <tbody>
          {#each deck.notes as note (note.id)}
            <tr>
              <td>
                <span class="kind"
                  >{note.kind === 'cloze' ? 'Cloze' : 'Basic'}</span
                >
                {note.preview}
              </td>
              <td>
                <Chip
                  variant="neutral"
                  symbol="•"
                  label={statusLabel[note.status]}
                />
              </td>
              <td>
                <Chip
                  variant="schedule"
                  symbol={schedulingSymbols[note.scheduling]}
                  label={schedulingLabel[note.scheduling]}
                />
              </td>
              <td>
                <label class="suspend">
                  <input
                    type="checkbox"
                    checked={note.scheduling === 'suspended'}
                    disabled={note.status !== 'approved'}
                    onchange={() => toggleSuspend(deck, note.id)}
                  />
                  {note.scheduling === 'suspended' ? 'Yes' : 'No'}
                </label>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>

      <div class="export">
        {#if exportOpen === deck.id}
          <div
            class="export-panel"
            role="group"
            aria-label="Export {deck.name} to Anki"
          >
            <p>
              Export is one-way: the package carries note fields, note types,
              deck name, and tags. It does <strong>not</strong> include Langlo due
              dates, scheduling state, or review history, and nothing is imported
              back. Import it into Anki yourself when you want a copy there.
            </p>
            {#if exported === deck.id}
              <p role="status">
                Package ready: <strong>langlo-{deck.id}.apkg</strong> (synthetic —
                nothing was written).
              </p>
            {:else}
              <button
                class="secondary"
                type="button"
                onclick={() => (exported = deck.id)}>Generate package</button
              >
              <button
                class="linklike"
                type="button"
                onclick={() => (exportOpen = null)}>Cancel</button
              >
            {/if}
          </div>
        {:else}
          <button
            class="secondary"
            type="button"
            onclick={() => (exportOpen = deck.id)}>Export to Anki…</button
          >
        {/if}
      </div>
    </section>
  {/each}
{/if}

<style>
  .signal-note,
  .muted {
    color: #49617a;
    font-size: 0.9rem;
  }
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
  .drafts {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .drafts li {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    padding: 0.6rem 0;
    border-bottom: 1px solid #edf1f7;
    flex-wrap: wrap;
  }
  .draft-info {
    display: flex;
    gap: 0.6rem;
    align-items: baseline;
    flex-wrap: wrap;
  }
  .draft-actions {
    display: flex;
    gap: 0.5rem;
  }
  .kind {
    font-size: 0.8rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: #49617a;
  }
  .counts {
    list-style: none;
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    padding: 0;
    margin: 0 0 1rem;
  }
  .notes {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 1rem;
    font-size: 0.95rem;
  }
  .notes th,
  .notes td {
    text-align: left;
    padding: 0.5rem 0.6rem;
    border-bottom: 1px solid #edf1f7;
    vertical-align: top;
  }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    clip-path: inset(50%);
    white-space: nowrap;
  }
  .suspend {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    min-height: 44px;
  }
  .suspend input {
    width: 1.2rem;
    height: 1.2rem;
  }
  .export-panel {
    border: 1px solid #d9e2ef;
    border-radius: 0.6rem;
    padding: 0.8rem 1rem;
    background: #f5f7fb;
  }
  .secondary {
    min-height: 44px;
    padding: 0.4rem 1rem;
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
  .linklike {
    background: none;
    border: none;
    color: #1b5982;
    text-decoration: underline;
    cursor: pointer;
    min-height: 44px;
    font-size: 1rem;
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
  .skel {
    height: 1.1rem;
    border-radius: 0.4rem;
    background: #e8eef6;
    margin-bottom: 0.8rem;
  }
  .skel.short {
    width: 55%;
  }
  @media (max-width: 640px) {
    .notes thead {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
      clip-path: inset(50%);
      white-space: nowrap;
    }
    .notes,
    .notes tbody,
    .notes tr,
    .notes td {
      display: block;
      width: 100%;
    }
    .notes tr {
      padding: 0.6rem 0;
      border-bottom: 1px solid #edf1f7;
    }
    .notes td {
      border: none;
      padding: 0.2rem 0;
    }
  }
</style>
