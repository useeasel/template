<script lang="ts">
  import type { GitHub } from '../lib/github';
  import type { AboutPage, ContactPage, CvPage, PressPage } from '../lib/content';
  import {
    loadAbout, saveAbout, loadContact, saveContact,
    loadCv, saveCv, loadPress, savePress,
  } from '../lib/store';
  import { useShell } from '../lib/shell.svelte';
  import NewsView from './NewsView.svelte';
  import ExhibitionsView from './ExhibitionsView.svelte';

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

  type Tab = 'about' | 'contact' | 'cv' | 'press' | 'exhibitions' | 'news';
  const isTab = (t: string | null): t is Tab =>
    t === 'about' || t === 'contact' || t === 'cv' || t === 'press' || t === 'exhibitions' || t === 'news';
  let tab = $state<Tab>(isTab(initialTab) ? initialTab : 'about');
  let loading = $state(true);

  let about = $state<AboutPage>({ title: 'About', body: '' });
  let contact = $state<ContactPage>({ title: 'Contact', formEnabled: true, body: '' });
  let cv = $state<CvPage>({ title: 'CV', cv: [] });
  let press = $state<PressPage>({ title: 'Press', press: [] });

  // Per-tab baselines so each form's dirty/save is independent (and each save
  // stays one commit per page, matching store.ts).
  let baseline = $state<Record<string, string>>({});
  const snap = (v: unknown) => JSON.stringify($state.snapshot(v as any));

  async function load() {
    loading = true;
    try {
      [about, contact, cv, press] = await Promise.all([
        loadAbout(gh), loadContact(gh), loadCv(gh), loadPress(gh),
      ]);
      baseline = {
        about: snap(about), contact: snap(contact), cv: snap(cv), press: snap(press),
      };
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not load pages.', 'error');
    }
    loading = false;
  }
  load();

  function current() {
    return tab === 'about' ? about : tab === 'contact' ? contact : tab === 'cv' ? cv : press;
  }

  const isDirty = () => !loading && tab !== 'news' && tab !== 'exhibitions' && snap(current()) !== baseline[tab];

  async function save(): Promise<boolean> {
    try {
      if (tab === 'about') await saveAbout(gh, $state.snapshot(about));
      else if (tab === 'contact') await saveContact(gh, $state.snapshot(contact));
      else if (tab === 'cv') await saveCv(gh, $state.snapshot(cv) as CvPage);
      else if (tab === 'press') await savePress(gh, $state.snapshot(press) as PressPage);
      else return true; // news manages its own saves
      baseline[tab] = snap(current());
      notify('Saved. Your site will update shortly.');
      return true;
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not save.', 'error');
      return false;
    }
  }

  function discard() {
    if (tab === 'news' || tab === 'exhibitions' || !baseline[tab]) return;
    const b = JSON.parse(baseline[tab]);
    if (tab === 'about') about = b;
    else if (tab === 'contact') contact = b;
    else if (tab === 'cv') cv = b;
    else if (tab === 'press') press = b;
  }

  // Register the active form tab with the shell. News drives its own saves, so we
  // skip registration there (NewsView registers itself when an editor is open).
  $effect(() => {
    if (tab === 'news' || tab === 'exhibitions') return;
    return shell.register({ isDirty, save, discard });
  });

  function switchTab(t: Tab) {
    if (t === tab) return;
    shell.guard(() => (tab = t));
  }

  const TABS: { id: Tab; label: string }[] = [
    { id: 'about', label: 'About' },
    { id: 'contact', label: 'Contact' },
    { id: 'cv', label: 'CV' },
    { id: 'press', label: 'Press' },
    { id: 'exhibitions', label: 'Exhibitions' },
    { id: 'news', label: 'News' },
  ];
</script>

<div class="ez-tabs">
  {#each TABS as t (t.id)}
    <button class="ez-tab" class:ez-tab--on={tab === t.id} onclick={() => switchTab(t.id)}>{t.label}</button>
  {/each}
</div>

{#if loading}
  <p class="ez-help">Loading…</p>
{:else if tab === 'about'}
  <label class="ez-field"><span class="ez-label">One-line intro</span>
    <input class="ez-input" bind:value={about.statement} placeholder="Painter working between Lisbon and Berlin" /></label>
  <label class="ez-field"><span class="ez-label">Your bio</span>
    <textarea class="ez-input" rows="8" bind:value={about.body}></textarea></label>
{:else if tab === 'contact'}
  <label class="ez-field"><span class="ez-label">Intro</span>
    <input class="ez-input" bind:value={contact.intro} placeholder="I'd love to hear from you" /></label>
  <label class="ez-field"><span class="ez-label">Your email</span>
    <input class="ez-input" bind:value={contact.email} placeholder="you@example.com" /></label>
  <label class="ez-field ez-field--check">
    <input type="checkbox" bind:checked={contact.formEnabled} />
    <span>Show a contact form so visitors can message me</span></label>
{:else if tab === 'cv'}
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
          <button class="ez-btn ez-btn--sm ez-btn--ghost" onclick={() => (section.items = section.items.filter((_, i) => i !== ii))}>×</button>
        </div>
      {/each}
      <button class="ez-btn ez-btn--sm" onclick={() => (section.items = [...section.items, { year: '', text: '' }])}>Add entry</button>
    </div>
  {/each}
  <button class="ez-btn" onclick={() => (cv.cv = [...cv.cv, { heading: '', items: [] }])}>Add section</button>
{:else if tab === 'press'}
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
  <button class="ez-btn" onclick={() => (press.press = [...press.press, { outlet: '', title: '' }])}>Add mention</button>
{:else if tab === 'news'}
  <NewsView {gh} {notify} />
{:else}
  <ExhibitionsView {gh} {notify} />
{/if}
