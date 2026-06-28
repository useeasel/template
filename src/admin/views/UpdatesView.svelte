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

  // --- Changelog rendering -------------------------------------------------
  // The notes are the template's raw CHANGELOG.md. Split it into per-version
  // sections (dropping the file's preamble), show only the versions newer than
  // the artist's, and render the small markdown subset we actually author
  // (bold, code, links, bullets) instead of dumping raw text.
  type Section = { version: string; body: string };

  function parseChangelog(md: string): Section[] {
    const out: Section[] = [];
    let cur: Section | null = null;
    for (const line of md.split(/\r?\n/)) {
      const m = line.match(/^##\s+(.+?)\s*$/);
      if (m) {
        cur = { version: m[1].trim(), body: '' };
        out.push(cur);
      } else if (cur) {
        cur.body += line + '\n';
      }
    }
    return out.map((s) => ({ ...s, body: s.body.trim() }));
  }

  const semver = (s: string): string | null => s.match(/\d+\.\d+\.\d+/)?.[0] ?? null;
  function cmp(a: string, b: string): number {
    const pa = a.split('.').map(Number);
    const pb = b.split('.').map(Number);
    for (let i = 0; i < 3; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
    return 0;
  }

  function esc(t: string): string {
    return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function inline(t: string): string {
    return esc(t)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  }
  // Our changelog bodies are `- ` bullets, often wrapped across indented lines.
  function renderBody(body: string): string {
    const items: string[] = [];
    for (const raw of body.split(/\r?\n/)) {
      if (/^\s*-\s+/.test(raw)) items.push(raw.replace(/^\s*-\s+/, ''));
      else if (items.length && raw.trim()) items[items.length - 1] += ' ' + raw.trim();
    }
    if (!items.length) return `<p>${inline(body)}</p>`;
    return `<ul>${items.map((i) => `<li>${inline(i)}</li>`).join('')}</ul>`;
  }

  // Split the changelog around the artist's current version: what's new (newer,
  // the focus) and earlier notes (what they're already on, kept collapsed and
  // out of the way). When we can't tell their version, treat it all as new.
  let allSections = $derived.by<Section[]>(() => (check?.notes ? parseChangelog(check.notes) : []));
  let curVer = $derived(check?.currentVersion ? semver(check.currentVersion) : null);
  let newSections = $derived(
    allSections.filter((s) => {
      const v = semver(s.version);
      return v && (!curVer || cmp(v, curVer) > 0);
    }),
  );
  let pastSections = $derived(
    curVer
      ? allSections.filter((s) => {
          const v = semver(s.version);
          return v && cmp(v, curVer) <= 0;
        })
      : [],
  );

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
            and style stay exactly as they are, and any new features stay off until you choose
            to turn them on.
          </p>
        </div>
        <button class="ez-btn ez-btn--primary ez-btn--depth" onclick={doUpdate}>Update my site</button>
      </div>

      {#if newSections.length}
        <section>
          <h2 class="ez-updates__h">What’s new</h2>
          <div class="ez-changelog">
            {#each newSections as sec, i (sec.version)}
              {#if i === 0}
                <article class="ez-cl ez-cl--latest">
                  <h3 class="ez-cl__ver">{sec.version}</h3>
                  {@html renderBody(sec.body)}
                </article>
              {:else}
                <details class="ez-cl ez-cl--old">
                  <summary class="ez-cl__ver">{sec.version}</summary>
                  <div class="ez-cl__body">{@html renderBody(sec.body)}</div>
                </details>
              {/if}
            {/each}
          </div>
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

    {#if pastSections.length}
      <details class="ez-changelog__past">
        <summary>Earlier updates</summary>
        <div class="ez-changelog">
          {#each pastSections as sec (sec.version)}
            <details class="ez-cl ez-cl--old">
              <summary class="ez-cl__ver">{sec.version}</summary>
              <div class="ez-cl__body">{@html renderBody(sec.body)}</div>
            </details>
          {/each}
        </div>
      </details>
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
</style>
