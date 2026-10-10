<script lang="ts">
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import StateSwitcher from '../../../lib/prototype/StateSwitcher.svelte';

  const screenState = $derived(page.url.searchParams.get('state') ?? 'normal');
</script>

<svelte:head><title>Lesson | Langlo prototype</title></svelte:head>

<StateSwitcher states={['normal', 'loading', 'error', 'unavailable']} />

{#if screenState === 'loading'}
  <div class="panel" aria-busy="true" aria-label="Loading lesson">
    <div class="skel"></div>
    <div class="skel"></div>
    <div class="skel short"></div>
    <p class="muted">Loading lesson…</p>
  </div>
{:else if screenState === 'error'}
  <div class="panel" role="alert">
    <h1>Lesson unavailable</h1>
    <p>The lesson content could not be loaded. Your progress is unchanged.</p>
    <a class="button" href={resolve('/prototype/lesson')}>Retry</a>
  </div>
{:else if screenState === 'unavailable'}
  <div class="panel" role="alert">
    <h1>Content temporarily unavailable</h1>
    <p>
      This lesson's content version was withdrawn for review. It will return
      once a checked version replaces it — your recorded progress is unaffected.
    </p>
    <a class="button" href={resolve('/prototype/map')}>Back to the map</a>
  </div>
{:else}
  <nav class="crumbs" aria-label="Breadcrumb">
    <a href={resolve('/prototype/map')}>Map</a>
    <span aria-hidden="true">›</span> French A1
    <span aria-hidden="true">›</span>
    Present tense
  </nav>

  <h1>Use être and avoir in common present-tense patterns</h1>

  <aside class="recommended" aria-label="Recommended first">
    <strong>Recommended first:</strong>
    <a href={resolve('/prototype/map') + '#skill-fr-a1-002'}
      >Use subject pronouns with common verbs</a
    >
    (Not started). This lesson is still open — the map's order is a suggestion, not
    a lock.
  </aside>

  <section class="panel" aria-labelledby="explain">
    <h2 id="explain">The two most frequent verbs</h2>
    <p>
      <strong>Être</strong> (to be) describes identity, state, and location;
      <strong>avoir</strong> (to have) describes possession. Both are irregular and
      appear in almost every A1 conversation.
    </p>
    <div class="tables">
      <table>
        <caption>être — to be</caption>
        <tbody>
          <tr><th scope="row">je</th><td>suis</td></tr>
          <tr><th scope="row">tu</th><td>es</td></tr>
          <tr><th scope="row">il/elle</th><td>est</td></tr>
          <tr><th scope="row">nous</th><td>sommes</td></tr>
          <tr><th scope="row">vous</th><td>êtes</td></tr>
          <tr><th scope="row">ils/elles</th><td>sont</td></tr>
        </tbody>
      </table>
      <table>
        <caption>avoir — to have</caption>
        <tbody>
          <tr><th scope="row">j’</th><td>ai</td></tr>
          <tr><th scope="row">tu</th><td>as</td></tr>
          <tr><th scope="row">il/elle</th><td>a</td></tr>
          <tr><th scope="row">nous</th><td>avons</td></tr>
          <tr><th scope="row">vous</th><td>avez</td></tr>
          <tr><th scope="row">ils/elles</th><td>ont</td></tr>
        </tbody>
      </table>
    </div>
    <h3>Examples</h3>
    <ul>
      <li>« Je suis fatiguée. » — I am tired. (être for state)</li>
      <li>
        « Tu as un frère ? » — Do you have a brother? (avoir for possession)
      </li>
      <li>« Nous sommes ici. » — We are here. (être for location)</li>
    </ul>
    <p class="mistake">
      <strong>Common mistake:</strong> mixing <em>es</em> (être) and
      <em>as</em> (avoir) — they sound similar but come from different verbs. « Tu
      es prêt » = you are ready; « Tu as raison » = you are right.
    </p>
  </section>

  <div class="actions">
    <a class="button" href={resolve('/prototype/practice')}
      >Practice this skill</a
    >
    <a href={resolve('/prototype/map')}>Back to the map</a>
  </div>
{/if}

<style>
  .crumbs {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
    color: #49617a;
    font-size: 0.9rem;
  }
  .recommended {
    border: 1px solid #e4cf9a;
    background: #fbf3dd;
    color: #5d4a12;
    border-radius: 0.6rem;
    padding: 0.7rem 0.9rem;
    margin-bottom: 1.25rem;
  }
  .panel {
    padding: 1.25rem;
    background: white;
    border: 1px solid #d9e2ef;
    border-radius: 0.8rem;
    margin-bottom: 1.5rem;
  }
  .tables {
    display: flex;
    gap: 2rem;
    flex-wrap: wrap;
    margin: 1rem 0;
  }
  table {
    border-collapse: collapse;
    min-width: 12rem;
  }
  caption {
    text-align: left;
    font-weight: 650;
    padding-bottom: 0.4rem;
  }
  th,
  td {
    border: 1px solid #d9e2ef;
    padding: 0.35rem 0.8rem;
    text-align: left;
  }
  .mistake {
    border-left: 4px solid #d38e17;
    padding-left: 0.8rem;
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
