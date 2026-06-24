# Easel — portfolio template

This is the site an artist gets when they sign up for [Easel](https://easel.rosematcha.com).
It's a fast, accessible [Astro](https://astro.build) portfolio with a friendly editor at
`/admin` — no code, no git, ever. Easel generates a copy of this template into the
artist's own GitHub account, and Netlify builds and deploys it.

## For artists

You don't need to read any of this. Go to your site's `/admin`, log in, drag in your
photos, and hit publish. That's it.

## What's inside

- **Astro** static site — great Lighthouse scores, automatic responsive images.
- **Sveltia CMS** at `/admin` — a modern, drag-and-drop editor (a faster successor to
  Decap/Netlify CMS). It commits content changes that Netlify rebuilds automatically.
- **Bauhaus design system** — see `/styleguide` in the running site for the full
  component set (colors, type, buttons, status pills, cards, lightbox, toggles).

## Pages

- `/` — portfolio (grid or masonry, set in site settings), with lightbox + metadata.
- `/[series]` — a single body of work.
- `/about`, `/contact` (Netlify Forms + mailto), `/cv`, `/press`, `/404`.
- `/styleguide` — living component reference (not in the public nav).

## Content model

Everything is plain files under `src/content/`, validated by Zod in
`src/content/config.ts` and edited through `/admin`:

- `artworks/*.md` — one per piece (image, title, year, medium, dimensions, status,
  price, alt text, series, sort order, featured, description).
- `collections/*.md` — series / bodies of work.
- `pages/*.md` — about, contact, cv, press.
- `site/settings.json` — title, theme, fonts, layout, motion, SEO, social links, etc.

## Design tokens & theming

All styling references CSS custom properties in `src/styles/tokens.css` (the Bauhaus
palette: blue `#1D4ED8`, red `#E63946`, yellow `#F4C20D`, ink `#161616`, paper
`#F7F4EC`). Hard edges (no rounding except status pills), 2px ink borders instead of
shadows, Syne for display + Space Grotesk for body. Add a theme by creating
`src/styles/themes/<name>.css` that re-declares the `--ez-*` vars, then select it via
the `theme` setting.

## Local development

```bash
npm install
node scripts/gen-placeholders.mjs   # generate sample artwork images (first run)
npm run dev                         # http://localhost:4321
npm run build                       # static output in dist/
```

### Editing content locally

Sveltia CMS only runs over **HTTPS or localhost**. In production this is handled
automatically — Netlify serves `/admin` over HTTPS. For local editing, run
`npm run dev` and open `http://localhost:4321/admin` in a Chromium-based browser:
with `local_backend: true` in `public/admin/config.yml`, Sveltia edits the repo's
content files directly (via the File System Access API), so you don't need the
GitHub OAuth relay while developing.

## Deployment

Configured for Netlify via `netlify.toml` (`astro build` → `dist`, Forms enabled).
The `/admin` editor authenticates through the shared Easel OAuth relay; the
provisioning flow rewrites `public/admin/config.yml`'s `repo` and `base_url` per artist.

## Accessibility

Required alt text on every artwork, a skip link, keyboard-navigable lightbox, and
`prefers-reduced-motion` honored automatically (plus an in-UI motion toggle).
