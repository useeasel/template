// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import svelte from '@astrojs/svelte';

// Static portfolio site. Netlify rebuilds on every editor commit to `main`. The
// custom Easel editor SPA lives at /admin (Svelte island).
export default defineConfig({
  // Drives canonical URLs, OG tags, and the sitemap. Netlify injects `$URL` at
  // build time — the site's primary address (a custom domain once the artist sets
  // one, otherwise the assigned *.netlify.app subdomain) — so every artist site
  // emits correct absolute URLs without any provisioning-time patch. The literal
  // fallback only applies to local builds outside Netlify.
  site: process.env.URL ?? 'https://example.netlify.app',
  output: 'static',
  integrations: [sitemap(), svelte()],
  image: {
    // astro:assets uses Sharp at build time to emit responsive, modern formats.
    service: { entrypoint: 'astro/assets/services/sharp' },
  },
});
