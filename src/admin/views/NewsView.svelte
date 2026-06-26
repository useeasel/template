<script lang="ts">
  import type { GitHub } from '../lib/github';
  import type { Post } from '../lib/content';
  import { loadPosts, savePost, deletePost } from '../lib/store';
  import { useShell } from '../lib/shell.svelte';

  let { gh, notify }: { gh: GitHub; notify: (m: string, k?: 'info' | 'error') => void } = $props();

  const shell = useShell();

  let items = $state<Post[]>([]);
  let loading = $state(true);
  let editing = $state<Post | null>(null);
  let editBaseline = $state('');
  let saving = $state(false);

  const blank = (): Post => ({ id: '', title: '', date: today(), excerpt: '', draft: false, body: '' });

  function open(p: Post) {
    editing = p;
    editBaseline = JSON.stringify($state.snapshot(p));
  }

  // While a post is open, take part in the unsaved-changes guard. Silent: the
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
    // Date is available in the browser (this is a client SPA, not a workflow).
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  async function refresh() {
    loading = true;
    try {
      items = await loadPosts(gh);
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not load posts.', 'error');
    }
    loading = false;
  }
  refresh();

  async function save(): Promise<boolean> {
    if (!editing) return true;
    if (!editing.title.trim()) { notify('Please add a title.', 'error'); return false; }
    if (!editing.date.trim()) { notify('Please add a date.', 'error'); return false; }
    saving = true;
    try {
      await savePost(gh, $state.snapshot(editing) as Post, editing.id === '');
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

  async function remove(p: Post) {
    if (!confirm(`Delete “${p.title}”?`)) return;
    try {
      await deletePost(gh, p);
      shell.markCommitted();
      notify('Post deleted.');
      await refresh();
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not delete.', 'error');
    }
  }
</script>

{#if editing}
  <div class="ez-form">
    <div class="ez-form__head">
      <h2>{editing.id === '' ? 'New post' : 'Edit post'}</h2>
      <button class="ez-btn ez-btn--ghost" onclick={() => shell.guard(() => (editing = null))} disabled={saving}>Cancel</button>
    </div>
    <label class="ez-field"><span class="ez-label">Title</span>
      <input class="ez-input" bind:value={editing.title} placeholder="New work this season" /></label>
    <div class="ez-row">
      <label class="ez-field"><span class="ez-label">Date</span>
        <input class="ez-input" type="date" bind:value={editing.date} /></label>
      <label class="ez-field ez-field--check"><input type="checkbox" bind:checked={editing.draft} />
        <span>Draft (hidden from your site)</span></label>
    </div>
    <label class="ez-field"><span class="ez-label">Short summary</span>
      <input class="ez-input" bind:value={editing.excerpt} placeholder="A one-line teaser shown in the list." /></label>
    <label class="ez-field"><span class="ez-label">Post</span>
      <textarea class="ez-input" rows="8" bind:value={editing.body}></textarea>
      <span class="ez-help">Write your update. Plain text or Markdown.</span></label>
    <div class="ez-form__actions">
      <button class="ez-btn ez-btn--primary" onclick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
    </div>
  </div>
{:else}
  <div class="ez-view__head">
    <div>
      <h2>News</h2>
      <p class="ez-help">Short updates for your visitors. Turn the News page on under <strong>Design → Pages</strong>.</p>
    </div>
    <button class="ez-btn ez-btn--primary" onclick={() => open(blank())}>Add post</button>
  </div>

  {#if loading}
    <p class="ez-help">Loading…</p>
  {:else if items.length === 0}
    <div class="ez-empty">
      <p>No posts yet.</p>
      <button class="ez-btn ez-btn--primary" onclick={() => open(blank())}>Write your first post</button>
    </div>
  {:else}
    <ul class="ez-list" role="list">
      {#each items as p (p.id)}
        <li class="ez-listrow">
          <div>
            <strong>{p.title}</strong>
            <span class="ez-help">{p.date}{p.draft ? ' · Draft' : ''}</span>
          </div>
          <div class="ez-listrow__actions">
            <button class="ez-btn ez-btn--sm" onclick={() => open({ ...p })}>Edit</button>
            <button class="ez-btn ez-btn--sm ez-btn--ghost" onclick={() => remove(p)}>Delete</button>
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
