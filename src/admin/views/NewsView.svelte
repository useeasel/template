<script lang="ts">
  import type { GitHub } from '../lib/github';
  import type { Post } from '../lib/content';
  import { loadPosts, savePost, deletePost } from '../lib/store';
  import { useShell } from '../lib/shell.svelte';
  import { createCrud } from '../lib/crud.svelte';

  let { gh, notify }: { gh: GitHub; notify: (m: string, k?: 'info' | 'error') => void } = $props();

  const shell = useShell();

  const c = createCrud<Post>(notify, shell, {
    load: () => loadPosts(gh),
    save: (p, isNew) => savePost(gh, p, isNew),
    remove: (p) => deletePost(gh, p),
    validate: (p) => (!p.title.trim() ? 'Please add a title.' : !p.date.trim() ? 'Please add a date.' : null),
    confirmRemove: (p) => `Delete “${p.title}”?`,
    messages: { saved: 'Saved. Your site will update shortly.', deleted: 'Post deleted.', loadError: 'Could not load posts.' },
  });

  function today(): string {
    // Date is available in the browser (this is a client SPA, not a workflow).
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  const blank = (): Post => ({ id: '', title: '', date: today(), excerpt: '', draft: false, body: '' });

  // While a post is open, take part in the unsaved-changes guard. Silent: the
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
      <h2>{ed.id === '' ? 'New post' : 'Edit post'}</h2>
      <button class="ez-btn ez-btn--ghost" onclick={() => shell.guard(() => c.cancel())} disabled={c.saving}>Cancel</button>
    </div>
    <label class="ez-field"><span class="ez-label">Title</span>
      <input class="ez-input" bind:value={ed.title} placeholder="New work this season" /></label>
    <div class="ez-row">
      <label class="ez-field"><span class="ez-label">Date</span>
        <input class="ez-input" type="date" bind:value={ed.date} /></label>
      <label class="ez-field ez-field--check"><input type="checkbox" bind:checked={ed.draft} />
        <span>Draft (hidden from your site)</span></label>
    </div>
    <label class="ez-field"><span class="ez-label">Short summary</span>
      <input class="ez-input" bind:value={ed.excerpt} placeholder="A one-line teaser shown in the list." /></label>
    <label class="ez-field"><span class="ez-label">Post</span>
      <textarea class="ez-input" rows="8" bind:value={ed.body}></textarea>
      <span class="ez-help">Write your update. Plain text or Markdown.</span></label>
    <div class="ez-form__actions">
      <button class="ez-btn ez-btn--primary" onclick={c.save} disabled={c.saving}>{c.saving ? 'Saving…' : 'Save'}</button>
    </div>
  </div>
{:else}
  <div class="ez-view__head">
    <p class="ez-help">Short updates for your visitors. Turn the News page on in the <strong>Menu</strong> tab.</p>
    <div class="ez-view__actions">
      <button class="ez-btn ez-btn--primary" onclick={() => c.open(blank())}>Add post</button>
    </div>
  </div>

  {#if c.loading}
    <p class="ez-help">Loading…</p>
  {:else if c.items.length === 0}
    <div class="ez-empty">
      <p>No posts yet.</p>
      <button class="ez-btn ez-btn--primary" onclick={() => c.open(blank())}>Write your first post</button>
    </div>
  {:else}
    <ul class="ez-list" role="list">
      {#each c.items as p (p.id)}
        <li class="ez-list__row">
          <div class="ez-list__info">
            <strong>{p.title}</strong>
            <span class="ez-help">{p.date}{p.draft ? ' · Draft' : ''}</span>
          </div>
          <div class="ez-list__actions">
            <button class="ez-btn ez-btn--sm" onclick={() => c.open({ ...p })}>Edit</button>
            <button class="ez-btn ez-btn--sm ez-btn--ghost" onclick={() => c.remove(p)}>Delete</button>
          </div>
        </li>
      {/each}
    </ul>
  {/if}
{/if}
