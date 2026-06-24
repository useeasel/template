<script lang="ts">
  import type { GitHub } from '../lib/github';
  import { resolveAssetPath, type Artwork, type Series } from '../lib/content';
  import { loadArtworks, deleteArtwork, reorderArtworks } from '../lib/store';
  import ArtworkForm from './ArtworkForm.svelte';

  let {
    gh,
    seriesList = [],
    notify,
  }: {
    gh: GitHub;
    seriesList: Series[];
    notify: (msg: string, kind?: 'info' | 'error') => void;
  } = $props();

  let items = $state<Artwork[]>([]);
  let loading = $state(true);
  let editing = $state<Artwork | null>(null);
  let adding = $state(false);
  let orderDirty = $state(false);

  // --- pointer-based drag reordering ---
  let dragId = $state<string | null>(null);
  let ptr = $state({ x: 0, y: 0 });
  let grab = { x: 0, y: 0 };
  let cloneSize = $state({ w: 0, h: 0 });
  let downId: string | null = null;
  let downAt = { x: 0, y: 0 };
  let started = false;

  const STATUS_LABEL: Record<string, string> = {
    available: 'Available', sold: 'Sold', inquire: 'Ask me', nfs: 'Not for sale',
  };

  async function refresh() {
    loading = true;
    try {
      items = await loadArtworks(gh);
      orderDirty = false;
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not load artwork.', 'error');
    }
    loading = false;
  }
  refresh();

  function thumb(a: Artwork): string {
    return a.image ? gh.rawUrl(resolveAssetPath('src/content/artworks', a.image)) : '';
  }

  const dragged = $derived(items.find((a) => a.id === dragId) ?? null);

  function onPointerDown(e: PointerEvent, a: Artwork) {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('button')) return; // let buttons work
    downId = a.id;
    downAt = { x: e.clientX, y: e.clientY };
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    grab = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    cloneSize = { w: rect.width, h: rect.height };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  function onMove(e: PointerEvent) {
    if (!downId) return;
    if (!started) {
      if (Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) < 6) return;
      started = true;
      dragId = downId;
      document.body.style.userSelect = 'none';
    }
    ptr = { x: e.clientX, y: e.clientY };
    const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
    const overId = el?.closest<HTMLElement>('[data-id]')?.dataset.id;
    if (overId && overId !== dragId) {
      const from = items.findIndex((x) => x.id === dragId);
      const to = items.findIndex((x) => x.id === overId);
      if (from > -1 && to > -1) {
        const next = [...items];
        const [m] = next.splice(from, 1);
        next.splice(to, 0, m);
        items = next;
        orderDirty = true;
      }
    }
  }

  function onUp() {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    document.body.style.userSelect = '';
    started = false;
    downId = null;
    dragId = null;
  }

  async function saveOrder() {
    try {
      await reorderArtworks(gh, $state.snapshot(items) as Artwork[]);
      orderDirty = false;
      notify('Order saved. Your site will update shortly.');
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not save order.', 'error');
    }
  }

  async function remove(a: Artwork) {
    if (!confirm(`Delete “${a.title}”? This can't be undone.`)) return;
    try {
      await deleteArtwork(gh, a);
      notify('Artwork deleted.');
      await refresh();
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not delete.', 'error');
    }
  }

  function onFormDone(changed: boolean) {
    editing = null;
    adding = false;
    if (changed) refresh();
  }
</script>

{#if adding || editing}
  <ArtworkForm {gh} art={editing} {seriesList} onDone={onFormDone} {notify} />
{:else}
  <div class="ez-view__head">
    <div>
      <h2>Your artwork</h2>
      <p class="ez-help">Drag pieces to reorder how they appear on your homepage.</p>
    </div>
    <div class="ez-view__actions">
      {#if orderDirty}
        <button class="ez-btn ez-btn--accent" onclick={saveOrder}>Save order</button>
      {/if}
      <button class="ez-btn ez-btn--primary" onclick={() => (adding = true)}>Add artwork</button>
    </div>
  </div>

  {#if loading}
    <p class="ez-help">Loading your work…</p>
  {:else if items.length === 0}
    <div class="ez-empty">
      <p>No artwork yet.</p>
      <button class="ez-btn ez-btn--primary" onclick={() => (adding = true)}>Add your first piece</button>
    </div>
  {:else}
    <div class="ez-grid">
      {#each items as a (a.id)}
        <div
          class="ez-tile"
          class:ez-tile--ghost={dragId === a.id}
          data-id={a.id}
          onpointerdown={(e) => onPointerDown(e, a)}
        >
          <div class="ez-tile__img">
            {#if thumb(a)}<img src={thumb(a)} alt={a.alt} draggable="false" loading="lazy" />{/if}
            <span class="ez-pill ez-pill--{a.status}">{STATUS_LABEL[a.status]}</span>
          </div>
          <div class="ez-tile__meta">
            <strong>{a.title}</strong>
            <span class="ez-help">{a.year ?? ''}</span>
          </div>
          <div class="ez-tile__actions">
            <button class="ez-btn ez-btn--sm" onclick={() => (editing = a)}>Edit</button>
            <button class="ez-btn ez-btn--sm ez-btn--ghost" onclick={() => remove(a)}>Delete</button>
          </div>
        </div>
      {/each}
    </div>

    {#if dragged}
      <div
        class="ez-drag-clone"
        style="left:{ptr.x - grab.x}px; top:{ptr.y - grab.y}px; width:{cloneSize.w}px;"
      >
        <div class="ez-tile__img">
          {#if thumb(dragged)}<img src={thumb(dragged)} alt="" draggable="false" />{/if}
          <span class="ez-pill ez-pill--{dragged.status}">{STATUS_LABEL[dragged.status]}</span>
        </div>
        <div class="ez-tile__meta"><strong>{dragged.title}</strong></div>
      </div>
    {/if}
  {/if}
{/if}
