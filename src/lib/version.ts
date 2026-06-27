/**
 * Build identifier, stamped into every page and served at /version.json so the
 * client can notice when a newer build has deployed and refresh itself (see the
 * auto-refresh script in Base.astro).
 *
 * Uses the deploy commit SHA where the host provides it — Netlify sets COMMIT_REF,
 * GitHub Actions sets GITHUB_SHA — so it changes on every publish. Falls back to the
 * build time so local builds still produce a distinct id. Evaluated once per build,
 * so every page and the version endpoint agree.
 */
export const BUILD_ID = process.env.COMMIT_REF || process.env.GITHUB_SHA || String(Date.now());
