<script lang="ts">
  import type { GitHub } from '../lib/github';
  import type { Series } from '../lib/content';
  import { loadSeries, saveSeries, deleteSeries } from '../lib/store';
  import { useShell } from '../lib/shell.svelte';
  import { createCrud } from '../lib/crud.svelte';

  let {
    gh,
    notify,
    onChange,
  }: {
    gh: GitHub;
    notify: (msg: string, kind?: 'info' | 'error') => void;
    onChange: () => void;
  } = $props();

  const shell = useShell();

  const c = createCrud<Series>(notify, shell, {
    load: () => loadSeries(gh),
    save: (s, isNew) => saveSeries(gh, s, isNew),
    remove: (s) => deleteSeries(gh, s),
    validate: (s) => (!s.title.trim() ? 'Please add a name.' : null),
    confirmRemove: (s) => `Delete the “${s.title}” series? Your artwork stays; it's just ungrouped.`,
    messages: { saved: 'Series saved.', deleted: 'Series deleted.', loadError: 'Could not load series.' },
    onChange,
  });

  const blank = (): Series => ({ id: '', title: '', description: '', lede: '', storyLayout: false, order: 0, body: '' });

  $effect(() => {
    if (!c.editing) return;
    return shell.register({
      isDirty: () => c.isDirty(),
      save: c.save,
      discard: () => c.cancel(),
      silent: true,
    });
  });
</script>

{#if c.editing}
  {@const ed = c.editing}
  <div class="ez-form">
    <div class="ez-form__head">
      <h2>{ed.id === '' ? 'Add series' : 'Edit series'}</h2>
      <button class="ez-btn ez-btn--ghost" onclick={() => shell.guard(() => c.cancel())} disabled={c.saving}>Cancel</button>
    </div>
    <label class="ez-field">
      <span class="ez-label">Name</span>
      <input class="ez-input" bind:value={ed.title} placeholder="Paintings 2024" />
    </label>
    <label class="ez-field">
      <span class="ez-label">Description</span>
      <textarea class="ez-input" rows="2" bind:value={ed.description}></textarea>
      <span class="ez-help">A sentence for search results and link previews.</span>
    </label>
    <label class="ez-field">
      <span class="ez-label">Tagline (optional)</span>
      <input class="ez-input" bind:value={ed.lede} placeholder="Oil on linen, 2023" />
      <span class="ez-help">A short line shown under the title on the series page.</span>
    </label>
    <label class="ez-field">
      <span class="ez-label">Intro (optional)</span>
      <textarea class="ez-input" rows="5" bind:value={ed.body} placeholder="Tell the story behind this body of work…"></textarea>
      <span class="ez-help">Shown above the gallery. Plain text or Markdown.</span>
    </label>
    <label class="ez-field ez-field--check">
      <input type="checkbox" bind:checked={ed.storyLayout} />
      <span>Full-width intro header</span>
    </label>
    <label class="ez-field">
      <span class="ez-label">Order</span>
      <input class="ez-input" type="number" bind:value={ed.order} />
      <span class="ez-help">Lower numbers show first.</span>
    </label>
    <div class="ez-form__actions">
      <button class="ez-btn ez-btn--primary" onclick={c.save} disabled={c.saving}>{c.saving ? 'Saving…' : 'Save'}</button>
    </div>
  </div>
{:else}
  <div class="ez-view__head">
    <p class="ez-help">Group your work into collections, each with its own page.</p>
    <div class="ez-view__actions">
      <button class="ez-btn ez-btn--primary" onclick={() => c.open(blank())}>Add series</button>
    </div>
  </div>

  {#if c.loading}
    <p class="ez-help">Loading…</p>
  {:else if c.items.length === 0}
    <div class="ez-empty">
      <p>No series yet.</p>
      <button class="ez-btn ez-btn--primary" onclick={() => c.open(blank())}>Add your first series</button>
    </div>
  {:else}
    <ul class="ez-list">
      {#each c.items as s (s.id)}
        <li class="ez-list__row">
          <div class="ez-list__info">
            <strong>{s.title}</strong>
            {#if s.description}<span class="ez-help">{s.description}</span>{/if}
          </div>
          <div class="ez-list__actions">
            <button class="ez-btn ez-btn--sm" onclick={() => c.open({ ...s })}>Edit</button>
            <button class="ez-btn ez-btn--sm ez-btn--ghost" onclick={() => c.remove(s)}>Delete</button>
          </div>
        </li>
      {/each}
    </ul>
  {/if}
{/if}
