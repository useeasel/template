/**
 * Branded social share cards (OpenGraph / Twitter), generated at build time — no
 * backend. The /og/[slug].png endpoint calls renderShareCard for each page; satori
 * lays out the card and converts the text to vector paths (so the rasterizer needs
 * no system fonts), then resvg encodes the PNG. Colours come from the artist's
 * design tokens, so every card matches the look of their site.
 */
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolveDesign } from './design';

// Static (non-variable) Jost for the cards: satori can't parse variable fonts, and
// it reads .woff directly (no woff2/decompression). The site itself loads Jost from
// Google Fonts — this @fontsource/jost copy is only for build-time image generation.
const require = createRequire(import.meta.url);
const loadFont = (weight: 600 | 700) =>
  readFileSync(require.resolve(`@fontsource/jost/files/jost-latin-${weight}-normal.woff`));

const FONTS = [
  { name: 'Jost', weight: 700 as const, style: 'normal' as const, data: loadFont(700) },
  { name: 'Jost', weight: 600 as const, style: 'normal' as const, data: loadFont(600) },
];

// Landscape = OpenGraph/Twitter cards (link previews). Story = a 9:16 image the
// artist downloads to post to an Instagram/TikTok story.
const DIMS = {
  landscape: { width: 1200, height: 630 },
  story: { width: 1080, height: 1920 },
} as const;
export type CardFormat = keyof typeof DIMS;

export interface CardColors {
  accent: string;
  ink: string;
  paper: string;
}

/** Derive a card's palette from a site's resolved design tokens. */
export function getCardColors(settings: { design?: unknown }): CardColors {
  const design = resolveDesign(settings.design as any);
  return {
    accent: design.color.accent,
    ink: design.color.text,
    paper: design.color.background,
  };
}

/** Wrap a rendered card PNG in an immutably-cached image response. */
export function pngResponse(png: Buffer): Response {
  // Re-wrap as a plain Uint8Array: TS won't accept Buffer<ArrayBufferLike> as a
  // BodyInit (its backing buffer could be a SharedArrayBuffer).
  return new Response(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}

export interface ShareCardInput {
  title: string;
  subtitle: string;
  colors: CardColors;
  format?: CardFormat;
}

export async function renderShareCard({ title, subtitle, colors, format = 'landscape' }: ShareCardInput): Promise<Buffer> {
  const { width: WIDTH, height: HEIGHT } = DIMS[format];
  const story = format === 'story';
  // Scale the headline down for long titles so they never overflow vertically.
  const len = title.length;
  const titleSize = story
    ? len > 60 ? 84 : len > 38 ? 104 : 128
    : len > 60 ? 52 : len > 38 ? 62 : 78;

  const tree = {
    type: 'div',
    props: {
      style: {
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: story ? '110px 96px' : '72px',
        background: colors.paper,
        fontFamily: 'Jost',
      },
      children: [
        // Bauhaus accent bar.
        {
          type: 'div',
          props: { style: { display: 'flex', width: story ? '200px' : '132px', height: story ? '32px' : '22px', background: colors.accent } },
        },
        {
          type: 'div',
          props: {
            style: { display: 'flex', flexDirection: 'column' },
            children: [
              {
                type: 'div',
                props: {
                  style: {
                    display: 'flex',
                    fontSize: `${titleSize}px`,
                    fontWeight: 700,
                    color: colors.ink,
                    lineHeight: 1.08,
                    letterSpacing: '-0.02em',
                  },
                  children: title,
                },
              },
              {
                type: 'div',
                props: {
                  style: { display: 'flex', marginTop: story ? '40px' : '24px', fontSize: story ? '52px' : '34px', fontWeight: 600, color: colors.accent },
                  children: subtitle,
                },
              },
            ],
          },
        },
      ],
    },
  };

  const svg = await satori(tree, { width: WIDTH, height: HEIGHT, fonts: FONTS });
  return new Resvg(svg, { fitTo: { mode: 'width', value: WIDTH } }).render().asPng();
}
