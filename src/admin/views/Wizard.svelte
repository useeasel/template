<script lang="ts">
  import type { GitHub } from '../lib/github';
  import type { Settings } from '../lib/content';
  import { loadSettings, saveSettings } from '../lib/store';
  import { VIBES, SUGGESTED_FONTS, resolveDesign, type DesignTokens } from '../../lib/design';
  import LivePreview from './LivePreview.svelte';

  let {
    gh,
    notify,
    onClose,
  }: {
    gh: GitHub;
    notify: (m: string, k?: 'info' | 'error') => void;
    onClose: (saved: boolean) => void;
  } = $props();

  let s = $state<Settings | null>(null);
  let d = $state<DesignTokens>(resolveDesign(undefined));
  let step = $state(0);
  let saving = $state(false);

  loadSettings(gh).then((res) => {
    s = res;
    if (res.design) d = resolveDesign(res.design);
  });

  const STEPS = ['Vibe', 'Type', 'Colors', 'Layout', 'Done'];

  function pickVibe(preset: string) {
    d = resolveDesign({ preset });
  }

  function next() { if (step < STEPS.length - 1) step += 1; }
  function back() { if (step > 0) step -= 1; }

  async function finish() {
    if (!s) return;
    saving = true;
    try {
      s.design = $state.snapshot(d) as Record<string, any>;
      await saveSettings(gh, $state.snapshot(s) as Settings);
      notify('Your style is set. Your site will update shortly.');
      onClose(true);
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not save.', 'error');
      saving = false;
    }
  }

  const WEIGHTS = [400, 500, 600, 700, 800];
</script>

<div class="ez-wiz">
  <header class="ez-wiz__head">
    <div class="ez-wiz__brand"><strong>Easel</strong><span class="ez-help">Let's set up your style</span></div>
    <ol class="ez-wiz__steps">
      {#each STEPS as label, i (label)}
        <li class:ez-wiz__step--on={i === step} class:ez-wiz__step--done={i < step}>{label}</li>
      {/each}
    </ol>
    <button class="ez-btn ez-btn--sm ez-btn--ghost" onclick={() => onClose(false)}>Skip for now</button>
  </header>

  <div class="ez-wiz__body">
    <div class="ez-wiz__panel">
      {#if step === 0}
        <h1>What's the vibe?</h1>
        <p class="ez-help">Pick the feeling you're after. You can fine-tune everything next.</p>
        <div class="ez-wiz__grid">
          {#each VIBES as v (v.preset)}
            <button class="ez-wiz__card" class:ez-wiz__card--on={d.preset === v.preset} onclick={() => pickVibe(v.preset)}>
              <span class="ez-wiz__card-title">{v.label}</span>
              <span class="ez-help">{v.blurb}</span>
            </button>
          {/each}
        </div>
      {:else if step === 1}
        <h1>Choose your type</h1>
        <label class="ez-field"><span class="ez-label">Heading font</span>
          <input class="ez-input" list="wf-h" bind:value={d.type.headingFont} /></label>
        <label class="ez-field"><span class="ez-label">Body font</span>
          <input class="ez-input" list="wf-b" bind:value={d.type.bodyFont} /></label>
        <datalist id="wf-h">{#each SUGGESTED_FONTS.heading as f}<option value={f}></option>{/each}</datalist>
        <datalist id="wf-b">{#each SUGGESTED_FONTS.body as f}<option value={f}></option>{/each}</datalist>
        <p class="ez-help">Pick a suggestion or type any Google Fonts name.</p>
        <label class="ez-field"><span class="ez-label">Heading weight</span>
          <select class="ez-input" bind:value={d.type.headingWeight}>{#each WEIGHTS as w}<option value={w}>{w}</option>{/each}</select></label>
        <label class="ez-field"><span class="ez-label">Text size — {d.type.baseSize}px</span>
          <input type="range" min="14" max="22" step="1" bind:value={d.type.baseSize} /></label>
      {:else if step === 2}
        <h1>Set your colors</h1>
        <p class="ez-help">The essentials. More slots live in the Design tab later.</p>
        <div class="ez-colorgrid">
          <label class="ez-color"><input type="color" bind:value={d.color.background} /><span>Background</span></label>
          <label class="ez-color"><input type="color" bind:value={d.color.text} /><span>Text</span></label>
          <label class="ez-color"><input type="color" bind:value={d.color.accent} /><span>Accent</span></label>
          <label class="ez-color"><input type="color" bind:value={d.color.accent2} /><span>Second accent</span></label>
          <label class="ez-color"><input type="color" bind:value={d.color.border} /><span>Lines</span></label>
        </div>
      {:else if step === 3}
        <h1>Lay it out</h1>
        <label class="ez-field"><span class="ez-label">Navigation</span>
          <select class="ez-input" bind:value={d.nav.layout}>
            <option value="side">Name beside the menu</option><option value="top">Name above the menu</option></select></label>
        <label class="ez-field"><span class="ez-label">Thumbnails</span>
          <select class="ez-input" bind:value={d.thumb.fit}>
            <option value="contain">Keep original shape</option><option value="cover">Crop to squares</option></select></label>
        <label class="ez-field ez-field--check"><input type="checkbox" bind:checked={d.hero.enabled} /><span>Show an intro (name + tagline) above my work</span></label>
      {:else}
        <h1>Looks great.</h1>
        <p>Your site is ready to wear this style. You can fine-tune every detail any time in the <strong>Design</strong> tab.</p>
        <button class="ez-btn ez-btn--primary ez-btn--lg" onclick={finish} disabled={saving}>{saving ? 'Saving…' : 'Finish & save'}</button>
      {/if}
    </div>

    <div class="ez-wiz__preview"><LivePreview design={d} /></div>
  </div>

  <footer class="ez-wiz__foot">
    <button class="ez-btn" onclick={back} disabled={step === 0}>Back</button>
    {#if step < STEPS.length - 1}
      <button class="ez-btn ez-btn--primary" onclick={next}>Next</button>
    {/if}
  </footer>
</div>
