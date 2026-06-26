<script lang="ts">
  import type { GitHub } from '../lib/github';
  import { checkForUpdate, applyUpdate, type UpdateCheck } from '../lib/update';

  let {
    gh,
    currentVersion = null,
    notify,
  }: {
    gh: GitHub;
    currentVersion?: string | null;
    notify: (msg: string, kind?: 'info' | 'error') => void;
  } = $props();

  type Phase = 'checking' | 'ready' | 'error' | 'updating' | 'done';

  let phase = $state<Phase>('checking');
  let check = $state<UpdateCheck | null>(null);
  let progress = $state('');
  let errorMsg = $state('');

  async function runCheck() {
    phase = 'checking';
    try {
      check = await checkForUpdate(gh, currentVersion);
      phase = 'ready';
    } catch (e) {
      errorMsg = e instanceof Error ? e.message : 'Could not check for updates.';
      phase = 'error';
    }
  }
  runCheck();

  async function doUpdate() {
    if (!check) return;
    const ok = confirm(
      'Update your site to the latest version?\n\n' +
        'Everything you’ve added — your artwork, pages, settings, and style — stays exactly as it is. ' +
        'New features stay off until you turn them on. Your site will rebuild a minute or so after.',
    );
    if (!ok) return;
    phase = 'updating';
    progress = 'Starting…';
    try {
      const result = await applyUpdate(gh, {
        version: check.latestVersion,
        onProgress: (m) => (progress = m),
      });
      phase = 'done';
      notify(
        `Update published — ${result.changed} file${result.changed === 1 ? '' : 's'} updated. Your site is rebuilding.`,
      );
    } catch (e) {
      errorMsg = e instanceof Error ? e.message : 'The update could not be published.';
      phase = 'error';
      notify('The update could not be published.', 'error');
    }
  }
</script>

<div class="ez-updates">
  {#if phase === 'checking'}
    <p class="ez-help">Checking for updates…</p>
  {:else if phase === 'error'}
    <div class="ez-callout">
      <div>
        <strong>Couldn’t check for updates</strong>
        <p class="ez-help">{errorMsg}</p>
      </div>
      <button class="ez-btn ez-btn--outline" onclick={runCheck}>Try again</button>
    </div>
  {:else if phase === 'updating'}
    <div class="ez-callout ez-callout--accent">
      <div>
        <strong>Updating your site…</strong>
        <p class="ez-help">{progress}</p>
        <p class="ez-help">Please keep this tab open until it finishes.</p>
      </div>
    </div>
  {:else if phase === 'done'}
    <div class="ez-callout ez-callout--blue">
      <div>
        <strong>You’re on the latest version 🎉</strong>
        <p>
          Your site is rebuilding now and will be live in a minute or so. Nothing you added
          changed — only the underlying template was refreshed.
        </p>
      </div>
    </div>
  {:else if check}
    <section>
      <p class="ez-help">
        You’re on <strong>{check.currentVersion ?? 'an early version'}</strong>.
        {#if check.latestVersion}The latest is <strong>{check.latestVersion}</strong>.{/if}
      </p>
    </section>

    {#if check.updateAvailable}
      <div class="ez-callout ez-callout--accent">
        <div>
          <strong>An update is available</strong>
          <p>
            Refresh your site’s template to the newest version. Your artwork, pages, settings,
            and style stay exactly as they are — and any new features stay off until you choose
            to turn them on.
          </p>
        </div>
        <button class="ez-btn ez-btn--primary ez-btn--depth" onclick={doUpdate}>Update my site</button>
      </div>

      {#if check.notes}
        <section>
          <h2 class="ez-updates__h">What’s new</h2>
          <pre class="ez-updates__notes">{check.notes}</pre>
        </section>
      {/if}
    {:else}
      <div class="ez-callout ez-callout--blue">
        <div>
          <strong>You’re up to date</strong>
          <p>Your site is already on the latest template. We’ll let you know when there’s more.</p>
        </div>
      </div>
    {/if}
  {/if}
</div>

<style>
  .ez-updates {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }
  .ez-updates__h {
    font-size: 1rem;
    margin: 0 0 0.5rem;
  }
  .ez-updates__notes {
    white-space: pre-wrap;
    font-family: var(--ez-mono, ui-monospace, monospace);
    font-size: 0.85rem;
    line-height: 1.5;
    background: var(--ez-surface-2, rgba(0, 0, 0, 0.04));
    border: 1px solid var(--ez-line, rgba(0, 0, 0, 0.12));
    border-radius: 8px;
    padding: 1rem;
    max-height: 22rem;
    overflow: auto;
  }
</style>
