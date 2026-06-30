// @ts-check
import { readFileSync } from 'node:fs';
import { defineConfig, fontProviders } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import svelte from '@astrojs/svelte';
import aiProtect from './src/lib/ai-protect-integration.mjs';
import { resolveDesign, chosenFonts } from './src/lib/design.ts';

// Self-host only the fonts this site actually uses. We read the artist's settings at
// build time, resolve their theme, and hand the chosen families to Astro's Fonts API,
// which downloads them from Google once at build, serves them from this origin, and
// emits preload + swap @font-face. The public pages then never touch fonts.googleapis
// .com on the critical path. (The editor at /admin still loads the full Google list
// live so the font picker can preview every family — see allFontsHref in design.ts.)
const settings = JSON.parse(readFileSync(new URL('./src/content/site/settings.json', import.meta.url), 'utf8'));
const fonts = chosenFonts(resolveDesign(settings.design)).map((f) => ({
  provider: fontProviders.google(),
  name: f.name,
  cssVariable: f.cssVariable,
  weights: f.weights,
}));

// Static portfolio site. The host rebuilds on every editor commit to `main`. The
// custom Gesso editor SPA lives at /admin (Svelte island).
export default defineConfig({
  // Drives canonical URLs, OG tags, and the sitemap. The host injects `URL` at
  // build time — the site's primary address (a custom domain once the artist sets
  // one, otherwise the assigned host subdomain) — so every artist site emits
  // correct absolute URLs without any provisioning-time patch. The literal
  // fallback only applies to local builds outside a host.
  site: process.env.URL ?? 'https://example.netlify.app',
  // Subpath the site is served from. Empty for Netlify and custom domains (served
  // at the root); on GitHub Pages without a custom domain the site lives under
  // /<repo>, and the Pages deploy workflow passes BASE_PATH=/<repo>. Internal links
  // go through withBase() (src/lib/href.ts) so they pick this up.
  base: process.env.BASE_PATH || undefined,
  output: 'static',
  // Warm the next page on link hover so navigation feels instant. Hover-only (not
  // eager on load) keeps the initial page's bandwidth for its own assets; nav links
  // are plain <a>, so this applies with no markup change.
  prefetch: { prefetchAll: true, defaultStrategy: 'hover' },
  integrations: [sitemap(), svelte(), aiProtect()],
  image: {
    // astro:assets uses Sharp at build time to emit responsive, modern formats.
    service: { entrypoint: 'astro/assets/services/sharp' },
  },
  experimental: {
    fonts,
  },
});
