<script lang="ts">
  import type { GitHub } from '../lib/github';
  import type { Exhibition } from '../lib/content';
  import { loadExhibitions, saveExhibition, deleteExhibition } from '../lib/store';
  import { useShell } from '../lib/shell.svelte';

  let { gh, notify }: { gh: GitHub; notify: (m: string, k?: 'info' | 'error') => void } = $props();

  const shell = useShell();

  let items = $state<Exhibition[]>([]);
  let loading = $state(true);
  let editing = $state<Exhibition | null>(null);
  let editBaseline = $state('');
  let saving = $state(false);

  const blank = (): Exhibition => ({
    id: '', title: '', venue: '', location: '', startDate: today(), endDate: '', url: '', description: '', draft: false,
  });

  function open(x: Exhibition) {
    editing = x;
    editBaseline = JSON.stringify($state.snapshot(x));
  }

  // While an entry is open, take part in the unsaved-changes guard. Silent: the
  // editor carries its own Save/Cancel footer, so no section-bar button.
  $effect(() => {
    if (!editing) return;
    return shell.register({
      isDirty: () => editing != null && JSON.stringify($state.snapshot(editing)) !== editBaseline,
      save,
      discard: () => (editing = null),
      silent: true,
    });
  });

  function today(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function summary(x: Exhibition): string {
    const range = x.endDate && x.endDate !== x.startDate ? `${x.startDate} – ${x.endDate}` : x.startDate;
    return [x.venue, x.location, range].filter(Boolean).join(' · ') + (x.draft ? ' · Draft' : '');
  }

  async function refresh() {
    loading = true;
    try {
      items = await loadExhibitions(gh);
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not load exhibitions.', 'error');
    }
    loading = false;
  }
  refresh();

  async function save(): Promise<boolean> {
    if (!editing) return true;
    if (!editing.title.trim()) { notify('Please add a title.', 'error'); return false; }
    if (!editing.startDate.trim()) { notify('Please add a start date.', 'error'); return false; }
    saving = true;
    try {
      await saveExhibition(gh, $state.snapshot(editing) as Exhibition, editing.id === '');
      shell.markCommitted();
      notify('Saved. Your site will update shortly.');
      editing = null;
      await refresh();
      saving = false;
      return true;
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not save.', 'error');
      saving = false;
      return false;
    }
  }

  async function remove(x: Exhibition) {
    if (!confirm(`Delete “${x.title}”?`)) return;
    try {
      await deleteExhibition(gh, x);
      shell.markCommitted();
      notify('Exhibition deleted.');
      await refresh();
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not delete.', 'error');
    }
  }
</script>

{#if editing}
  <div class="ez-form">
    <div class="ez-form__head">
      <h2>{editing.id === '' ? 'New exhibition' : 'Edit exhibition'}</h2>
      <button class="ez-btn ez-btn--ghost" onclick={() => shell.guard(() => (editing = null))} disabled={saving}>Cancel</button>
    </div>
    <label class="ez-field"><span class="ez-label">Title</span>
      <input class="ez-input" bind:value={editing.title} placeholder="Tidal — recent paintings" /></label>
    <div class="ez-row">
      <label class="ez-field"><span class="ez-label">Venue</span>
        <input class="ez-input" bind:value={editing.venue} placeholder="Gallery name" /></label>
      <label class="ez-field"><span class="ez-label">Location</span>
        <input class="ez-input" bind:value={editing.location} placeholder="City, Country" /></label>
    </div>
    <div class="ez-row">
      <label class="ez-field"><span class="ez-label">Start date</span>
        <input class="ez-input" type="date" bind:value={editing.startDate} /></label>
      <label class="ez-field"><span class="ez-label">End date (optional)</span>
        <input class="ez-input" type="date" bind:value={editing.endDate} /></label>
    </div>
    <label class="ez-field"><span class="ez-label">Link (optional)</span>
      <input class="ez-input" bind:value={editing.url} placeholder="https://gallery.com/show" /></label>
    <label class="ez-field"><span class="ez-label">Description (optional)</span>
      <textarea class="ez-input" rows="3" bind:value={editing.description}></textarea>
      <span class="ez-help">A short line about the show.</span></label>
    <label class="ez-field ez-field--check"><input type="checkbox" bind:checked={editing.draft} />
      <span>Draft (hidden from your site)</span></label>
    <div class="ez-form__actions">
      <button class="ez-btn ez-btn--primary" onclick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
    </div>
  </div>
{:else}
  <div class="ez-view__head">
    <div>
      <h2>Exhibitions</h2>
      <p class="ez-help">Upcoming and past shows. Turn the Exhibitions page on under <strong>Design → Pages</strong>.</p>
    </div>
    <button class="ez-btn ez-btn--primary" onclick={() => open(blank())}>Add exhibition</button>
  </div>

  {#if loading}
    <p class="ez-help">Loading…</p>
  {:else if items.length === 0}
    <div class="ez-empty">
      <p>No exhibitions yet.</p>
      <button class="ez-btn ez-btn--primary" onclick={() => open(blank())}>Add your first show</button>
    </div>
  {:else}
    <ul class="ez-list" role="list">
      {#each items as x (x.id)}
        <li class="ez-listrow">
          <div>
            <strong>{x.title}</strong>
            <span class="ez-help">{summary(x)}</span>
          </div>
          <div class="ez-listrow__actions">
            <button class="ez-btn ez-btn--sm" onclick={() => open({ ...x })}>Edit</button>
            <button class="ez-btn ez-btn--sm ez-btn--ghost" onclick={() => remove(x)}>Delete</button>
          </div>
        </li>
      {/each}
    </ul>
  {/if}
{/if}

<style>
  .ez-list { list-style: none; margin: var(--ez-space-4) 0 0; padding: 0; display: grid; gap: var(--ez-space-2); }
  .ez-listrow {
    display: flex; align-items: center; justify-content: space-between; gap: var(--ez-space-3);
    border: var(--ez-border-width, 1px) solid var(--ez-border, #ddd); padding: var(--ez-space-3);
    background: var(--ez-white, #fff);
  }
  .ez-listrow__actions { display: flex; gap: var(--ez-space-2); flex: none; }
</style>
