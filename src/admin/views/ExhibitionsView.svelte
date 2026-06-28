<script lang="ts">
  import type { GitHub } from '../lib/github';
  import type { Exhibition } from '../lib/content';
  import { loadExhibitions, saveExhibition, deleteExhibition } from '../lib/store';
  import { useShell } from '../lib/shell.svelte';
  import { createCrud } from '../lib/crud.svelte';

  let { gh, notify }: { gh: GitHub; notify: (m: string, k?: 'info' | 'error') => void } = $props();

  const shell = useShell();

  const c = createCrud<Exhibition>(notify, shell, {
    load: () => loadExhibitions(gh),
    save: (x, isNew) => saveExhibition(gh, x, isNew),
    remove: (x) => deleteExhibition(gh, x),
    validate: (x) => (!x.title.trim() ? 'Please add a title.' : !x.startDate.trim() ? 'Please add a start date.' : null),
    confirmRemove: (x) => `Delete “${x.title}”?`,
    messages: { saved: 'Saved. Your site will update shortly.', deleted: 'Exhibition deleted.', loadError: 'Could not load exhibitions.' },
  });

  function today(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function summary(x: Exhibition): string {
    const range = x.endDate && x.endDate !== x.startDate ? `${x.startDate} – ${x.endDate}` : x.startDate;
    return [x.venue, x.location, range].filter(Boolean).join(' · ') + (x.draft ? ' · Draft' : '');
  }

  const blank = (): Exhibition => ({
    id: '', title: '', venue: '', location: '', startDate: today(), endDate: '', url: '', description: '', draft: false,
  });

  // While an entry is open, take part in the unsaved-changes guard. Silent: the
  // editor carries its own Save/Cancel footer, so no section-bar button.
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
      <h2>{ed.id === '' ? 'New exhibition' : 'Edit exhibition'}</h2>
      <button class="ez-btn ez-btn--ghost" onclick={() => shell.guard(() => c.cancel())} disabled={c.saving}>Cancel</button>
    </div>
    <label class="ez-field"><span class="ez-label">Title</span>
      <input class="ez-input" bind:value={ed.title} placeholder="Tidal — recent paintings" /></label>
    <div class="ez-row">
      <label class="ez-field"><span class="ez-label">Venue</span>
        <input class="ez-input" bind:value={ed.venue} placeholder="Gallery name" /></label>
      <label class="ez-field"><span class="ez-label">Location</span>
        <input class="ez-input" bind:value={ed.location} placeholder="City, Country" /></label>
    </div>
    <div class="ez-row">
      <label class="ez-field"><span class="ez-label">Start date</span>
        <input class="ez-input" type="date" bind:value={ed.startDate} /></label>
      <label class="ez-field"><span class="ez-label">End date (optional)</span>
        <input class="ez-input" type="date" bind:value={ed.endDate} /></label>
    </div>
    <div class="ez-row">
      <label class="ez-field"><span class="ez-label">Type (for your CV)</span>
        <select class="ez-input" bind:value={ed.kind}>
          <option value={undefined}>Not specified</option>
          <option value="solo">Solo show</option>
          <option value="group">Group show</option>
        </select></label>
      <label class="ez-field"><span class="ez-label">Link (optional)</span>
        <input class="ez-input" bind:value={ed.url} placeholder="https://gallery.com/show" /></label>
    </div>
    <label class="ez-field"><span class="ez-label">Description (optional)</span>
      <textarea class="ez-input" rows="3" bind:value={ed.description}></textarea>
      <span class="ez-help">A short line about the show.</span></label>
    <label class="ez-field ez-field--check"><input type="checkbox" bind:checked={ed.draft} />
      <span>Draft (hidden from your site)</span></label>
    <div class="ez-form__actions">
      <button class="ez-btn ez-btn--primary" onclick={c.save} disabled={c.saving}>{c.saving ? 'Saving…' : 'Save'}</button>
    </div>
  </div>
{:else}
  <div class="ez-view__head">
    <p class="ez-help">Upcoming and past shows. Turn the Exhibitions page on in the <strong>Menu</strong> tab.</p>
    <div class="ez-view__actions">
      <button class="ez-btn ez-btn--primary" onclick={() => c.open(blank())}>Add exhibition</button>
    </div>
  </div>

  {#if c.loading}
    <p class="ez-help">Loading…</p>
  {:else if c.items.length === 0}
    <div class="ez-empty">
      <p>No exhibitions yet.</p>
      <button class="ez-btn ez-btn--primary" onclick={() => c.open(blank())}>Add your first show</button>
    </div>
  {:else}
    <ul class="ez-list" role="list">
      {#each c.items as x (x.id)}
        <li class="ez-list__row">
          <div class="ez-list__info">
            <strong>{x.title}</strong>
            <span class="ez-help">{summary(x)}</span>
          </div>
          <div class="ez-list__actions">
            <button class="ez-btn ez-btn--sm" onclick={() => c.open({ ...x })}>Edit</button>
            <button class="ez-btn ez-btn--sm ez-btn--ghost" onclick={() => c.remove(x)}>Delete</button>
          </div>
        </li>
      {/each}
    </ul>
  {/if}
{/if}
