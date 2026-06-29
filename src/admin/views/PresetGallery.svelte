<script lang="ts">
  import { VIBES, applyVibe, type DesignTokens } from '../../lib/design';
  import PresetCard from './PresetCard.svelte';

  let {
    design,
    onConfirm,
    onPreview,
  }: {
    /** The currently committed design. Drives which card reads as selected. */
    design: DesignTokens;
    /** Commit a preset (click / Enter). Keeps the artist's pages (see applyVibe). */
    onConfirm: (next: DesignTokens) => void;
    /** Emit a not-yet-committed preview look (hover / focus), or null to revert. The
     *  parent feeds this to its single LivePreview so hovering re-themes that iframe. */
    onPreview?: (preview: DesignTokens | null) => void;
  } = $props();

  let previewPreset = $state<string | null>(null);

  // Hover-preview is a desktop affordance. On touch there's no hover, so a tap should
  // just confirm — never leave the preview in a half-applied state.
  const canHover =
    typeof window !== 'undefined' &&
    !!window.matchMedia?.('(hover: hover) and (pointer: fine)').matches;

  function preview(preset: string) {
    if (!canHover || preset === previewPreset) return;
    previewPreset = preset;
    onPreview?.(applyVibe(design, preset));
  }

  function clearPreview() {
    if (previewPreset === null) return;
    previewPreset = null;
    onPreview?.(null);
  }

  function confirm(preset: string) {
    previewPreset = null;
    onPreview?.(null);
    onConfirm(applyVibe(design, preset));
  }
</script>

<div
  class="ez-presetgrid"
  class:ez-presetgrid--hoverable={canHover}
  role="group"
  aria-label="Style presets"
  onmouseleave={clearPreview}
>
  {#each VIBES as v (v.preset)}
    <PresetCard
      preset={v.preset}
      label={v.label}
      blurb={v.blurb}
      selected={design.preset === v.preset}
      previewing={previewPreset === v.preset}
      onhover={() => preview(v.preset)}
      onleave={clearPreview}
      onpick={() => confirm(v.preset)}
    />
  {/each}
</div>
