<script lang="ts">
  import { designVars, designClasses, motionAttr, googleFontsHref, type DesignTokens } from '../../lib/design';
  import { FILLER_ENTRIES, FILLER_STATUS_LABELS, shapeImage } from '../lib/filler';

  let {
    design,
    content,
    filler = false,
  }: {
    design: DesignTokens;
    content?: {
      logoText?: string;
      siteTitle?: string;
      tagline?: string;
      footerText?: string;
      logoImage?: string;
    };
    /** Inject stock-shape placeholder cards when the real gallery is empty, so layout
     *  decisions are visible to artists who haven't added work yet. */
    filler?: boolean;
  } = $props();

  let iframe: HTMLIFrameElement;
  let loaded = $state(false);
  let viewport = $state<'desktop' | 'mobile'>('desktop');

  // The site root, derived from the editor's own URL. On Netlify the editor lives at
  // /admin/ so this is '/'; on a GitHub Pages subpath it's /<repo>/admin/, so the
  // site root is /<repo>/. Hard-coding '/' would point the preview at the domain root.
  const previewSrc =
    typeof window !== 'undefined'
      ? `${window.location.pathname.replace(/\/admin(\/.*)?$/, '')}/`
      : '/';

  // Re-theme the live site inside the iframe by writing the same CSS variables +
  // structural classes the real build uses. No rebuild — instant preview.
  function apply() {
    const doc = iframe?.contentDocument;
    if (!doc) return;
    const html = doc.documentElement;
    html.style.cssText = designVars(design);
    html.className = designClasses(design);
    html.setAttribute('data-motion', motionAttr(design));
    let link = doc.getElementById('ez-preview-fonts') as HTMLLinkElement | null;
    if (!link) {
      link = doc.createElement('link');
      link.id = 'ez-preview-fonts';
      link.rel = 'stylesheet';
      doc.head.appendChild(link);
    }
    link.href = googleFontsHref(design);

    // Inject editable text (name/tagline) so those preview live too.
    if (content) {
      const setText = (sel: string, text?: string) => {
        if (text == null) return;
        const el = doc.querySelector(sel);
        if (el) el.textContent = text;
      };
      setText('.ez-nav__logotext', content.logoText);
      setText('.ez-home-head h1', content.siteTitle);
      setText('.ez-home-tagline', content.tagline);
      setText('.ez-footer__text', content.footerText);
      if (content.logoImage != null) {
        const img = doc.querySelector('.ez-nav__logoimg');
        if (img) img.setAttribute('src', content.logoImage);
      }
    }

    if (filler) injectFiller(doc);
  }

  // Card + pill cosmetics. ArtworkCard.astro / StatusPill.astro are Astro-scoped, so
  // their styles are ABSENT from an empty home page (the components never render). The
  // global tokens.css handles all layout (grid/masonry/size/crop/captions); these rules
  // only restore the per-card chrome, scoped to the filler container so real cards are
  // never affected. Keep in sync with those two components.
  const FILLER_CSS = `
.ez-portfolio[data-ez-filler] .ez-artcard { overflow: hidden; background: var(--ez-white); }
.ez-portfolio[data-ez-filler] .ez-artcard__trigger { display: block; width: 100%; padding: 0; border: 0; border-bottom: var(--ez-border-width) solid var(--ez-border); background: var(--ez-paper); overflow: hidden; border-radius: var(--ez-radius) var(--ez-radius) 0 0; }
.ez-portfolio[data-ez-filler] .ez-artcard__img { width: 100%; height: auto; display: block; }
.ez-portfolio[data-ez-filler] .ez-artcard__body { padding: var(--ez-space-4); }
.ez-portfolio[data-ez-filler] .ez-artcard__head { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--ez-space-3); }
.ez-portfolio[data-ez-filler] .ez-artcard__title { font-size: var(--ez-text-lg); margin: 0; }
.ez-portfolio[data-ez-filler] .ez-artcard__meta { margin: var(--ez-space-2) 0 0; color: var(--ez-stone); font-size: var(--ez-text-sm); }
.ez-portfolio[data-ez-filler] .ez-artcard__price { margin: var(--ez-space-2) 0 0; font-family: var(--ez-font-display); font-weight: 700; color: var(--ez-blue); }
.ez-portfolio[data-ez-filler] .ez-pill { display: inline-flex; align-items: center; font-family: var(--ez-font-display); font-weight: 700; font-size: var(--ez-text-xs); letter-spacing: 0.02em; line-height: 1; padding: 0.4em 0.85em; border: var(--ez-border-width) solid var(--ez-border); border-radius: var(--ez-radius-pill); white-space: nowrap; }
.ez-portfolio[data-ez-filler] .ez-pill--available { background: var(--ez-status-available); color: var(--ez-pill-available-text, #fff); }
.ez-portfolio[data-ez-filler] .ez-pill--sold { background: var(--ez-status-sold); color: var(--ez-pill-sold-text, #fff); }
.ez-portfolio[data-ez-filler] .ez-pill--inquire { background: var(--ez-status-inquire); color: var(--ez-pill-inquire-text, var(--ez-ink)); }
.ez-portfolio[data-ez-filler] .ez-pill--nfs { background: var(--ez-status-nfs); color: var(--ez-pill-nfs-text, #fff); }
`;

  // When the previewed site has no real artwork, the home page shows the first-run block
  // and there's nothing to lay out. Inject placeholder cards (matching ArtworkCard.astro
  // markup) so the gallery controls have something to act on. Preview-only — never saved.
  function injectFiller(doc: Document) {
    const real = doc.querySelector('.ez-portfolio:not([data-ez-filler])');
    if (real && real.children.length > 0) {
      doc.querySelector('.ez-portfolio[data-ez-filler]')?.remove();
      return;
    }
    if (doc.querySelector('.ez-portfolio[data-ez-filler]')) return; // already injected

    // The content area, not the nav/footer (which also carry .ez-container). On an empty
    // home page the gallery slot is the first-run block; fall back to the hero header.
    const firstrun = doc.querySelector('.ez-firstrun') as HTMLElement | null;
    const host = firstrun?.parentElement ?? doc.querySelector('.ez-home-head')?.parentElement;
    if (!host) return;

    if (firstrun) firstrun.style.display = 'none';

    if (!doc.getElementById('ez-filler-style')) {
      const style = doc.createElement('style');
      style.id = 'ez-filler-style';
      style.textContent = FILLER_CSS;
      doc.head.appendChild(style);
    }

    const grid = doc.createElement('div');
    grid.className = 'ez-portfolio';
    grid.setAttribute('data-ez-filler', '');

    for (const e of FILLER_ENTRIES) {
      const card = doc.createElement('article');
      card.className = 'ez-card ez-artcard';

      const trigger = doc.createElement('button');
      trigger.type = 'button';
      trigger.className = 'ez-artcard__trigger';
      trigger.tabIndex = -1;
      trigger.setAttribute('aria-hidden', 'true');

      const img = doc.createElement('img');
      img.className = 'ez-artcard__img';
      img.src = shapeImage(e.title, e.ratio);
      img.alt = '';
      trigger.appendChild(img);
      card.appendChild(trigger);

      const body = doc.createElement('div');
      body.className = 'ez-artcard__body';

      const head = doc.createElement('div');
      head.className = 'ez-artcard__head';
      const title = doc.createElement('h3');
      title.className = 'ez-artcard__title';
      title.textContent = e.title;
      const pill = doc.createElement('span');
      pill.className = `ez-pill ez-pill--${e.status}`;
      pill.textContent = FILLER_STATUS_LABELS[e.status];
      head.appendChild(title);
      head.appendChild(pill);
      body.appendChild(head);

      const meta = doc.createElement('p');
      meta.className = 'ez-artcard__meta';
      meta.textContent = `${e.year} · ${e.medium}`;
      body.appendChild(meta);

      if (e.status === 'available' && e.price) {
        const price = doc.createElement('p');
        price.className = 'ez-artcard__price';
        price.textContent = e.price;
        body.appendChild(price);
      }

      card.appendChild(body);
      grid.appendChild(card);
    }

    host.appendChild(grid);
  }

  // Reapply whenever any token or content changes (deep tracking).
  $effect(() => {
    JSON.stringify(design);
    JSON.stringify(content);
    if (loaded) apply();
  });
</script>

<div class="ez-preview">
  <div class="ez-preview__bar">
    <span class="ez-help">Live preview</span>
    <div class="ez-preview__vp">
      <button class="ez-btn ez-btn--sm" class:ez-btn--primary={viewport === 'desktop'} onclick={() => (viewport = 'desktop')}>Desktop</button>
      <button class="ez-btn ez-btn--sm" class:ez-btn--primary={viewport === 'mobile'} onclick={() => (viewport = 'mobile')}>Mobile</button>
    </div>
  </div>
  <div class="ez-preview__stage" class:ez-preview__stage--mobile={viewport === 'mobile'}>
    <iframe
      bind:this={iframe}
      src={previewSrc}
      title="Live preview of your site"
      onload={() => {
        loaded = true;
        apply();
      }}
    ></iframe>
  </div>
</div>
