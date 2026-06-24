<script lang="ts">
  // A dropdown of fonts where every option is rendered in its own typeface, so the
  // artist picks by sight, not by knowing font names. (The editor preloads these —
  // see allFontsHref in admin/index.astro.) An "Other" row allows any Google font.
  let {
    value,
    fonts,
    onpick,
  }: {
    value: string;
    fonts: string[];
    onpick: (font: string) => void;
  } = $props();

  let open = $state(false);
  let custom = $state('');
  let root: HTMLElement;

  function select(f: string) {
    onpick(f);
    open = false;
  }
  function applyCustom() {
    const v = custom.trim();
    if (v) {
      onpick(v);
      custom = '';
      open = false;
    }
  }

  $effect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (root && !root.contains(e.target as Node)) open = false;
    };
    window.addEventListener('pointerdown', onDown);
    return () => window.removeEventListener('pointerdown', onDown);
  });
</script>

<div class="ez-fontpick" bind:this={root}>
  <button type="button" class="ez-input ez-fontpick__btn" style={`font-family:'${value}', sans-serif`} onclick={() => (open = !open)}>
    <span>{value}</span>
    <span class="ez-fontpick__chev" aria-hidden="true">▾</span>
  </button>
  {#if open}
    <div class="ez-fontpick__menu" role="listbox">
      {#each fonts as f (f)}
        <button
          type="button"
          class="ez-fontpick__opt"
          class:ez-fontpick__opt--on={f === value}
          style={`font-family:'${f}', sans-serif`}
          onclick={() => select(f)}
        >{f}</button>
      {/each}
      <div class="ez-fontpick__custom">
        <input
          class="ez-input"
          placeholder="Other Google font…"
          bind:value={custom}
          onkeydown={(e) => e.key === 'Enter' && applyCustom()}
        />
        <button type="button" class="ez-btn ez-btn--sm" onclick={applyCustom}>Use</button>
      </div>
    </div>
  {/if}
</div>
