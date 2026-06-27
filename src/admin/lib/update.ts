/**
 * Opt-in "Update my site" engine.
 *
 * An artist's repo is generated from `useeasel/template` with UNRELATED git history,
 * so a real merge isn't feasible. Instead an update is a deterministic partition of
 * the file tree: template code is overwritten with upstream, user content is never
 * touched. Because content + settings are preserved byte-for-byte, settings stay
 * identical and any new feature (gated on a new settings flag the artist doesn't
 * have yet) stays off until they opt in.
 *
 * Everything runs client-side with the artist's existing OAuth token, reusing the
 * Git Data API commit in github.ts so the whole change lands in ONE commit → one
 * Netlify rebuild.
 */
import type { GitHub, RepoRef, FileChange } from './github';

/** The upstream template every site is generated from. */
export const TEMPLATE: RepoRef = { owner: 'useeasel', repo: 'template', branch: 'main' };

/**
 * Paths the editor itself writes — the user's content + settings. The updater never
 * reads or overwrites these. THIS IS THE SAFETY CONTRACT: keep it in sync with
 * `PATHS` in content.ts if the editor ever writes a new content location.
 *
 * `.github/` is host-provisioning infrastructure, not template code: the provision
 * worker commits a per-repo `.github/workflows/easel-pages.yml` to GitHub Pages sites,
 * and the template itself ships no `.github/`. Without preserving it, the "remove
 * stale template-code files" pass below would delete the Pages deploy workflow on
 * every update — and because a push evaluates workflows as they exist in that commit,
 * the deletion commit triggers no run, so the site silently stops rebuilding.
 */
const PRESERVE_PREFIXES = ['src/content/', 'src/assets/', 'public/assets/', '.github/'];
const PRESERVE_EXACT = new Set(['public/admin/config.json']);

function isUserContent(path: string): boolean {
  if (PRESERVE_EXACT.has(path)) return true;
  return PRESERVE_PREFIXES.some((p) => path.startsWith(p));
}

/** True if `latest` is a newer dotted version than `current` (missing current ⇒ true). */
export function isNewer(current: string | null | undefined, latest: string): boolean {
  if (!current) return true;
  const a = current.split('.').map((n) => parseInt(n, 10) || 0);
  const b = latest.split('.').map((n) => parseInt(n, 10) || 0);
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x !== y) return y > x;
  }
  return false;
}

export interface UpdateCheck {
  updateAvailable: boolean;
  currentVersion: string | null;
  latestVersion: string | null;
  /** Raw CHANGELOG.md from the template, or null if it has none. */
  notes: string | null;
}

/**
 * Compare the site's stamped version against the upstream template's package.json
 * version, and fetch its changelog. Read-only — no commits.
 */
export async function checkForUpdate(
  gh: GitHub,
  currentVersion: string | null | undefined,
): Promise<UpdateCheck> {
  const [pkgRaw, notes] = await Promise.all([
    gh.getFileFrom(TEMPLATE, 'package.json'),
    gh.getFileFrom(TEMPLATE, 'CHANGELOG.md'),
  ]);
  let latestVersion: string | null = null;
  if (pkgRaw) {
    try {
      latestVersion = (JSON.parse(pkgRaw) as { version?: string }).version ?? null;
    } catch {
      latestVersion = null;
    }
  }
  return {
    updateAvailable: !!latestVersion && isNewer(currentVersion, latestVersion),
    currentVersion: currentVersion ?? null,
    latestVersion,
    notes,
  };
}

export interface UpdateResult {
  /** Number of template-code files added or overwritten. */
  changed: number;
  /** Number of stale template-code files removed. */
  removed: number;
  version: string | null;
}

/**
 * Apply the latest template to the artist's repo as a single commit on their branch.
 * Overwrites template code, preserves all user content, and bumps the stamped
 * `easelVersion` in public/admin/config.json (keeping repo/branch/authBaseUrl).
 */
export async function applyUpdate(
  gh: GitHub,
  opts: { version?: string | null; onProgress?: (msg: string) => void } = {},
): Promise<UpdateResult> {
  const note = opts.onProgress ?? (() => {});

  note('Comparing your site with the latest template…');
  const [tmplTree, mineTree] = await Promise.all([
    gh.treeRecursive(TEMPLATE),
    gh.treeRecursive(),
  ]);
  const mineByPath = new Map(mineTree.map((e) => [e.path, e.sha]));
  const tmplPaths = new Set(tmplTree.map((e) => e.path));

  const changes: FileChange[] = [];

  // Overwrite/add template-code files whose content differs from what's upstream.
  // Equal blob shas mean the file is already identical → skip the upload.
  const toFetch = tmplTree.filter(
    (e) => !isUserContent(e.path) && mineByPath.get(e.path) !== e.sha,
  );
  let done = 0;
  for (const e of toFetch) {
    note(`Updating files… (${++done}/${toFetch.length})`);
    const content = await gh.getBlobBase64(e.sha, TEMPLATE);
    changes.push({ path: e.path, content, encoding: 'base64' });
  }

  // Remove template-code files the artist still has that upstream dropped.
  let removed = 0;
  for (const e of mineTree) {
    if (isUserContent(e.path)) continue;
    if (!tmplPaths.has(e.path)) {
      changes.push({ path: e.path, remove: true });
      removed++;
    }
  }

  // Stamp the new version onto the editor config, preserving its other fields.
  const cfgRaw = await gh.getFile('public/admin/config.json');
  let cfg: Record<string, unknown> = {};
  if (cfgRaw) {
    try {
      cfg = JSON.parse(cfgRaw.text);
    } catch {
      /* corrupt — fall through with an empty object; repo/branch are re-derivable */
    }
  }
  if (opts.version) cfg.easelVersion = opts.version;
  changes.push({
    path: 'public/admin/config.json',
    content: JSON.stringify(cfg, null, 2) + '\n',
  });

  note('Publishing the update…');
  const label = opts.version ? `v${opts.version}` : 'the latest template';
  await gh.commit(changes, `chore(easel): update site to ${label}`);

  return { changed: toFetch.length, removed, version: opts.version ?? null };
}
