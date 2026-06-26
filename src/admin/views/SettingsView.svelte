<script lang="ts">
  import type { GitHub } from '../lib/github';
  import type { Settings } from '../lib/content';
  import { loadSettings, saveSettings } from '../lib/store';
  import { useShell } from '../lib/shell.svelte';

  let { gh, notify }: { gh: GitHub; notify: (m: string, k?: 'info' | 'error') => void } = $props();

  const shell = useShell();

  let s = $state<Settings>({
    siteTitle: '', logoText: '', theme: 'default', portfolioLayout: 'grid',
    columns: 3, motionDefault: 'full', rightClickProtect: false, watermark: false, socialLinks: [],
  });
  let loading = $state(true);
  let savedJson = $state('');

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
      await saveSettings(gh, $state.snapshot(s) as Settings);
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
  <p class="ez-help">Looks and themes live in the <strong>Design</strong> tab. This is the practical stuff.</p>

  <label class="ez-field"><span class="ez-label">Site title</span>
    <input class="ez-input" bind:value={s.siteTitle} placeholder="Your name or studio" />
    <span class="ez-help">Shows in the browser tab and search results.</span></label>
  <label class="ez-field"><span class="ez-label">Tagline</span>
    <input class="ez-input" bind:value={s.tagline} placeholder="Paintings and works on paper" /></label>
  <label class="ez-field"><span class="ez-label">Name shown in the header</span>
    <input class="ez-input" bind:value={s.logoText} placeholder="Your name" /></label>

  <label class="ez-field ez-field--check"><input type="checkbox" bind:checked={s.rightClickProtect} />
    <span>Discourage saving my images (right-click)</span></label>
  <label class="ez-field ez-field--check"><input type="checkbox" bind:checked={s.watermark} />
    <span>Watermark my images</span></label>
  {#if s.watermark}
    <label class="ez-field"><span class="ez-label">Watermark text</span>
      <input class="ez-input" bind:value={s.watermarkText} placeholder="© Your Name" /></label>
  {/if}

  <label class="ez-field"><span class="ez-label">Search description</span>
    <textarea class="ez-input" rows="2" bind:value={s.metaDescription}></textarea>
    <span class="ez-help">A sentence describing your site, shown in Google results.</span></label>

  <div class="ez-block">
    <div class="ez-block__head"><strong>Social links</strong>
      <button class="ez-btn ez-btn--sm" onclick={() => (s.socialLinks = [...s.socialLinks, { label: '', url: '' }])}>Add link</button></div>
    {#each s.socialLinks as link, i (i)}
      <div class="ez-row">
        <input class="ez-input" style="max-width:10rem" bind:value={link.label} placeholder="Instagram" />
        <input class="ez-input" bind:value={link.url} placeholder="https://instagram.com/you" />
        <button class="ez-btn ez-btn--sm ez-btn--ghost" onclick={() => (s.socialLinks = s.socialLinks.filter((_, j) => j !== i))}>×</button>
      </div>
    {/each}
  </div>

  <div class="ez-block">
    <strong>Newsletter</strong>
    <p class="ez-help">Collect email addresses from visitors. Signups are delivered to your inbox (or, if your site is on Netlify, to your Netlify dashboard under Forms).</p>
    <label class="ez-field ez-field--check"><input type="checkbox" bind:checked={s.newsletterEnabled} />
      <span>Show a newsletter signup on my contact page</span></label>
    {#if s.newsletterEnabled}
      <label class="ez-field"><span class="ez-label">Heading</span>
        <input class="ez-input" bind:value={s.newsletterHeading} placeholder="Stay in the loop" /></label>
      <label class="ez-field"><span class="ez-label">Short blurb</span>
        <input class="ez-input" bind:value={s.newsletterBlurb} placeholder="The occasional note about new work and shows." /></label>
    {/if}
  </div>

  <div class="ez-block">
    <strong>Visitor analytics</strong>
    <p class="ez-help">See how many people visit, privately — no cookie banner needed. Turn on Web Analytics in your Cloudflare dashboard, then paste the token here.</p>
    <label class="ez-field"><span class="ez-label">Cloudflare Web Analytics token</span>
      <input class="ez-input ez-mono" bind:value={s.cfAnalyticsToken} placeholder="abc123…" /></label>
  </div>

  <div class="ez-block">
    <strong>Custom domain</strong>
    <p class="ez-help">Use your own web address (like your-name.com) instead of the default one. Optional, and free on both Netlify and GitHub Pages.</p>
    <label class="ez-field"><span class="ez-label">Your domain</span>
      <input class="ez-input" bind:value={s.customDomain} placeholder="your-name.com" /></label>
    <ol class="ez-steps">
      <li>Buy a domain if you don't have one — Porkbun, Namecheap, or similar, usually about $10–20 a year.</li>
      <li>Add it on your host: in <strong>Netlify → Domain management → Add a domain</strong>, or in your repo's <strong>GitHub → Settings → Pages → Custom domain</strong>.</li>
      <li>Point your domain at your host with the DNS records it shows you. HTTPS is set up automatically.</li>
      <li>Pop your domain in the box above and save, so links and search results use it.</li>
    </ol>
    <p class="ez-help">Full walkthrough: <a href="https://easel.rosematcha.com/custom-domain/" target="_blank" rel="noopener">easel.rosematcha.com/custom-domain</a>.</p>
  </div>

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
    <p class="ez-help">These run on your published site, not here. Broken code can break your site — we don't check it.</p>
  </details>
{/if}
