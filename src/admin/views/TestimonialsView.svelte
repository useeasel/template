<script lang="ts">
  import type { GitHub } from '../lib/github';
  import type { Testimonial } from '../lib/content';
  import { loadTestimonials, saveTestimonial, deleteTestimonial } from '../lib/store';
  import { useShell } from '../lib/shell.svelte';

  let { gh, notify }: { gh: GitHub; notify: (m: string, k?: 'info' | 'error') => void } = $props();

  const shell = useShell();

  let items = $state<Testimonial[]>([]);
  let loading = $state(true);
  let editing = $state<Testimonial | null>(null);
  let editBaseline = $state('');
  let saving = $state(false);

  const blank = (): Testimonial => ({ id: '', quote: '', author: '', role: '', order: items.length });

  function open(t: Testimonial) {
    editing = t;
    editBaseline = JSON.stringify($state.snapshot(t));
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
      items = await loadTestimonials(gh);
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not load testimonials.', 'error');
    }
    loading = false;
  }
  refresh();

  async function save(): Promise<boolean> {
    if (!editing) return true;
    if (!editing.quote.trim()) { notify('Please add a quote.', 'error'); return false; }
    if (!editing.author.trim()) { notify('Please add who said it.', 'error'); return false; }
    saving = true;
    try {
      await saveTestimonial(gh, $state.snapshot(editing) as Testimonial, editing.id === '');
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

  async function remove(t: Testimonial) {
    if (!confirm(`Delete the quote from “${t.author}”?`)) return;
    try {
      await deleteTestimonial(gh, t);
      shell.markCommitted();
      notify('Testimonial deleted.');
      await refresh();
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not delete.', 'error');
    }
  }
</script>

{#if editing}
  <div class="ez-form">
    <div class="ez-form__head">
      <h2>{editing.id === '' ? 'New testimonial' : 'Edit testimonial'}</h2>
      <button class="ez-btn ez-btn--ghost" onclick={() => shell.guard(() => (editing = null))} disabled={saving}>Cancel</button>
    </div>
    <label class="ez-field"><span class="ez-label">Quote</span>
      <textarea class="ez-input" rows="3" bind:value={editing.quote} placeholder="Her paintings stopped me in my tracks."></textarea></label>
    <div class="ez-row">
      <label class="ez-field"><span class="ez-label">Who said it</span>
        <input class="ez-input" bind:value={editing.author} placeholder="Maria Alvarez" /></label>
      <label class="ez-field"><span class="ez-label">Their role (optional)</span>
        <input class="ez-input" bind:value={editing.role} placeholder="Collector / Frieze / Gallery owner" /></label>
    </div>
    <div class="ez-form__actions">
      <button class="ez-btn ez-btn--primary" onclick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
    </div>
  </div>
{:else}
  <div class="ez-view__head">
    <p class="ez-help">Short quotes about your work. They appear on your About page once you add one.</p>
    <div class="ez-view__actions">
      <button class="ez-btn ez-btn--primary" onclick={() => open(blank())}>Add testimonial</button>
    </div>
  </div>

  {#if loading}
    <p class="ez-help">Loading…</p>
  {:else if items.length === 0}
    <div class="ez-empty">
      <p>No testimonials yet.</p>
      <button class="ez-btn ez-btn--primary" onclick={() => open(blank())}>Add your first quote</button>
    </div>
  {:else}
    <ul class="ez-list" role="list">
      {#each items as t (t.id)}
        <li class="ez-list__row">
          <div class="ez-list__info">
            <strong>“{t.quote.length > 60 ? t.quote.slice(0, 60) + '…' : t.quote}”</strong>
            <span class="ez-help">{[t.author, t.role].filter(Boolean).join(' · ')}</span>
          </div>
          <div class="ez-list__actions">
            <button class="ez-btn ez-btn--sm" onclick={() => open({ ...t })}>Edit</button>
            <button class="ez-btn ez-btn--sm ez-btn--ghost" onclick={() => remove(t)}>Delete</button>
          </div>
        </li>
      {/each}
    </ul>
  {/if}
{/if}
