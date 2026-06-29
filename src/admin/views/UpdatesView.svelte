<script lang="ts">
  import type { GitHub } from '../lib/github';
  import {
    checkForUpdate,
    applyUpdateAndWait,
    resumeUpdateWait,
    type UpdateCheck,
    type UpdateRun,
    type UpdateOutcome,
    type UpdateReporter,
    type PendingUpdate,
  } from '../lib/update';
  import { useShell } from '../lib/shell.svelte';

  let {
    gh,
    currentVersion = null,
    notify,
  }: {
    gh: GitHub;
    currentVersion?: string | null;
    notify: (msg: string, kind?: 'info' | 'error') => void;
  } = $props();

  const shell = useShell();

  // The check lifecycle is local; the *update itself* lives on the shell
  // (shell.busyOp === 'update'), so it survives leaving and re-opening this tab
  // and can't be started twice. `done`/`errorCtx` are the terminal states shown
  // on the instance that ran it.
  type Phase = 'checking' | 'ready' | 'error';

  let phase = $state<Phase>('checking');
  let check = $state<UpdateCheck | null>(null);
  let errorMsg = $state('');
  // Outcome of a finished update: 'live' (confirmed live or trusted estimate) or
  // 'building' (published, still finishing — the soft state). Null until done.
  let done = $state<UpdateOutcome | null>(null);
  // Set when an update fails, carrying what's needed for the bug report.
  let errorCtx = $state<{ step: string; message: string; sha: string | null } | null>(null);
  const updating = $derived(shell.busyOp === 'update');

  const SUPPORT_EMAIL = 'howdy@usegesso.com';

  // The orchestrator pushes step progress through here onto the shell, so the
  // checklist survives a tab switch and shows the same state everywhere.
  const reporter: UpdateReporter = {
    setSteps: (steps) => shell.setSteps(steps),
    step: (id, status, detail) => shell.setStep(id, status, detail),
  };

  // --- Resume marker -------------------------------------------------------
  // A deploy can outlast the editor session. While we wait, persist the in-flight
  // commit so a reloaded editor can pick the wait back up instead of falsely
  // showing "up to date" while the old site is still live.
  const markerKey = () => `gesso:pending-update:${gh.ref.owner}/${gh.ref.repo}`;
  function writeMarker(sha: string, version: string | null) {
    try {
      localStorage.setItem(markerKey(), JSON.stringify({ sha, version, startedAt: Date.now() }));
    } catch {
      /* storage unavailable — resume just won't be possible, no harm */
    }
  }
  function clearMarker() {
    try {
      localStorage.removeItem(markerKey());
    } catch {
      /* ignore */
    }
  }
  function readMarker(): PendingUpdate | null {
    try {
      const raw = localStorage.getItem(markerKey());
      const m = raw ? (JSON.parse(raw) as PendingUpdate) : null;
      return m && typeof m.sha === 'string' ? m : null;
    } catch {
      return null;
    }
  }

  // When the running update finishes (busyOp clears), refresh the check so the
  // panel reflects the new version, even on an instance that didn't start it.
  let prevBusy = shell.busyOp;
  $effect(() => {
    const b = shell.busyOp;
    if (prevBusy === 'update' && b === null) runCheck();
    prevBusy = b;
  });

  function handleOutcome(run: UpdateRun) {
    clearMarker();
    if (run.outcome === 'error') {
      fail('deploy', new Error('Your site’s build didn’t finish successfully.'), run.sha);
      return;
    }
    shell.markUpdated(run.version);
    done = run.outcome;
    errorCtx = null;
    if (run.outcome === 'live') {
      notify(`Update complete — your site is live on ${run.version ? 'v' + run.version : 'the latest version'}.`);
    } else {
      notify('Update published — your site is finishing its build and will be live shortly.');
    }
  }

  function fail(step: string, e: unknown, sha: string | null) {
    clearMarker();
    done = null;
    errorCtx = {
      step,
      message: e instanceof Error ? e.message : 'The update could not be completed.',
      sha,
    };
    notify('The update could not be completed.', 'error');
  }

  function bugReportHref(): string {
    const { owner, repo, branch } = gh.ref;
    const to = check?.latestVersion ?? 'latest';
    const subject = `Gesso update problem (${effCur ?? '?'} → ${to})`;
    const body = [
      'Something went wrong while updating my site. Technical details are below.',
      '',
      `Site: ${owner}/${repo} (${branch})`,
      `From version: ${effCur ?? 'unknown'}`,
      `To version: ${to}`,
      `Step: ${errorCtx?.step ?? 'unknown'}`,
      `Error: ${errorCtx?.message ?? 'unknown'}`,
      errorCtx?.sha ? `Commit: ${errorCtx.sha}` : '',
      `When: ${new Date().toISOString()}`,
      `Browser: ${navigator.userAgent}`,
    ]
      .filter(Boolean)
      .join('\n');
    return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

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
  // Effective current version: an in-session update overrides the (stale) prop.
  let effCur = $derived(shell.updatedTo ?? check?.currentVersion ?? null);
  let curVer = $derived(effCur ? semver(effCur) : null);
  let latestVer = $derived(check?.latestVersion ? semver(check.latestVersion) : null);
  let updateAvailable = $derived(!!(latestVer && (!curVer || cmp(latestVer, curVer) > 0)));

  let allSections = $derived.by<Section[]>(() => (check?.notes ? parseChangelog(check.notes) : []));
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

  async function doUpdate() {
    if (!check || shell.busyOp) return;
    const ok = confirm(
      'Update your site to the latest version?\n\n' +
        'Everything you’ve added, your artwork, pages, settings, and style, stays exactly as it is. ' +
        'New features stay off until you turn them on. Your site will rebuild a minute or so after.',
    );
    if (!ok) return;
    done = null;
    errorCtx = null;
    const version = check.latestVersion;
    try {
      const run = await shell.runExclusive('update', 'Updating your site', () =>
        applyUpdateAndWait(gh, {
          version,
          reporter,
          timing: shell.updateTiming,
          onCommitted: (sha) => writeMarker(sha, version),
        }),
      );
      if (!run) return; // another task was already running
      handleOutcome(run);
    } catch (e) {
      fail('publish', e, gh.lastCommitSha);
    }
  }

  // Resume a deploy wait left in flight by a previous session (editor reloaded
  // mid-build). If there's nothing pending, just run the normal check.
  async function resumeOrCheck() {
    const m = readMarker();
    if (!m || shell.busyOp) {
      runCheck();
      return;
    }
    try {
      const outcome = await shell.runExclusive('update', 'Finishing your update', () =>
        resumeUpdateWait(gh, {
          sha: m.sha,
          timing: shell.updateTiming,
          reporter,
          startedAt: m.startedAt,
        }),
      );
      if (outcome === undefined) return; // already busy
      handleOutcome({ outcome, sha: m.sha, version: m.version, changed: 0, removed: 0 });
    } catch (e) {
      fail('deploy', e, m.sha);
    }
  }
  resumeOrCheck();
</script>

<div class="ez-updates">
  {#if errorCtx}
    <div class="ez-callout ez-callout--error">
      <div>
        <strong>We couldn’t finish the update</strong>
        <p>
          {#if errorCtx.step === 'deploy'}
            Your site’s rebuild didn’t finish, so your previous site is still live and unchanged.
          {:else}
            Nothing on your site changed. You can try again, and if it keeps happening, send us a
            note and we’ll sort it out.
          {/if}
        </p>
        <p class="ez-help">{errorCtx.message}</p>
        <div class="ez-updates__actions">
          <button class="ez-btn ez-btn--primary" onclick={doUpdate} disabled={!!shell.busyOp}>Try again</button>
          <a class="ez-btn ez-btn--outline" href={bugReportHref()}>Report a problem</a>
        </div>
      </div>
    </div>
  {:else if updating}
    <div class="ez-callout ez-callout--accent">
      <div>
        <strong>{shell.busyLabel || 'Updating your site'}…</strong>
        {#if shell.busySteps.length}
          <ol class="ez-upsteps">
            {#each shell.busySteps as s (s.id)}
              <li class="ez-step ez-step--{s.status}">
                <span class="ez-step__dot" aria-hidden="true"></span>
                <span class="ez-step__label">
                  {s.label}{#if s.detail && s.status === 'active'}
                    <span class="ez-step__detail">({s.detail})</span>{/if}
                </span>
              </li>
            {/each}
          </ol>
        {:else}
          <p class="ez-help">{shell.busyProgress || 'Starting…'}</p>
        {/if}
        <p class="ez-help">This keeps running if you switch tabs. We’ll let you know when it’s done.</p>
      </div>
    </div>
  {:else if done === 'live'}
    <div class="ez-callout ez-callout--blue">
      <div>
        <strong>You’re on the latest version 🎉</strong>
        <p>
          Your site is live on the newest template. Nothing you added changed, only the
          underlying template was refreshed.
        </p>
      </div>
    </div>
  {:else if done === 'building'}
    <div class="ez-callout ez-callout--blue">
      <div>
        <strong>Update published — finishing up</strong>
        <p>
          Your changes are published and your site is doing its final build. It’ll be live in a
          moment and will refresh on its own, no need to do anything.
        </p>
      </div>
    </div>
  {:else if phase === 'checking'}
    <p class="ez-help">Checking for updates…</p>
  {:else if phase === 'error'}
    <div class="ez-callout">
      <div>
        <strong>Couldn’t check for updates</strong>
        <p class="ez-help">{errorMsg}</p>
      </div>
      <button class="ez-btn ez-btn--outline" onclick={runCheck}>Try again</button>
    </div>
  {:else if check}
    <section>
      <p class="ez-help">
        You’re on <strong>{effCur ?? 'an early version'}</strong>.
        {#if check.latestVersion}The latest is <strong>{check.latestVersion}</strong>.{/if}
      </p>
    </section>

    {#if updateAvailable}
      <div class="ez-callout ez-callout--accent">
        <div>
          <strong>An update is available</strong>
          <p>
            Refresh your site’s template to the newest version. Your artwork, pages, settings,
            and style stay exactly as they are, and any new features stay off until you choose
            to turn them on.
          </p>
        </div>
        <button class="ez-btn ez-btn--primary ez-btn--depth" onclick={doUpdate} disabled={!!shell.busyOp}>Update my site</button>
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

  /* Failed-update callout: red-edged, inherits the base .ez-callout box. */
  .ez-callout--error {
    background: var(--ez-paper);
    border-left: 6px solid var(--ez-red);
  }
  .ez-updates__actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--ez-space-3);
    margin-top: var(--ez-space-3);
  }
  .ez-updates__actions .ez-btn {
    text-decoration: none;
  }

  /* The update checklist (compare → download → publish → deploy). */
  .ez-upsteps {
    list-style: none;
    margin: var(--ez-space-3) 0 0;
    padding: 0;
    display: grid;
    gap: var(--ez-space-2);
  }
  .ez-step {
    display: flex;
    align-items: center;
    gap: var(--ez-space-2);
    font-size: var(--ez-text-sm);
    color: var(--ez-stone);
  }
  .ez-step__dot {
    flex: none;
    width: 0.8rem;
    height: 0.8rem;
    border-radius: var(--ez-radius-pill);
    border: var(--ez-border-width) solid currentColor;
    background: transparent;
  }
  .ez-step--active {
    color: var(--ez-ink);
    font-weight: 600;
  }
  .ez-step--active .ez-step__dot {
    background: var(--ez-ink);
    animation: ez-step-pulse 1s ease-in-out infinite;
  }
  .ez-step--done {
    color: var(--ez-ink);
  }
  .ez-step--done .ez-step__dot {
    background: var(--ez-ink);
    border-color: var(--ez-ink);
  }
  .ez-step--error {
    color: var(--ez-red);
  }
  .ez-step--error .ez-step__dot {
    background: var(--ez-red);
    border-color: var(--ez-red);
  }
  .ez-step__detail {
    color: var(--ez-stone);
    font-weight: 400;
  }
  @keyframes ez-step-pulse {
    0%,
    100% {
      transform: scale(1);
    }
    50% {
      transform: scale(0.7);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .ez-step--active .ez-step__dot {
      animation: none;
    }
  }
</style>
