<script lang="ts">
  import { resolveDesign } from '../../lib/design';

  let {
    preset,
    label,
    blurb,
    selected = false,
    previewing = false,
    onhover,
    onleave,
    onpick,
  }: {
    preset: string;
    label: string;
    blurb: string;
    selected?: boolean;
    previewing?: boolean;
    /** Fires on pointer enter / keyboard focus — preview only, never commits. */
    onhover?: () => void;
    /** Fires on pointer leave / blur — drop the preview. */
    onleave?: () => void;
    /** Fires on click / Enter — confirm this preset. */
    onpick?: () => void;
  } = $props();

  // The real resolved look, so the swatch shows actual colors + type (no iframe needed).
  const d = resolveDesign({ preset });
  // Cap the corner radius for the small tile so airy presets don't look like pills.
  const radius = Math.min(d.shape.radius, 12);
  const headFont = `'${d.type.headingFont}', Georgia, serif`;
</script>

<button
  type="button"
  class="ez-presetcard"
  class:ez-presetcard--selected={selected}
  class:ez-presetcard--previewing={previewing}
  aria-pressed={selected}
  title={`${label} — ${blurb}`}
  onmouseenter={onhover}
  onmouseleave={onleave}
  onfocus={onhover}
  onblur={onleave}
  onclick={onpick}
>
  <!-- The button fills its whole grid cell so adjacent hit areas tile with no gap; the
       visible card (and its spacing) lives on this inner wrapper. -->
  <span class="ez-presetcard__inner">
    <span
      class="ez-presetcard__swatch"
      style={`background:${d.color.background};border:${Math.max(d.shape.borderWidth, 1)}px solid ${d.color.border};border-radius:${radius}px`}
    >
      <span
        class="ez-presetcard__tile"
        style={`background:${d.color.surface};border-radius:${Math.max(radius - 2, 0)}px`}
      >
        <span
          class="ez-presetcard__aa"
          style={`color:${d.color.heading ?? d.color.text};font-family:${headFont};font-weight:${d.type.headingWeight};text-transform:${d.type.headingTransform};letter-spacing:${d.type.letterSpacing}em`}
          >Aa</span
        >
      </span>
      <span class="ez-presetcard__dots">
        <i style={`background:${d.color.accent}`}></i>
        <i style={`background:${d.color.accent2}`}></i>
        <i style={`background:${d.color.text}`}></i>
      </span>
      {#if selected}<span class="ez-presetcard__check" aria-hidden="true">✓</span>{/if}
    </span>
    <span class="ez-presetcard__label">{label}</span>
    <span class="ez-help ez-presetcard__blurb">{blurb}</span>
  </span>
</button>
