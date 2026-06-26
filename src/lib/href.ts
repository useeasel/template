/**
 * Base-aware internal links.
 *
 * Astro doesn't rewrite hand-written `href="/work"` when a `base` is configured, so
 * any absolute internal link must go through withBase(). On Netlify and custom
 * domains the base is empty and these are pass-through; on GitHub Pages without a
 * custom domain the site is served from /<repo>, and withBase() prefixes it.
 *
 * `import.meta.env.BASE_URL` is '/' with no base, or '/<repo>/' with one.
 */
export function withBase(path: string): string {
  // Only rewrite root-absolute internal paths; leave hashes, mailto:, and
  // full URLs untouched.
  if (!path.startsWith('/')) return path;
  const base = import.meta.env.BASE_URL.replace(/\/$/, ''); // '' or '/<repo>'
  return `${base}${path}` || '/';
}
