<script lang="ts">
  import type { GitHub } from '../lib/github';
  import type { Settings } from '../lib/content';
  import { loadSettings, saveSettings, uploadAsset } from '../lib/store';
  import { useShell } from '../lib/shell.svelte';

  let {
    gh,
    notify,
    host,
    repo,
  }: {
    gh: GitHub;
    notify: (m: string, k?: 'info' | 'error') => void;
    host?: string;
    repo?: string;
  } = $props();

  const shell = useShell();

  // A direct link to where the artist manages their domain — at their host, not in
  // Gesso. GitHub Pages: the repo's Settings → Pages. Netlify: derive the project
  // slug from the live hostname (slug.netlify.app); falls back to the dashboard.
  function domainSettingsUrl(): string {
    if (host === 'github-pages') {
      return repo ? `https://github.com/${repo}/settings/pages` : 'https://github.com/';
    }
    const m = typeof location !== 'undefined' ? location.hostname.match(/^([^.]+)\.netlify\.app$/) : null;
    return m ? `https://app.netlify.com/projects/${m[1]}/domain-management/setup` : 'https://app.netlify.com/';
  }
  const hostLabel = host === 'github-pages' ? 'GitHub Pages' : 'Netlify';

  let s = $state<Settings>({
    siteTitle: '', logoText: '', theme: 'default', portfolioLayout: 'grid',
    columns: 3, motionDefault: 'full', rightClickProtect: false, watermark: false, protectFromAI: false, socialLinks: [],
  });
  let loading = $state(true);
  let savedJson = $state('');

  // Editor-only QR generator: make a downloadable code for a gallery placard or
  // business card that points at the site (or any specific piece's URL). Runs
  // entirely client-side; nothing is saved to the site.
  let qrTarget = $state(typeof location !== 'undefined' ? location.origin : '');
  let qrImg = $state('');
  let qrBusy = $state(false);
  async function generateQr() {
    qrBusy = true;
    try {
      const QRCode = (await import('qrcode')).default as any;
      qrImg = await QRCode.toDataURL(qrTarget || location.origin, { width: 600, margin: 2 });
    } catch (e) {
      notify('Could not make a QR code from that link.', 'error');
    }
    qrBusy = false;
  }

  // Upload a thumbnail for a /links row and store its served path on that link.
  let thumbBusy = $state(-1);
  async function uploadLinkThumb(i: number, e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    thumbBusy = i;
    try {
      const path = await uploadAsset(gh, file, 'link');
      s.links[i].thumbnail = path;
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not upload the image.', 'error');
    }
    thumbBusy = -1;
  }

  const isDirty = () => !loading && JSON.stringify($state.snapshot(s)) !== savedJson;

  async function load() {
    loading = true;
    try {
      s = await loadSettings(gh);
      savedJson = JSON.stringify($state.snapshot(s));
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not load settings.', 'error');
    }
    loading = false;
  }
  load();

  async function save(): Promise<boolean> {
    try {
      const snap = $state.snapshot(s) as Settings;
      // Drop incomplete /links rows — a blank URL would fail the build's schema.
      if (Array.isArray(snap.links)) {
        snap.links = snap.links.filter((l) => l.url?.trim() && l.label?.trim());
      }
      await saveSettings(gh, snap);
      savedJson = JSON.stringify($state.snapshot(s));
      notify('Settings saved. Your site will update shortly.');
      return true;
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not save.', 'error');
      return false;
    }
  }

  function discard() {
    if (savedJson) s = JSON.parse(savedJson) as Settings;
  }

  // The section bar drives Save; we just expose dirty/save/discard to the shell.
  $effect(() => shell.register({ isDirty, save, discard }));
</script>

