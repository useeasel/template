<script lang="ts">
  import type { GitHub } from '../lib/github';
  import type { Series } from '../lib/content';
  import { useShell } from '../lib/shell.svelte';
  import Artworks from './Artworks.svelte';
  import SeriesView from './SeriesView.svelte';

  let {
    gh,
    seriesList = [],
    onSeriesChange,
    initialTab = null,
  }: {
    gh: GitHub;
    seriesList: Series[];
    onSeriesChange: () => void;
    initialTab?: string | null;
  } = $props();

  const shell = useShell();
  type Tab = 'artwork' | 'series';
  // The view remounts whenever the section changes, so the initial tab from a
  // dashboard deep link is read once here — no reactive sync needed.
  let tab = $state<Tab>(initialTab === 'series' ? 'series' : 'artwork');

  function switchTab(t: Tab) {
    if (t === tab) return;
    shell.guard(() => (tab = t));
  }

  const TABS: { id: Tab; label: string }[] = [
    { id: 'artwork', label: 'Artwork' },
    { id: 'series', label: 'Series' },
  ];
</script>

<div class="ez-tabs" role="tablist" aria-label="Work">
  {#each TABS as t (t.id)}
    <button
      class="ez-tab"
      class:ez-tab--on={tab === t.id}
      role="tab"
      aria-selected={tab === t.id}
      onclick={() => switchTab(t.id)}
    >{t.label}</button>
  {/each}
</div>

{#if tab === 'artwork'}
  <Artworks {gh} {seriesList} notify={shell.notify} />
{:else}
  <SeriesView {gh} notify={shell.notify} onChange={onSeriesChange} />
{/if}
