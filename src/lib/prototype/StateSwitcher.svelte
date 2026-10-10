<script lang="ts">
  import { page } from '$app/state';
  import { SvelteURLSearchParams } from 'svelte/reactivity';
  let { states }: { states: string[] } = $props();
  const current = $derived(page.url.searchParams.get('state') ?? 'normal');
  function hrefFor(state: string): string {
    const params = new SvelteURLSearchParams(page.url.search);
    if (state === 'normal') params.delete('state');
    else params.set('state', state);
    const query = params.toString();
    return `${page.url.pathname}${query ? `?${query}` : ''}`;
  }
</script>

<nav class="statebar" aria-label="Prototype screen states">
  <span class="statebar-label">Screen state:</span>
  {#each states as state (state)}
    <a
      href={hrefFor(state)}
      aria-current={current === state ? 'true' : undefined}>{state}</a
    >
  {/each}
</nav>

<style>
  .statebar {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
    margin: 0 0 1.5rem;
    padding: 0.6rem 0.8rem;
    border: 1px dashed #b8c6d8;
    border-radius: 0.6rem;
    font-size: 0.9rem;
  }
  .statebar-label {
    font-weight: 650;
    color: #49617a;
  }
  .statebar a {
    padding: 0.15rem 0.55rem;
    border: 1px solid #d9e2ef;
    border-radius: 999px;
    text-decoration: none;
  }
  .statebar a[aria-current='true'] {
    background: #172d46;
    color: white;
    border-color: #172d46;
  }
</style>
