/*
 * Generates Bauhaus-style placeholder artwork images so a fresh template builds
 * and looks alive before the artist uploads their own work. Run with sharp:
 *   node scripts/gen-placeholders.mjs
 * Outputs JPGs into src/assets/artworks, collection covers, and site/og.
 */
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const palette = {
  blue: '#1D4ED8',
  red: '#E63946',
  yellow: '#F4C20D',
  ink: '#161616',
  paper: '#F7F4EC',
  white: '#FFFFFF',
  stone: '#6B6B63',
};

const colorList = [palette.blue, palette.red, palette.yellow, palette.ink, palette.stone];

// A few composition "recipes" using the circle / square / triangle motif.
function composition(seed, w, h) {
  const c = (i) => colorList[(seed + i) % colorList.length];
  const variant = seed % 4;
  const shapes = [];

  if (variant === 0) {
    shapes.push(`<circle cx="${w * 0.35}" cy="${h * 0.4}" r="${w * 0.25}" fill="${c(1)}"/>`);
    shapes.push(`<rect x="${w * 0.5}" y="${h * 0.45}" width="${w * 0.35}" height="${h * 0.4}" fill="${c(2)}"/>`);
  } else if (variant === 1) {
    shapes.push(`<rect x="${w * 0.1}" y="${h * 0.15}" width="${w * 0.45}" height="${h * 0.7}" fill="${c(1)}"/>`);
    shapes.push(`<polygon points="${w * 0.6},${h * 0.8} ${w * 0.9},${h * 0.8} ${w * 0.75},${h * 0.3}" fill="${c(3)}"/>`);
  } else if (variant === 2) {
    shapes.push(`<polygon points="${w * 0.5},${h * 0.15} ${w * 0.9},${h * 0.85} ${w * 0.1},${h * 0.85}" fill="${c(2)}"/>`);
    shapes.push(`<circle cx="${w * 0.5}" cy="${h * 0.6}" r="${w * 0.18}" fill="${c(4)}"/>`);
  } else {
    shapes.push(`<circle cx="${w * 0.7}" cy="${h * 0.35}" r="${w * 0.22}" fill="${c(2)}"/>`);
    shapes.push(`<rect x="${w * 0.15}" y="${h * 0.5}" width="${w * 0.4}" height="${h * 0.35}" fill="${c(1)}"/>`);
    shapes.push(`<polygon points="${w * 0.2},${h * 0.15} ${w * 0.45},${h * 0.45} ${w * 0.05},${h * 0.45}" fill="${c(3)}"/>`);
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <rect width="${w}" height="${h}" fill="${palette.paper}"/>
    ${shapes.join('\n    ')}
    <rect x="1" y="1" width="${w - 2}" height="${h - 2}" fill="none" stroke="${palette.ink}" stroke-width="2"/>
  </svg>`;
}

async function write(svg, outPath, w, h) {
  mkdirSync(dirname(outPath), { recursive: true });
  await sharp(Buffer.from(svg)).resize(w, h).jpeg({ quality: 82 }).toFile(outPath);
  console.log('wrote', outPath);
}

const sizes = [
  [1000, 1250],
  [1200, 900],
  [1100, 1100],
  [900, 1300],
];

const jobs = [];

// 8 artworks
for (let i = 1; i <= 8; i++) {
  const [w, h] = sizes[i % sizes.length];
  jobs.push(write(composition(i, w, h), join(root, `src/assets/artworks/artwork-${String(i).padStart(2, '0')}.jpg`), w, h));
}

// 2 collection covers
jobs.push(write(composition(5, 1200, 800), join(root, 'src/assets/collections/series-forms.jpg'), 1200, 800));
jobs.push(write(composition(6, 1200, 800), join(root, 'src/assets/collections/series-color.jpg'), 1200, 800));

// portrait + OG
jobs.push(write(composition(2, 800, 1000), join(root, 'src/assets/site/portrait.jpg'), 800, 1000));
jobs.push(write(composition(0, 1200, 630), join(root, 'public/assets/og-default.jpg'), 1200, 630));

await Promise.all(jobs);
console.log('Done generating placeholders.');
