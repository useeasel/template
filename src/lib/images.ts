/**
 * Image helpers for astro:assets. The actual <Image>/<Picture> components are
 * used directly in .astro files; this module centralizes the responsive
 * defaults so cards, the lightbox, and hero images stay consistent.
 */

/** Widths emitted for responsive `srcset` in grids/cards. */
export const CARD_WIDTHS = [400, 600, 800, 1000];

/** Widths for full-bleed / lightbox images. */
export const FULL_WIDTHS = [800, 1200, 1600, 2000];

/**
 * `sizes` for the lightbox overlay. The image is capped at 90vw / 70vh, so a phone
 * picks an ~800px variant from the srcset instead of always pulling the 1600px one.
 */
export const LIGHTBOX_SIZES = '90vw';

/** Default `sizes` attribute for a grid card given a column count. */
export function cardSizes(columns: number): string {
  // Roughly: full width on mobile, 1/columns on desktop.
  const pct = Math.round(100 / Math.max(1, columns));
  return `(max-width: 640px) 100vw, ${pct}vw`;
}
