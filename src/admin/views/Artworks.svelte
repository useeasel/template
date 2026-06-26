<script lang="ts">
  import type { GitHub } from '../lib/github';
  import { resolveAssetPath, type Artwork, type Series } from '../lib/content';
  import { loadArtworks, deleteArtwork, reorderArtworks, bulkAddArtworks } from '../lib/store';
  import { useShell } from '../lib/shell.svelte';
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

  const shell = useShell();

  let items = $state<Artwork[]>([]);
  let loading = $state(true);
  let editing = $state<Artwork | null>(null);
  let adding = $state(false);
  let orderDirty = $state(false);
  let bulkBusy = $state(false);
  let bulkInput = $state<HTMLInputElement | null>(null);

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

  async function saveOrder(): Promise<boolean> {
    try {
      await reorderArtworks(gh, $state.snapshot(items) as Artwork[]);
      orderDirty = false;
      shell.markCommitted();
      notify('Order saved. Your site will update shortly.');
      return true;
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not save order.', 'error');
      return false;
    }
  }

  // While there's an unsaved reorder, the section-bar Save persists it; navigating
  // away prompts via the shared guard. Discard reloads the on-disk order.
  $effect(() => {
    if (!orderDirty) return;
    return shell.register({ isDirty: () => orderDirty, save: saveOrder, discard: refresh });
  });

  async function remove(a: Artwork) {
    if (!confirm(`Delete “${a.title}”? This can't be undone.`)) return;
    try {
      await deleteArtwork(gh, a);
      shell.markCommitted();
      notify('Artwork deleted.');
      await refresh();
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not delete.', 'error');
    }
  }

  function onFormDone(changed: boolean) {
    editing = null;
    adding = false;
    if (changed) {
      shell.markCommitted();
      refresh();
    }
  }

  async function onBulkPick(e: Event) {
    const input = e.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = ''; // allow re-picking the same files
    if (!files.length) return;
    bulkBusy = true;
    try {
      const n = await bulkAddArtworks(gh, files);
      shell.markCommitted();
      notify(`Added ${n} piece${n === 1 ? '' : 's'}. Add titles and details any time — your site will update shortly.`);
      await refresh();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not add those photos.', 'error');
    }
    bulkBusy = false;
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
      <input
        type="file"
        accept="image/*"
        multiple
        class="ez-visually-hidden"
        bind:this={bulkInput}
        onchange={onBulkPick}
      />
      <button class="ez-btn ez-btn--ghost" onclick={() => bulkInput?.click()} disabled={bulkBusy}>
        {bulkBusy ? 'Uploading…' : 'Add many photos'}
      </button>
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
