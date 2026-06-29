<script lang="ts">
  import type { GitHub } from '../lib/github';
  import type { Project } from '../lib/content';
  import { loadProjects, saveProject, deleteProject } from '../lib/store';
  import { useShell } from '../lib/shell.svelte';
  import { createCrud } from '../lib/crud.svelte';

  let { gh, notify }: { gh: GitHub; notify: (m: string, k?: 'info' | 'error') => void } = $props();

  const shell = useShell();

  const c = createCrud<Project>(notify, shell, {
    load: () => loadProjects(gh),
    save: (p, isNew) => saveProject(gh, p, isNew),
    remove: (p) => deleteProject(gh, p),
    validate: (p) => (!p.title.trim() ? 'Please add a title.' : null),
    confirmRemove: (p) => `Delete “${p.title}”?`,
    messages: { saved: 'Saved. Your site will update shortly.', deleted: 'Project deleted.', loadError: 'Could not load projects.' },
  });

  const blank = (): Project => ({
    id: '', title: '', summary: '', role: '', client: '', year: '', tags: [], order: 0, featured: false, draft: false, body: '',
  });

  // Tags edit as a comma-separated string, stored as an array.
  function tagsToText(tags: string[]): string {
    return tags.join(', ');
  }
  function setTags(value: string) {
    if (c.editing) c.editing.tags = value.split(',').map((t) => t.trim()).filter(Boolean);
  }

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
      <h2>{ed.id === '' ? 'New project' : 'Edit project'}</h2>
      <button class="ez-btn ez-btn--ghost" onclick={() => shell.guard(() => c.cancel())} disabled={c.saving}>Cancel</button>
    </div>
    <label class="ez-field"><span class="ez-label">Title</span>
      <input class="ez-input" bind:value={ed.title} placeholder="Rebrand for Acme Studio" /></label>
    <label class="ez-field"><span class="ez-label">Summary</span>
      <input class="ez-input" bind:value={ed.summary} placeholder="A one-line description shown on the listing." /></label>
    <div class="ez-row">
      <label class="ez-field"><span class="ez-label">Your role</span>
        <input class="ez-input" bind:value={ed.role} placeholder="Designer" /></label>
      <label class="ez-field"><span class="ez-label">Client</span>
        <input class="ez-input" bind:value={ed.client} placeholder="Acme Studio" /></label>
      <label class="ez-field"><span class="ez-label">Year</span>
        <input class="ez-input" bind:value={ed.year} placeholder="2024" /></label>
    </div>
    <label class="ez-field"><span class="ez-label">Tags</span>
      <input class="ez-input" value={tagsToText(ed.tags)} oninput={(e) => setTags(e.currentTarget.value)} placeholder="branding, print, web" />
      <span class="ez-help">Separate tags with commas.</span></label>
    <div class="ez-row">
      <label class="ez-field"><span class="ez-label">Order</span>
        <input class="ez-input" type="number" bind:value={ed.order} />
        <span class="ez-help">Lower numbers show first.</span></label>
      <label class="ez-field ez-field--check"><input type="checkbox" bind:checked={ed.featured} />
        <span>Featured</span></label>
      <label class="ez-field ez-field--check"><input type="checkbox" bind:checked={ed.draft} />
        <span>Draft (hidden from your site)</span></label>
    </div>
    <label class="ez-field"><span class="ez-label">Story</span>
      <textarea class="ez-input" rows="10" bind:value={ed.body} placeholder="The problem, your approach, the result. Plain text or Markdown."></textarea>
      <span class="ez-help">Add images with Markdown. Tell the story behind the work.</span></label>
    <div class="ez-form__actions">
      <button class="ez-btn ez-btn--primary" onclick={c.save} disabled={c.saving}>{c.saving ? 'Saving…' : 'Save'}</button>
    </div>
  </div>
{:else}
  <div class="ez-view__head">
    <p class="ez-help">Case studies for narrative work. Turn the Projects page on in the <strong>Menu</strong> tab.</p>
    <div class="ez-view__actions">
      <button class="ez-btn ez-btn--primary" onclick={() => c.open(blank())}>Add project</button>
    </div>
  </div>

  {#if c.loading}
    <p class="ez-help">Loading…</p>
  {:else if c.items.length === 0}
    <div class="ez-empty">
      <p>No projects yet.</p>
      <button class="ez-btn ez-btn--primary" onclick={() => c.open(blank())}>Add your first project</button>
    </div>
  {:else}
    <ul class="ez-list" role="list">
      {#each c.items as p (p.id)}
        <li class="ez-list__row">
          <div class="ez-list__info">
            <strong>{p.title}</strong>
            <span class="ez-help">{[p.client, p.year].filter(Boolean).join(' · ')}{p.draft ? ' · Draft' : ''}</span>
          </div>
          <div class="ez-list__actions">
            <button class="ez-btn ez-btn--sm" onclick={() => c.open({ ...p, tags: [...p.tags] })}>Edit</button>
            <button class="ez-btn ez-btn--sm ez-btn--ghost" onclick={() => c.remove(p)}>Delete</button>
          </div>
        </li>
      {/each}
    </ul>
  {/if}
{/if}
