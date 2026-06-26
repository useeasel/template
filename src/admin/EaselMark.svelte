<script lang="ts">
  // The Easel brand mark — the little easel-with-shapes glyph. Extracted so the
  // sidebar, mobile bar, and style wizard all share one source of truth.
  let { size = 28 }: { size?: number } = $props();
</script>

<svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
  <g stroke="var(--ez-ink)" stroke-width="3" stroke-linecap="square">
    <line x1="14" y1="10" x2="8" y2="60" /><line x1="50" y1="10" x2="56" y2="60" />
    <line x1="32" y1="40" x2="32" y2="60" /><line x1="11" y1="44" x2="53" y2="44" />
  </g>
  <rect x="12" y="8" width="40" height="32" fill="var(--ez-white)" stroke="var(--ez-ink)" stroke-width="3" />
  <rect x="16" y="20" width="14" height="14" fill="var(--ez-red)" />
  <circle cx="42" cy="18" r="7" fill="var(--ez-blue)" />
  <polygon points="40,34 50,34 45,22" fill="var(--ez-yellow)" />
</svg>
