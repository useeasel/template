<script lang="ts">
  import type { GitHub } from '../lib/github';
  import { useShell } from '../lib/shell.svelte';
  import { buildBackup, restoreBackup } from '../lib/backup';

  let {
    gh,
    notify,
  }: {
    gh: GitHub;
    notify: (msg: string, kind?: 'info' | 'error') => void;
  } = $props();

  const shell = useShell();

  let backingUp = $state(false);
  let restoring = $state(false);
  let restoreInput = $state<HTMLInputElement | null>(null);

  async function downloadBackup() {
    backingUp = true;
    try {
      const blob = await buildBackup(gh);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'easel-backup.zip';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      notify('Backup downloaded.');
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not make a backup.', 'error');
    }
    backingUp = false;
  }

  async function onRestorePick(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    (e.target as HTMLInputElement).value = '';
    if (!file) return;
    if (!confirm('Restore this backup? It replaces your current pages, artwork, and settings with the ones in the file, and publishes a new version. Your current site stays in history, so you can undo this.')) return;
    restoring = true;
    try {
      const n = await restoreBackup(gh, file);
      shell.markCommitted();
      notify(`Restored ${n} file${n === 1 ? '' : 's'}. Your site will update shortly.`);
      await load();
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not restore that file.', 'error');
    }
    restoring = false;
  }

  type Snapshot = { sha: string; message: string; date: string };
  let items = $state<Snapshot[]>([]);
  let loading = $state(true);
  let restoringSha = $state<string | null>(null);

  // Turn a commit message into something an artist reads. The editor writes
  // friendly messages already ("Update site settings", "Add artwork: Tide"); this
  // smooths the few that lead with a verb phrase, and names Easel's own system
  // commits plainly for the one place they can still appear (the current row).
  function friendly(msg: string): string {
    const m = msg.trim();
    let mm: RegExpMatchArray | null;
    if (/^initial commit/i.test(m)) return 'Your site was created';
    if ((mm = m.match(/update site to (v?[\d.]+)/i))) return `Updated Easel to ${mm[1]}`;
    if (/point the editor at this repo/i.test(m)) return 'Site set up';
    if (/publish to github pages/i.test(m)) return 'Published your site';
    return m.replace(/^Merge .*/i, 'Combined changes') || 'Saved changes';
  }

  // Easel's own commits (version updates, provisioning, the deploy workflow) are
  // not artist content saves, so they're never roll-back targets. Rolling back
  // only ever touches content (src/content, src/assets, public/assets); the
  // version, template code, and deploy setup stay exactly where they are. The
  // current state is still shown as a marker even when it's one of these.
  function isSystemCommit(msg: string): boolean {
    const m = msg.trim();
    return /^initial commit/i.test(m)
      || /^merge\b/i.test(m)
      || /^(chore|ci|feat|fix|build|refactor|docs|style|perf|test)\(easel\)/i.test(m);
  }

  // Always keep the current state as a marker (first row, no Restore button);
  // hide older system commits so artists only roll back to their own work.
  let visible = $derived.by(() => {
    if (items.length === 0) return [];
    const [head, ...rest] = items;
    return [head, ...rest.filter((s) => !isSystemCommit(s.message))];
  });

  function when(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' }) +
      ', ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }

  async function load() {
    loading = true;
    try {
      items = await gh.listCommits(25);
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not load your history.', 'error');
    }
    loading = false;
  }
  load();

  async function restore(s: Snapshot) {
    const ok = confirm(
      `Roll your site back to how it was on ${when(s.date)}?\n\n` +
        `Your work since then is kept in history, so you can undo this too. ` +
        `This publishes a new version of your site.`,
    );
    if (!ok) return;
    restoringSha = s.sha;
    try {
      const n = await gh.restoreContentTo(s.sha, `Roll back to ${when(s.date)}`);
      shell.markCommitted();
      if (n === 0) {
        notify('That version matches your site already, nothing to change.');
      } else {
        notify('Rolled back. Your site will update shortly.');
        await load();
      }
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not roll back.', 'error');
    }
    restoringSha = null;
  }
</script>

<div class="ez-view__head">
  <div>
    <h2>History</h2>
    <p class="ez-help">Every time you save, Easel keeps a snapshot. Roll back to any earlier one, your later work stays in history, so you can always undo a rollback. Rolling back changes your pages, artwork, and settings only; you stay on your current version of Easel.</p>
  </div>
</div>

<div class="ez-backup">
  <div>
    <strong>Backup &amp; restore</strong>
    <p class="ez-help">Download a full copy of your site, your pages, artwork, and settings, as a single file. Restore it here any time. It's your work; keep a copy somewhere safe.</p>
  </div>
  <div class="ez-backup__actions">
    <button class="ez-btn ez-btn--sm" onclick={downloadBackup} disabled={backingUp || restoring}>
      {backingUp ? 'Preparing…' : 'Download backup'}
    </button>
    <input type="file" accept=".zip,application/zip" class="ez-visually-hidden" bind:this={restoreInput} onchange={onRestorePick} />
    <button class="ez-btn ez-btn--sm ez-btn--ghost" onclick={() => restoreInput?.click()} disabled={backingUp || restoring}>
      {restoring ? 'Restoring…' : 'Restore from backup'}
    </button>
  </div>
</div>

{#if loading}
  <p class="ez-help">Loading your history…</p>
{:else if items.length === 0}
  <div class="ez-empty"><p>No history yet. It fills in as you make changes.</p></div>
{:else}
  <ul class="ez-history">
    {#each visible as s, i (s.sha)}
      <li class="ez-history__row">
        <div class="ez-history__info">
          <strong>{friendly(s.message)}</strong>
          <span class="ez-help">{when(s.date)}{i === 0 ? ' · current' : ''}</span>
        </div>
        {#if i !== 0}
          <button class="ez-btn ez-btn--sm" onclick={() => restore(s)} disabled={restoringSha !== null}>
            {restoringSha === s.sha ? 'Rolling back…' : 'Restore'}
          </button>
        {/if}
      </li>
    {/each}
  </ul>
{/if}

<style>
  .ez-backup {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
    margin-bottom: 1.5rem;
    padding: 1rem;
    border: var(--ez-border-width) solid var(--ez-border);
    border-radius: var(--ez-radius);
    background: var(--ez-paper);
  }
  .ez-backup__actions { display: flex; gap: 0.5rem; flex-wrap: wrap; }
  .ez-history { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.5rem; }
  .ez-history__row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.75rem 1rem;
    border: var(--ez-border-width) solid var(--ez-border);
    border-radius: var(--ez-radius);
    background: var(--ez-white);
  }
  .ez-history__info { display: flex; flex-direction: column; gap: 0.15rem; min-width: 0; }
</style>