{#if loading}
  <p class="ez-help">Loading…</p>
{:else}
  <div class="ez-settings">
    <p class="ez-help">Your site's practical details. Looks and themes live in <strong>Design</strong>; which pages show, and your shop and commissions, live in <strong>Pages</strong>.</p>

    <section class="ez-group">
      <div class="ez-group__head"><h2 class="ez-group__title">Site basics</h2></div>
      <label class="ez-field"><span class="ez-label">Site title</span>
        <input class="ez-input" bind:value={s.siteTitle} placeholder="Your name or studio" />
        <span class="ez-help">Shows in the browser tab and search results.</span></label>
      <label class="ez-field"><span class="ez-label">Tagline</span>
        <input class="ez-input" bind:value={s.tagline} placeholder="Paintings and works on paper" /></label>
      <label class="ez-field"><span class="ez-label">Name shown in the header</span>
        <input class="ez-input" bind:value={s.logoText} placeholder="Your name" /></label>
      <label class="ez-field"><span class="ez-label">Search description</span>
        <textarea class="ez-input" rows="2" bind:value={s.metaDescription}></textarea>
        <span class="ez-help">A sentence describing your site, shown in Google results.</span></label>
    </section>

    <section class="ez-group">
      <div class="ez-group__head"><h2 class="ez-group__title">Links</h2>
        <p class="ez-help">Where people find you elsewhere, and how they can support your work.</p></div>

      <div class="ez-block">
        <div class="ez-block__head"><strong>Social links</strong>
          <button class="ez-btn ez-btn--sm" onclick={() => (s.socialLinks = [...s.socialLinks, { label: '', url: '' }])}>Add link</button></div>
        {#each s.socialLinks as link, i (i)}
          <div class="ez-row">
            <input class="ez-input" style="max-width:10rem" bind:value={link.label} placeholder="Instagram" />
            <input class="ez-input" bind:value={link.url} placeholder="https://instagram.com/you" />
            <button class="ez-btn ez-btn--sm ez-btn--ghost" onclick={() => (s.socialLinks = s.socialLinks.filter((_, j) => j !== i))} aria-label="Remove">×</button>
          </div>
        {/each}
      </div>

      <div class="ez-block">
        <div class="ez-block__head"><strong>Support links</strong>
          <button class="ez-btn ez-btn--sm" onclick={() => (s.supportLinks = [...(s.supportLinks ?? []), { label: '', url: '' }])}>Add link</button></div>
        <p class="ez-help">Add Ko-fi, Buy Me a Coffee, Patreon, or PayPal.me links and a "Support my work" row shows in your footer. People go straight to your page; Gesso never handles the money.</p>
        {#each s.supportLinks ?? [] as link, i (i)}
          <div class="ez-row">
            <input class="ez-input" style="max-width:10rem" bind:value={link.label} placeholder="Ko-fi" />
            <input class="ez-input" bind:value={link.url} placeholder="https://ko-fi.com/you" />
            <button class="ez-btn ez-btn--sm ez-btn--ghost" onclick={() => (s.supportLinks = s.supportLinks.filter((_, j) => j !== i))} aria-label="Remove">×</button>
          </div>
        {/each}
      </div>
    </section>

    <section class="ez-group">
      <div class="ez-group__head"><h2 class="ez-group__title">Grow your audience</h2></div>

      <label class="ez-toggle"><span class="ez-toggle__text">
          <span class="ez-toggle__label">Newsletter signup</span>
          <span class="ez-help">Collect email addresses on your contact page. Signups go to your inbox (or your Netlify dashboard under Forms).</span></span>
        <input type="checkbox" class="ez-switch" bind:checked={s.newsletterEnabled} /></label>
      {#if s.newsletterEnabled}
        <div class="ez-reveal">
          <label class="ez-field"><span class="ez-label">Heading</span>
            <input class="ez-input" bind:value={s.newsletterHeading} placeholder="Stay in the loop" /></label>
          <label class="ez-field"><span class="ez-label">Short blurb</span>
            <input class="ez-input" bind:value={s.newsletterBlurb} placeholder="The occasional note about new work and shows." /></label>
          <label class="ez-field"><span class="ez-label">Where signups go</span>
            <select class="ez-input" bind:value={s.newsletterProvider}>
              <option value="netlify">My inbox / Netlify (built in)</option>
              <option value="buttondown">Buttondown</option>
              <option value="mailchimp">Mailchimp</option>
              <option value="convertkit">Kit (ConvertKit)</option>
            </select>
            <span class="ez-help">Built in needs no setup. Pick a provider to send signups straight into that mailing list instead.</span></label>
          {#if s.newsletterProvider && s.newsletterProvider !== 'netlify'}
            <label class="ez-field"><span class="ez-label">Form address from {s.newsletterProvider}</span>
              <input class="ez-input ez-mono" bind:value={s.newsletterActionUrl} placeholder="https://…" />
              <span class="ez-help">In your provider, create an embedded/hosted signup form and copy its form action URL here.</span></label>
          {/if}
          <label class="ez-toggle"><span class="ez-toggle__text"><span class="ez-toggle__label">Also show it in my footer</span>
            <span class="ez-help">On every page.</span></span>
            <input type="checkbox" class="ez-switch" bind:checked={s.newsletterInFooter} /></label>
          <label class="ez-toggle"><span class="ez-toggle__text"><span class="ez-toggle__label">Also show "follow new work" under each piece</span></span>
            <input type="checkbox" class="ez-switch" bind:checked={s.newsletterOnWork} /></label>
        </div>
      {/if}

      <label class="ez-toggle"><span class="ez-toggle__text">
          <span class="ez-toggle__label">Link in bio (/links)</span>
          <span class="ez-help">A shareable page at <strong>yoursite/links</strong> with big tappable buttons, the one link for your Instagram or TikTok bio. It uses your site's colours and fonts and stays out of your main menu.</span></span>
        <input type="checkbox" class="ez-switch" bind:checked={s.linksEnabled} /></label>
      {#if s.linksEnabled}
        <div class="ez-reveal">
          <label class="ez-field"><span class="ez-label">Name shown on the page</span>
            <input class="ez-input" bind:value={s.linksDisplayName} placeholder="Your name (defaults to your site name)" /></label>
          <label class="ez-field"><span class="ez-label">Short bio</span>
            <input class="ez-input" bind:value={s.linksBio} placeholder="Painter in Austin. Commissions open." /></label>
          <div class="ez-block__head"><strong>Links</strong>
            <button class="ez-btn ez-btn--sm" onclick={() => (s.links = [...(s.links ?? []), { label: '', url: '', icon: '' }])}>Add link</button></div>
          {#each s.links ?? [] as link, i (i)}
            <div class="ez-row">
              <input class="ez-input" style="max-width:3.5rem" bind:value={link.icon} placeholder="🔗" aria-label="Emoji" />
              <input class="ez-input" style="max-width:11rem" bind:value={link.label} placeholder="My shop" />
              <input class="ez-input" bind:value={link.url} placeholder="https://…" />
              <button class="ez-btn ez-btn--sm" onclick={() => { if (i > 0) { const n = [...s.links]; [n[i-1], n[i]] = [n[i], n[i-1]]; s.links = n; } }} disabled={i === 0} aria-label="Move up">↑</button>
              <button class="ez-btn ez-btn--sm" onclick={() => { if (i < s.links.length - 1) { const n = [...s.links]; [n[i+1], n[i]] = [n[i], n[i+1]]; s.links = n; } }} disabled={i === (s.links?.length ?? 0) - 1} aria-label="Move down">↓</button>
              <button class="ez-btn ez-btn--sm ez-btn--ghost" onclick={() => (s.links = s.links.filter((_, j) => j !== i))} aria-label="Remove">×</button>
            </div>
            <div class="ez-row" style="margin:-0.25rem 0 0.5rem; align-items:center; gap:0.75rem; flex-wrap:wrap">
              <label class="ez-field--check" style="margin:0"><input type="checkbox" bind:checked={link.featured} /><span>Feature this one</span></label>
              {#if link.thumbnail}
                <img src={link.thumbnail} alt="" style="width:1.75rem;height:1.75rem;object-fit:cover;border-radius:4px" />
                <button class="ez-btn ez-btn--sm ez-btn--ghost" onclick={() => (s.links[i].thumbnail = undefined)}>Remove image</button>
              {:else}
                <label class="ez-btn ez-btn--sm" style="cursor:pointer">
                  {thumbBusy === i ? 'Uploading…' : 'Add thumbnail'}
                  <input type="file" accept="image/*" hidden disabled={thumbBusy === i} onchange={(e) => uploadLinkThumb(i, e)} />
                </label>
              {/if}
            </div>
          {/each}
          <p class="ez-help">Your social links (above) show automatically at the bottom of the page. Feature a link to make it bigger and bolder; add a thumbnail to show a picture on the button.</p>
        </div>
      {/if}

      <label class="ez-toggle"><span class="ez-toggle__text">
          <span class="ez-toggle__label">Search box in my header</span>
          <span class="ez-help">Let visitors find pieces, series, and posts by typing. Best once you have a good number of works. It runs in the browser, with nothing to set up.</span></span>
        <input type="checkbox" class="ez-switch" bind:checked={s.searchEnabled} /></label>
    </section>

    <section class="ez-group">
      <div class="ez-group__head"><h2 class="ez-group__title">Selling</h2></div>
      <label class="ez-toggle"><span class="ez-toggle__text">
          <span class="ez-toggle__label">Show Buy / Inquire buttons on pieces for sale</span>
          <span class="ez-help">Pieces with a Buy / shop link get a <strong>Buy</strong> button; the rest get an <strong>Inquire</strong> button that opens your contact form with the piece's title filled in. Set each piece's link and availability under Work.</span></span>
        <input type="checkbox" class="ez-switch" bind:checked={s.sellEnabled} /></label>

      <label class="ez-toggle"><span class="ez-toggle__text">
          <span class="ez-toggle__label">Show an "available for work" banner</span>
          <span class="ez-help">A slim bar across the top of every page that tells visitors you're taking on work. Off by default.</span></span>
        <input type="checkbox" class="ez-switch" bind:checked={s.availableForWork} /></label>
      {#if s.availableForWork}
        <div class="ez-reveal">
          <label class="ez-field"><span class="ez-label">Banner text</span>
            <input class="ez-input" bind:value={s.availableForWorkText} placeholder="Open for commissions this fall" />
            <span class="ez-help">Leave blank for a simple "Available for work".</span></label>
          <label class="ez-field"><span class="ez-label">Button goes to</span>
            <input class="ez-input" bind:value={s.availableForWorkCta} placeholder="/commissions/" />
            <span class="ez-help">A page on your site (like <strong>/commissions/</strong>) or a full web address. Leave blank to send people to your commissions or contact page.</span></label>
        </div>
      {/if}

      <div class="ez-block">
        <div class="ez-block__head"><strong>Where to buy</strong>
          <button class="ez-btn ez-btn--sm" onclick={() => (s.stockists = [...(s.stockists ?? []), { name: '', url: '', location: '', note: '' }])}>Add stockist</button></div>
        {#each s.stockists ?? [] as shop, i (i)}
          <div class="ez-row">
            <input class="ez-input" style="max-width:12rem" bind:value={shop.name} placeholder="Etsy shop" />
            <input class="ez-input" bind:value={shop.url} placeholder="https://…" />
            <button class="ez-btn ez-btn--sm" onclick={() => { if (i > 0) { const n = [...s.stockists]; [n[i-1], n[i]] = [n[i], n[i-1]]; s.stockists = n; } }} disabled={i === 0} aria-label="Move up">↑</button>
            <button class="ez-btn ez-btn--sm" onclick={() => { if (i < s.stockists.length - 1) { const n = [...s.stockists]; [n[i+1], n[i]] = [n[i], n[i+1]]; s.stockists = n; } }} disabled={i === (s.stockists?.length ?? 0) - 1} aria-label="Move down">↓</button>
            <button class="ez-btn ez-btn--sm ez-btn--ghost" onclick={() => (s.stockists = s.stockists.filter((_, j) => j !== i))} aria-label="Remove">×</button>
          </div>
          <div class="ez-row" style="margin:-0.25rem 0 0.5rem">
            <input class="ez-input" style="max-width:12rem" bind:value={shop.location} placeholder="Location (optional)" />
            <input class="ez-input" bind:value={shop.note} placeholder="Note (optional)" />
          </div>
        {/each}
        <p class="ez-help">Outbound links to the shops and galleries that carry your work. Turn the <strong>Where to buy</strong> page on in the Menu tab.</p>
      </div>
    </section>

    <section class="ez-group">
      <div class="ez-group__head"><h2 class="ez-group__title">Protect your work</h2></div>
      <label class="ez-toggle"><span class="ez-toggle__text">
          <span class="ez-toggle__label">Discourage saving my images</span>
          <span class="ez-help">Blocks the right-click "save image" menu. A nudge, not a lock.</span></span>
        <input type="checkbox" class="ez-switch" bind:checked={s.rightClickProtect} /></label>
      <label class="ez-toggle"><span class="ez-toggle__text">
          <span class="ez-toggle__label">Watermark my images</span></span>
        <input type="checkbox" class="ez-switch" bind:checked={s.watermark} /></label>
      {#if s.watermark}
        <div class="ez-reveal">
          <label class="ez-field"><span class="ez-label">Watermark text</span>
            <input class="ez-input" bind:value={s.watermarkText} placeholder="© Your Name" /></label>
        </div>
      {/if}
      <label class="ez-toggle"><span class="ez-toggle__text">
          <span class="ez-toggle__label">Keep AI crawlers out</span>
          <span class="ez-help">Asks known AI training bots to skip your site and tags your images "do not train". A request, not a lock, but it is the standard way to opt out.</span></span>
        <input type="checkbox" class="ez-switch" bind:checked={s.protectFromAI} /></label>
    </section>

    <section class="ez-group">
      <div class="ez-group__head"><h2 class="ez-group__title">Analytics</h2>
        <p class="ez-help">See how many people visit. Pick the tool you use and paste your site's id; we add it for you. Your visitor data goes straight to that tool, never through Gesso.</p></div>
      <label class="ez-field"><span class="ez-label">Analytics tool</span>
        <select class="ez-input" bind:value={s.analyticsProvider}>
          <option value="none">None</option>
          <option value="ga4">Google Analytics (GA4)</option>
          <option value="plausible">Plausible</option>
          <option value="fathom">Fathom</option>
          <option value="umami">Umami</option>
          <option value="goatcounter">GoatCounter</option>
          <option value="simpleanalytics">Simple Analytics</option>
          <option value="matomo">Matomo</option>
          <option value="cloudflare">Cloudflare Web Analytics</option>
        </select></label>
      {#if s.analyticsProvider === 'ga4'}
        <label class="ez-field"><span class="ez-label">Measurement ID</span>
          <input class="ez-input ez-mono" bind:value={s.analyticsId} placeholder="G-XXXXXXXXXX" /></label>
      {:else if s.analyticsProvider === 'plausible'}
        <label class="ez-field"><span class="ez-label">Your site's domain</span>
          <input class="ez-input ez-mono" bind:value={s.analyticsId} placeholder="your-site.com" /></label>
      {:else if s.analyticsProvider === 'fathom'}
        <label class="ez-field"><span class="ez-label">Site ID</span>
          <input class="ez-input ez-mono" bind:value={s.analyticsId} placeholder="ABCDEFGH" /></label>
      {:else if s.analyticsProvider === 'umami'}
        <label class="ez-field"><span class="ez-label">Website ID</span>
          <input class="ez-input ez-mono" bind:value={s.analyticsId} placeholder="xxxxxxxx-xxxx-…" /></label>
        <label class="ez-field"><span class="ez-label">Server address (blank for Umami Cloud)</span>
          <input class="ez-input ez-mono" bind:value={s.analyticsHost} placeholder="https://analytics.your-site.com" /></label>
      {:else if s.analyticsProvider === 'goatcounter'}
        <label class="ez-field"><span class="ez-label">Your GoatCounter code</span>
          <input class="ez-input ez-mono" bind:value={s.analyticsId} placeholder="yourname (from yourname.goatcounter.com)" /></label>
      {:else if s.analyticsProvider === 'matomo'}
        <label class="ez-field"><span class="ez-label">Site ID</span>
          <input class="ez-input ez-mono" bind:value={s.analyticsId} placeholder="1" /></label>
        <label class="ez-field"><span class="ez-label">Server address</span>
          <input class="ez-input ez-mono" bind:value={s.analyticsHost} placeholder="https://analytics.your-site.com" /></label>
      {:else if s.analyticsProvider === 'cloudflare'}
        <label class="ez-field"><span class="ez-label">Web Analytics token</span>
          <input class="ez-input ez-mono" bind:value={s.analyticsId} placeholder="abc123…" /></label>
      {:else if s.analyticsProvider === 'simpleanalytics'}
        <p class="ez-help">Nothing to paste, just make sure your site's domain is added in Simple Analytics.</p>
      {/if}
    </section>

    <section class="ez-group">
      <div class="ez-group__head"><h2 class="ez-group__title">QR code</h2>
        <p class="ez-help">Make a QR code for a show wall, business card, or print. It points wherever you like, your site by default, or paste a single piece's web address. This is just a tool; nothing here changes your site.</p></div>
      <label class="ez-field"><span class="ez-label">Link the code opens</span>
        <input class="ez-input ez-mono" bind:value={qrTarget} placeholder="https://your-site.com" /></label>
      <div class="ez-row">
        <button class="ez-btn ez-btn--sm" onclick={generateQr} disabled={qrBusy}>{qrBusy ? 'Making…' : 'Make QR code'}</button>
        {#if qrImg}
          <a class="ez-btn ez-btn--sm ez-btn--primary" href={qrImg} download="qr-code.png">Download PNG</a>
        {/if}
      </div>
      {#if qrImg}
        <img src={qrImg} alt="QR code preview" style="width:160px;height:160px;margin-top:.75rem;border:var(--ez-border-width) solid var(--ez-border)" />
      {/if}
    </section>

    <section class="ez-group">
      <div class="ez-group__head"><h2 class="ez-group__title">Custom domain</h2>
        <p class="ez-help">Use your own web address (like your-name.com) instead of the default one. You set this up at your host ({hostLabel}); Gesso keeps your links relative, so they keep working on whatever domain you choose. Nothing to enter here.</p></div>
      <a class="ez-btn ez-btn--outline" href={domainSettingsUrl()} target="_blank" rel="noopener">Manage your domain on {hostLabel} ↗</a>
      <p class="ez-help">New to this? <a href="https://usegesso.com/custom-domain/" target="_blank" rel="noopener">Step-by-step walkthrough →</a></p>
    </section>

    <details class="ez-advanced">
      <summary>Advanced</summary>
      <label class="ez-field"><span class="ez-label">Social preview image path</span>
        <input class="ez-input" bind:value={s.ogImage} placeholder="/assets/og-default.jpg" /></label>
      <label class="ez-field"><span class="ez-label">Analytics code</span>
        <textarea class="ez-input" rows="3" bind:value={s.analyticsSnippet}></textarea></label>
      <label class="ez-field"><span class="ez-label">Custom CSS</span>
        <textarea class="ez-input ez-mono" rows="5" bind:value={s.customCss} placeholder={".my-thing { color: red; }"}></textarea>
        <span class="ez-help">Tweak your site's styles. Applied site-wide.</span></label>
      <label class="ez-field"><span class="ez-label">Custom code</span>
        <textarea class="ez-input ez-mono" rows="5" bind:value={s.customCode} placeholder={"<script>… or an embed</" + "script>"}></textarea>
        <span class="ez-help">Scripts or embeds, added at the end of every page. Runs on your live site only.</span></label>
      <p class="ez-help">These run on your published site, not here. Broken code can break your site, we don't check it.</p>
    </details>
  </div>
{/if}
