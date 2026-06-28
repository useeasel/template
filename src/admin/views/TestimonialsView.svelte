<script lang="ts">
  import type { GitHub } from '../lib/github';
  import type { Testimonial } from '../lib/content';
  import { loadTestimonials, saveTestimonial, deleteTestimonial } from '../lib/store';
  import { useShell } from '../lib/shell.svelte';
  import { createCrud } from '../lib/crud.svelte';

  let { gh, notify }: { gh: GitHub; notify: (m: string, k?: 'info' | 'error') => void } = $props();

  const shell = useShell();

  const c = createCrud<Testimonial>(notify, shell, {
    load: () => loadTestimonials(gh),
    save: (t, isNew) => saveTestimonial(gh, t, isNew),
    remove: (t) => deleteTestimonial(gh, t),
    validate: (t) => (!t.quote.trim() ? 'Please add a quote.' : !t.author.trim() ? 'Please add who said it.' : null),
    confirmRemove: (t) => `Delete the quote from “${t.author}”?`,
    messages: { saved: 'Saved. Your site will update shortly.', deleted: 'Testimonial deleted.', loadError: 'Could not load testimonials.' },
  });

  const blank = (): Testimonial => ({ id: '', quote: '', author: '', role: '', order: c.items.length });

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
      <h2>{ed.id === '' ? 'New testimonial' : 'Edit testimonial'}</h2>
      <button class="ez-btn ez-btn--ghost" onclick={() => shell.guard(() => c.cancel())} disabled={c.saving}>Cancel</button>
    </div>
    <label class="ez-field"><span class="ez-label">Quote</span>
      <textarea class="ez-input" rows="3" bind:value={ed.quote} placeholder="Her paintings stopped me in my tracks."></textarea></label>
    <div class="ez-row">
      <label class="ez-field"><span class="ez-label">Who said it</span>
        <input class="ez-input" bind:value={ed.author} placeholder="Maria Alvarez" /></label>
      <label class="ez-field"><span class="ez-label">Their role (optional)</span>
        <input class="ez-input" bind:value={ed.role} placeholder="Collector / Frieze / Gallery owner" /></label>
    </div>
    <div class="ez-form__actions">
      <button class="ez-btn ez-btn--primary" onclick={c.save} disabled={c.saving}>{c.saving ? 'Saving…' : 'Save'}</button>
    </div>
  </div>
{:else}
  <div class="ez-view__head">
    <p class="ez-help">Short quotes about your work. They appear on your About page once you add one.</p>
    <div class="ez-view__actions">
      <button class="ez-btn ez-btn--primary" onclick={() => c.open(blank())}>Add testimonial</button>
    </div>
  </div>

  {#if c.loading}
    <p class="ez-help">Loading…</p>
  {:else if c.items.length === 0}
    <div class="ez-empty">
      <p>No testimonials yet.</p>
      <button class="ez-btn ez-btn--primary" onclick={() => c.open(blank())}>Add your first quote</button>
    </div>
  {:else}
    <ul class="ez-list" role="list">
      {#each c.items as t (t.id)}
        <li class="ez-list__row">
          <div class="ez-list__info">
            <strong>“{t.quote.length > 60 ? t.quote.slice(0, 60) + '…' : t.quote}”</strong>
            <span class="ez-help">{[t.author, t.role].filter(Boolean).join(' · ')}</span>
          </div>
          <div class="ez-list__actions">
            <button class="ez-btn ez-btn--sm" onclick={() => c.open({ ...t })}>Edit</button>
            <button class="ez-btn ez-btn--sm ez-btn--ghost" onclick={() => c.remove(t)}>Delete</button>
          </div>
        </li>
      {/each}
    </ul>
  {/if}
{/if}
