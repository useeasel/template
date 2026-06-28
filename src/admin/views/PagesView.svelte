<script lang="ts">
  import type { GitHub } from '../lib/github';
  import type { AboutPage, ContactPage, CvPage, PressPage, Settings } from '../lib/content';
  import {
    loadAbout, saveAbout, loadContact, saveContact,
    loadCv, saveCv, loadPress, savePress,
    loadSettings, saveSettings,
  } from '../lib/store';
  import { resolveDesign, type DesignTokens } from '../../lib/design';
  import { useShell } from '../lib/shell.svelte';
  import NewsView from './NewsView.svelte';
  import ExhibitionsView from './ExhibitionsView.svelte';
  import TestimonialsView from './TestimonialsView.svelte';

  let {
    gh,
    notify,
    initialTab = null,
  }: {
    gh: GitHub;
    notify: (m: string, k?: 'info' | 'error') => void;
    initialTab?: string | null;
  } = $props();

  const shell = useShell();

  type Tab = 'menu' | 'about' | 'contact' | 'cv' | 'press' | 'exhibitions' | 'news' | 'testimonials';
  const isTab = (t: string | null): t is Tab =>
    t === 'menu' || t === 'about' || t === 'contact' || t === 'cv' || t === 'press' ||
    t === 'exhibitions' || t === 'news' || t === 'testimonials';
  let tab = $state<Tab>(isTab(initialTab) ? initialTab : 'menu');
  let loading = $state(true);

  let about = $state<AboutPage>({ title: 'About', body: '' });
  let contact = $state<ContactPage>({ title: 'Contact', formEnabled: true, body: '' });
  let cv = $state<CvPage>({ title: 'CV', cv: [] });
  let press = $state<PressPage>({ title: 'Press', press: [] });

  // The Menu tab edits site settings (which pages show + the shop/commissions
  // config for pages that have no content editor). It's the one settings-backed
  // tab here; the rest write their own markdown.
  let settings = $state<Settings>({
    siteTitle: '', logoText: '', theme: 'default', portfolioLayout: 'grid',
    columns: 3, motionDefault: 'full', rightClickProtect: false, watermark: false, socialLinks: [],
  });
  let pages = $state<DesignTokens['pages']>(resolveDesign(undefined).pages);
  let menuBaseline = $state('');
  const menuSig = () => JSON.stringify({ s: $state.snapshot(settings), p: $state.snapshot(pages) });

  // Per-tab baselines so each markdown form's dirty/save is independent (and each
  // save stays one commit per page, matching store.ts).
  let baseline = $state<Record<string, string>>({});
  const snap = (v: unknown) => JSON.stringify($state.snapshot(v as any));

  async function load() {
    loading = true;
    try {
      const [a, c, cvData, pr, st] = await Promise.all([
        loadAbout(gh), loadContact(gh), loadCv(gh), loadPress(gh), loadSettings(gh),
      ]);
      about = a; contact = c; cv = cvData; press = pr;
      settings = st;
      pages = resolveDesign(st.design).pages;
      baseline = {
        about: snap(about), contact: snap(contact), cv: snap(cv), press: snap(press),
      };
      menuBaseline = menuSig();
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not load pages.', 'error');
    }
    loading = false;
  }
  load();

  function current() {
    return tab === 'about' ? about : tab === 'contact' ? contact : tab === 'cv' ? cv : press;
  }

  const selfManaged = (t: Tab) => t === 'news' || t === 'exhibitions' || t === 'testimonials';

  // --- Menu tab (settings-backed) ---
  const isDirtyMenu = () => !loading && !!menuBaseline && menuSig() !== menuBaseline;
  async function saveMenu(): Promise<boolean> {
    try {
      const d = resolveDesign($state.snapshot(settings).design);
      d.pages = $state.snapshot(pages);
      settings.design = d as unknown as Record<string, any>;
      await saveSettings(gh, $state.snapshot(settings));
      menuBaseline = menuSig();
      notify('Saved. Your site will update shortly.');
      return true;
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not save.', 'error');
      return false;
    }
  }
  function discardMenu() {
    if (!menuBaseline) return;
    const b = JSON.parse(menuBaseline);
    settings = b.s;
    pages = b.p;
  }

  // --- Markdown tabs (about / contact / cv / press) ---
  const isDirtyMarkdown = () => !loading && !selfManaged(tab) && tab !== 'menu' && snap(current()) !== baseline[tab];
  async function saveMarkdown(): Promise<boolean> {
    try {
      if (tab === 'about') await saveAbout(gh, $state.snapshot(about));
      else if (tab === 'contact') await saveContact(gh, $state.snapshot(contact));
      else if (tab === 'cv') await saveCv(gh, $state.snapshot(cv) as CvPage);
      else if (tab === 'press') await savePress(gh, $state.snapshot(press) as PressPage);
      else return true;
      baseline[tab] = snap(current());
      notify('Saved. Your site will update shortly.');
      return true;
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not save.', 'error');
      return false;
    }
  }
  function discardMarkdown() {
    if (tab === 'menu' || selfManaged(tab) || !baseline[tab]) return;
    const b = JSON.parse(baseline[tab]);
    if (tab === 'about') about = b;
    else if (tab === 'contact') contact = b;
    else if (tab === 'cv') cv = b;
    else if (tab === 'press') press = b;
  }

  // Register the active tab with the shell. News/Exhibitions/Testimonials drive
  // their own saves, so we skip registration there.
  $effect(() => {
    if (tab === 'menu') return shell.register({ isDirty: isDirtyMenu, save: saveMenu, discard: discardMenu });
    if (selfManaged(tab)) return;
    return shell.register({ isDirty: isDirtyMarkdown, save: saveMarkdown, discard: discardMarkdown });
  });

  function switchTab(t: Tab) {
    if (t === tab) return;
    shell.guard(() => (tab = t));
  }

  // `page` ties a tab to its menu toggle: the tab only shows when that page is on.
  // Menu has no page (always shown); Testimonials feed the About page, so they
  // ride along with it.
  const TABS: { id: Tab; label: string; page?: keyof DesignTokens['pages'] }[] = [
    { id: 'menu', label: 'Menu' },
    { id: 'about', label: 'About', page: 'about' },
    { id: 'contact', label: 'Contact', page: 'contact' },
    { id: 'cv', label: 'CV', page: 'cv' },
    { id: 'press', label: 'Press', page: 'press' },
    { id: 'exhibitions', label: 'Exhibitions', page: 'exhibitions' },
    { id: 'news', label: 'News', page: 'news' },
    { id: 'testimonials', label: 'Testimonials', page: 'about' },
  ];

  // Only show tabs for pages that are turned on (plus the always-on Menu). The
  // active tab stays visible even if just disabled, so its content never orphans.
  let visibleTabs = $derived(TABS.filter((t) => !t.page || pages[t.page] || t.id === tab));

  // The pages shown in the Menu tab, in display order. Some expand to extra
  // config; the rest are a plain on/off.
  const PAGE_ROWS: { key: keyof DesignTokens['pages']; label: string; hint: string }[] = [
    { key: 'about', label: 'About', hint: 'Your bio and statement.' },
    { key: 'contact', label: 'Contact', hint: 'How people reach you.' },
    { key: 'cv', label: 'CV', hint: 'Exhibitions, education, and awards.' },
    { key: 'press', label: 'Press', hint: 'Mentions and reviews.' },
    { key: 'exhibitions', label: 'Exhibitions', hint: 'A list of your shows.' },
    { key: 'news', label: 'News', hint: 'Posts and updates.' },
    { key: 'available', label: 'Available work', hint: 'A page collecting the pieces you have for sale.' },
    { key: 'presskit', label: 'Press kit', hint: 'A bio and downloadable images for press.' },
    { key: 'commissions', label: 'Commissions', hint: 'Take commission requests.' },
    { key: 'shop', label: 'Shop', hint: 'Sell through a store you embed.' },
  ];
