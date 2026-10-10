<script lang="ts">
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import Chip from '../../../lib/prototype/Chip.svelte';
  import StateSwitcher from '../../../lib/prototype/StateSwitcher.svelte';
  import {
    groupByTopic,
    masteryLabel,
    tracks,
    unmetPrerequisites
  } from '../../../lib/prototype/data';

  const masterySymbols = {
    'not-started': '○',
    introduced: '◐',
    practising: '◑',
    strong: '●'
  } as const;

  const screenState = $derived(page.url.searchParams.get('state') ?? 'normal');
  const trackId = $derived(page.url.searchParams.get('track') ?? 'fr-a1');
  const track = $derived(
    tracks.find((candidate) => candidate.id === trackId) ?? tracks[0]
  );
  const groups = $derived(groupByTopic(track.skills));

  function trackHref(id: string): string {
    return `${resolve('/prototype/map')}?track=${id}`;
  }
  function shortPrereq(id: string): string {
    return id.replace(/^[a-z]+-/, '').toUpperCase();
  }
</script>

<svelte:head><title>Curriculum map | Langlo prototype</title></svelte:head>

<StateSwitcher states={['normal', 'loading', 'empty', 'error']} />

<h1>Curriculum map</h1>

<nav class="tracks" aria-label="Enrolled tracks">
  {#each tracks as t (t.id)}
    <a
      href={trackHref(t.id)}
      aria-current={track.id === t.id ? 'page' : undefined}
      >{t.label}{#if !t.enrolled}&nbsp;<span class="muted">(not enrolled)</span
        >{/if}</a
    >
  {/each}
</nav>

{#if !track.enrolled}
  <div class="panel" role="alert">
    <h2>Not enrolled in {track.label}</h2>
    <p>
      This track is not part of your enrollments. Enrollment changes happen in
      Settings — access is never locked by your mastery level.
    </p>
    <a class="button" href={resolve('/prototype/settings')}>Open settings</a>
  </div>
{:else if screenState === 'loading'}
  <div class="panel" aria-busy="true" aria-label="Loading curriculum map">
    <div class="skel"></div>
    <div class="skel"></div>
    <div class="skel short"></div>
    <p class="muted">Loading {track.label} skills…</p>
  </div>
{:else if screenState === 'empty'}
  <section class="panel" aria-labelledby="empty-map">
    <h2 id="empty-map">No published skills yet</h2>
    <p>
      {track.label} has no published skills in this version. When the curriculum bundle
      is approved for this track, its topics and skills will appear here.
    </p>
  </section>
{:else if screenState === 'error'}
  <div class="panel" role="alert">
    <h2>Map unavailable</h2>
    <p>The curriculum for {track.label} could not be loaded.</p>
    <a class="button" href={trackHref(track.id)}>Retry</a>
  </div>
{:else}
  <section class="legend panel" aria-labelledby="legend-heading">
    <h2 id="legend-heading">How to read this map</h2>
    <p>
      Skills are grouped by topic. Prerequisite chips show the
      <em>recommended</em> teaching order — every lesson stays open regardless of
      mastery. Statuses describe grammar mastery only, never flashcard recall.
    </p>
    <ul class="legend-chips">
      {#each Object.entries(masteryLabel) as [key, label] (key)}
        <li>
          <Chip
            variant="mastery"
            symbol={masterySymbols[key as keyof typeof masterySymbols]}
            {label}
          />
        </li>
      {/each}
    </ul>
  </section>

  {#each groups as [topic, skills], groupIndex (topic)}
    <section class="topic panel" aria-labelledby="topic-{groupIndex}">
      <h2 id="topic-{groupIndex}">{topic}</h2>
      <ul class="skills">
        {#each skills as skill (skill.id)}
          {@const unmet = unmetPrerequisites(skill, track.skills)}
          <li id="skill-{skill.id}">
            <div class="row">
              <a
                class="skill-link"
                href={resolve('/prototype/lesson') + `?skill=${skill.id}`}
                >{skill.name}</a
              >
              <Chip
                variant="mastery"
                symbol={masterySymbols[skill.mastery]}
                label={masteryLabel[skill.mastery]}
              />
            </div>
            <div class="meta">
              <span class="skill-id">{shortPrereq(skill.id)}</span>
              {#if skill.prerequisites.length > 0}
                <span class="prereqs">
                  Recommended first:
                  {#each skill.prerequisites as prereq, i (prereq)}
                    <a href="#skill-{prereq}">{shortPrereq(prereq)}</a>{i <
                    skill.prerequisites.length - 1
                      ? ', '
                      : ''}
                  {/each}
                </span>
              {:else}
                <span class="prereqs none"
                  >Starting point — no prerequisites</span
                >
              {/if}
              {#if unmet.length > 0}
                <span class="unmet">
                  Not yet covered: {unmet
                    .map((u) => shortPrereq(u.id))
                    .join(', ')}</span
                >
              {/if}
            </div>
          </li>
        {/each}
      </ul>
    </section>
  {/each}
{/if}

<style>
  .tracks {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    margin-bottom: 1.5rem;
  }
  .tracks a {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    padding: 0.4rem 0.9rem;
    border: 1px solid #d9e2ef;
    border-radius: 999px;
    background: white;
    text-decoration: none;
    font-weight: 600;
  }
  .tracks a[aria-current='page'] {
    background: #1b5982;
    color: white;
    border-color: #1b5982;
  }
  .panel {
    padding: 1.25rem;
    background: white;
    border: 1px solid #d9e2ef;
    border-radius: 0.8rem;
    margin-bottom: 1.25rem;
  }
  .legend-chips {
    display: flex;
    gap: 0.5rem;
    list-style: none;
    padding: 0;
    flex-wrap: wrap;
  }
  .skills {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .skills li {
    padding: 0.6rem 0;
    border-bottom: 1px solid #edf1f7;
  }
  .skills li:target {
    background: #fbf3dd;
    border-radius: 0.4rem;
    outline: 2px solid #e4cf9a;
  }
  .row {
    display: flex;
    justify-content: space-between;
    gap: 0.8rem;
    align-items: baseline;
  }
  .meta {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
    font-size: 0.82rem;
    color: #49617a;
    margin-top: 0.2rem;
  }
  .skill-id {
    font-weight: 700;
  }
  .prereqs.none {
    font-style: italic;
  }
  .unmet {
    color: #5d4a12;
    font-weight: 600;
  }
  .muted {
    color: #49617a;
    font-size: 0.85em;
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
</style>
