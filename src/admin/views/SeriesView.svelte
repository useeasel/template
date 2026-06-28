<script lang="ts">
  import type { GitHub } from '../lib/github';
  import type { Series } from '../lib/content';
  import { loadSeries, saveSeries, deleteSeries } from '../lib/store';
  import { useShell } from '../lib/shell.svelte';

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

  let items = $state<Series[]>([]);
  let loading = $state(true);
  let editing = $state<Series | null>(null);
  let editBaseline = $state('');
  let saving = $state(false);

  const blank = (): Series => ({ id: '', title: '', description: '', lede: '', storyLayout: false, order: 0, body: '' });

  function open(s: Series) {
    editing = s;
    editBaseline = JSON.stringify($state.snapshot(s));
  }

  $effect(() => {
    if (!editing) return;
    return shell.register({
      isDirty: () => editing != null && JSON.stringify($state.snapshot(editing)) !== editBaseline,
      save,
      discard: () => (editing = null),
      silent: true,
    });
  });

  async function refresh() {
    loading = true;
    try {
      items = await loadSeries(gh);
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not load series.', 'error');
    }
    loading = false;
  }
  refresh();

  async function save(): Promise<boolean> {
    if (!editing) return true;
    if (!editing.title.trim()) { notify('Please add a name.', 'error'); return false; }
    saving = true;
    try {
      await saveSeries(gh, $state.snapshot(editing) as Series, editing.id === '');
      shell.markCommitted();
      notify('Series saved.');
      editing = null;
      await refresh();
      onChange();
      saving = false;
      return true;
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not save.', 'error');
      saving = false;
      return false;
    }
  }

  async function remove(s: Series) {
    if (!confirm(`Delete the “${s.title}” series? Your artwork stays; it's just ungrouped.`)) return;
    try {
      await deleteSeries(gh, s);
      shell.markCommitted();
      notify('Series deleted.');
      await refresh();
      onChange();
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not delete.', 'error');
    }
  }
</script>

{#if editing}
  <div class="ez-form">
    <div class="ez-form__head">
      <h2>{editing.id === '' ? 'Add series' : 'Edit series'}</h2>
      <button class="ez-btn ez-btn--ghost" onclick={() => shell.guard(() => (editing = null))} disabled={saving}>Cancel</button>
    </div>
    <label class="ez-field">
      <span class="ez-label">Name</span>
      <input class="ez-input" bind:value={editing.title} placeholder="Paintings 2024" />
    </label>
    <label class="ez-field">
      <span class="ez-label">Description</span>
      <textarea class="ez-input" rows="2" bind:value={editing.description}></textarea>
      <span class="ez-help">A sentence for search results and link previews.</span>
    </label>
    <label class="ez-field">
      <span class="ez-label">Tagline (optional)</span>
      <input class="ez-input" bind:value={editing.lede} placeholder="Oil on linen, 2023" />
      <span class="ez-help">A short line shown under the title on the series page.</span>
    </label>
    <label class="ez-field">
      <span class="ez-label">Intro (optional)</span>
      <textarea class="ez-input" rows="5" bind:value={editing.body} placeholder="Tell the story behind this body of work…"></textarea>
      <span class="ez-help">Shown above the gallery. Plain text or Markdown.</span>
    </label>
    <label class="ez-field ez-field--check">
      <input type="checkbox" bind:checked={editing.storyLayout} />
      <span>Full-width intro header</span>
    </label>
    <label class="ez-field">
      <span class="ez-label">Order</span>
      <input class="ez-input" type="number" bind:value={editing.order} />
      <span class="ez-help">Lower numbers show first.</span>
    </label>
    <div class="ez-form__actions">
      <button class="ez-btn ez-btn--primary" onclick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
    </div>
  </div>
{:else}
  <div class="ez-view__head">
    <p class="ez-help">Group your work into collections, each with its own page.</p>
    <div class="ez-view__actions">
      <button class="ez-btn ez-btn--primary" onclick={() => open(blank())}>Add series</button>
    </div>
  </div>

  {#if loading}
    <p class="ez-help">Loading…</p>
  {:else if items.length === 0}
    <div class="ez-empty">
      <p>No series yet.</p>
      <button class="ez-btn ez-btn--primary" onclick={() => open(blank())}>Add your first series</button>
    </div>
  {:else}
    <ul class="ez-list">
      {#each items as s (s.id)}
        <li class="ez-list__row">
          <div class="ez-list__info">
            <strong>{s.title}</strong>
            {#if s.description}<span class="ez-help">{s.description}</span>{/if}
          </div>
          <div class="ez-list__actions">
            <button class="ez-btn ez-btn--sm" onclick={() => open({ ...s })}>Edit</button>
            <button class="ez-btn ez-btn--sm ez-btn--ghost" onclick={() => remove(s)}>Delete</button>
          </div>
        </li>
      {/each}
    </ul>
  {/if}
{/if}