</script>

<div class="ez-tabs" role="tablist" aria-label="Pages">
  {#each visibleTabs as t (t.id)}
    <button class="ez-tab" class:ez-tab--on={tab === t.id} role="tab" aria-selected={tab === t.id} onclick={() => switchTab(t.id)}>{t.label}</button>
  {/each}
</div>

{#if loading}
  <p class="ez-help">Loading…</p>
{:else if tab === 'menu'}
  <div class="ez-view__head">
    <p class="ez-help">Choose which pages appear in your site's menu. Turn one on, then add its content in the tab above. Pages without their own tab are set up right here.</p>
  </div>
  <div class="ez-pagelist">
      {#each PAGE_ROWS as row (row.key)}
        <div class="ez-pagerow">
          <label class="ez-toggle"><span class="ez-toggle__text">
              <span class="ez-toggle__label">{row.label}</span>
              <span class="ez-help">{row.hint}</span></span>
            <input type="checkbox" class="ez-switch" bind:checked={pages[row.key]} /></label>

          {#if row.key === 'cv' && pages.cv}
            <div class="ez-pagerow__config">
              <label class="ez-toggle"><span class="ez-toggle__text">
                  <span class="ez-toggle__label">Fill exhibitions from my Exhibitions list</span>
                  <span class="ez-help">Builds the CV's exhibitions sections from your Exhibitions, split into solo and group shows.</span></span>
                <input type="checkbox" class="ez-switch" bind:checked={settings.cvAutoExhibitions} /></label>
            </div>
          {:else if row.key === 'commissions' && pages.commissions}
            <div class="ez-pagerow__config">
              <label class="ez-field"><span class="ez-label">How people request a commission</span>
                <select class="ez-input" bind:value={settings.commissionsMode}>
                  <option value="form">A request form on my site</option>
                  <option value="vgen">Send them to my vGen page</option>
                </select></label>
              {#if settings.commissionsMode === 'vgen'}
                <label class="ez-field"><span class="ez-label">Your vGen page address</span>
                  <input class="ez-input ez-mono" bind:value={settings.commissionsVgenUrl} placeholder="https://vgen.co/yourname" /></label>
              {/if}
              <label class="ez-field"><span class="ez-label">Intro (optional)</span>
                <textarea class="ez-input" rows="2" bind:value={settings.commissionsIntro} placeholder="A line about what you take on and your style."></textarea></label>
              <label class="ez-field"><span class="ez-label">Terms, steps, or deposit (optional)</span>
                <textarea class="ez-input" rows="3" bind:value={settings.commissionsTerms} placeholder="How it works, timelines, deposit, what you don't take on."></textarea></label>
            </div>
          {:else if row.key === 'shop' && pages.shop}
            <div class="ez-pagerow__config">
              <p class="ez-help">Paste a store embed from Gumroad, Big Cartel, or Shopify. People buy through your store, on your own site. Easel never touches the payment.</p>
              <label class="ez-field"><span class="ez-label">Intro (optional)</span>
                <textarea class="ez-input" rows="2" bind:value={settings.shopIntro} placeholder="A line about your shop."></textarea></label>
              <label class="ez-field"><span class="ez-label">Store embed code</span>
                <textarea class="ez-input ez-mono" rows="4" bind:value={settings.shopEmbed} placeholder="Paste the embed snippet from your shop (Gumroad, Big Cartel, Shopify Buy Button)."></textarea>
                <span class="ez-help">Copy this from your shop's "embed" or "buy button" option.</span></label>
            </div>
          {/if}
        </div>
      {/each}
  </div>
{:else if tab === 'about'}
  <div class="ez-view__head">
    <p class="ez-help">Your statement and bio, shown on your About page.</p>
  </div>
  <label class="ez-field"><span class="ez-label">One-line intro</span>
    <input class="ez-input" bind:value={about.statement} placeholder="Painter working between Lisbon and Berlin" /></label>
  <label class="ez-field"><span class="ez-label">Your bio</span>
    <textarea class="ez-input" rows="8" bind:value={about.body}></textarea>
    <span class="ez-help">Plain text or Markdown.</span></label>
{:else if tab === 'contact'}
  <div class="ez-view__head">
    <p class="ez-help">How visitors reach you, with an optional contact form.</p>
  </div>
  <label class="ez-field"><span class="ez-label">Intro</span>
    <input class="ez-input" bind:value={contact.intro} placeholder="I'd love to hear from you" /></label>
  <label class="ez-field"><span class="ez-label">Your email</span>
    <input class="ez-input" bind:value={contact.email} placeholder="you@example.com" /></label>
  <label class="ez-field ez-field--check">
    <input type="checkbox" bind:checked={contact.formEnabled} />
    <span>Show a contact form so visitors can message me</span></label>
{:else if tab === 'cv'}
  <div class="ez-view__head">
    <p class="ez-help">Your exhibitions, education, and awards, in sections you name.</p>
    <div class="ez-view__actions">
      <button class="ez-btn ez-btn--primary" onclick={() => (cv.cv = [...cv.cv, { heading: '', items: [] }])}>Add section</button>
    </div>
  </div>
  {#if cv.cv.length === 0}
    <div class="ez-empty">
      <p>No sections yet.</p>
      <button class="ez-btn ez-btn--primary" onclick={() => (cv.cv = [...cv.cv, { heading: '', items: [] }])}>Add your first section</button>
    </div>
  {/if}
  {#each cv.cv as section, si (si)}
    <div class="ez-block">
      <div class="ez-block__head">
        <input class="ez-input" bind:value={section.heading} placeholder="Section, e.g. Exhibitions" />
        <button class="ez-btn ez-btn--sm ez-btn--ghost" onclick={() => (cv.cv = cv.cv.filter((_, i) => i !== si))}>Remove</button>
      </div>
      {#each section.items as item, ii (ii)}
        <div class="ez-row">
          <input class="ez-input" style="max-width:7rem" bind:value={item.year} placeholder="Year" />
          <input class="ez-input" bind:value={item.text} placeholder="Detail" />
          <button class="ez-btn ez-btn--sm ez-btn--ghost" onclick={() => (section.items = section.items.filter((_, i) => i !== ii))} aria-label="Remove">×</button>
        </div>
      {/each}
      <button class="ez-btn ez-btn--sm" onclick={() => (section.items = [...section.items, { year: '', text: '' }])}>Add entry</button>
    </div>
  {/each}
{:else if tab === 'press'}
  <div class="ez-view__head">
    <p class="ez-help">Coverage and mentions, with optional quotes and links.</p>
    <div class="ez-view__actions">
      <button class="ez-btn ez-btn--primary" onclick={() => (press.press = [...press.press, { outlet: '', title: '' }])}>Add mention</button>
    </div>
  </div>
  {#if press.press.length === 0}
    <div class="ez-empty">
      <p>No mentions yet.</p>
      <button class="ez-btn ez-btn--primary" onclick={() => (press.press = [...press.press, { outlet: '', title: '' }])}>Add your first mention</button>
    </div>
  {/if}
  {#each press.press as item, pi (pi)}
    <div class="ez-block">
      <div class="ez-block__head">
        <input class="ez-input" bind:value={item.outlet} placeholder="Publication" />
        <button class="ez-btn ez-btn--sm ez-btn--ghost" onclick={() => (press.press = press.press.filter((_, i) => i !== pi))}>Remove</button>
      </div>
      <input class="ez-input" bind:value={item.title} placeholder="Headline" />
      <div class="ez-row">
        <input class="ez-input" bind:value={item.url} placeholder="Link (optional)" />
        <input class="ez-input" style="max-width:9rem" bind:value={item.date} placeholder="Date" />
      </div>
      <textarea class="ez-input" rows="2" bind:value={item.excerpt} placeholder="Quote (optional)"></textarea>
    </div>
  {/each}
{:else if tab === 'news'}
  <NewsView {gh} {notify} />
{:else if tab === 'testimonials'}
  <TestimonialsView {gh} {notify} />
{:else}
  <ExhibitionsView {gh} {notify} />
{/if}
