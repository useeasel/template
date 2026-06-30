import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { readdir } from 'node:fs/promises';
import { availableParallelism } from 'node:os';
import { join, extname } from 'node:path';

/** Run `fn` over `items` with at most `limit` in flight (parallelize sharp work). */
async function mapPool(items, limit, fn) {
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

// Build-time half of the AI-scraper shield. When the artist turns on
// `protectFromAI`, this stamps a "do not train" rights note into the rights /
// copyright EXIF fields of every raster image in the final build, so the
// preference travels with the file even if it is downloaded or re-hosted.
//
// It is deliberately defensive: it reads the setting from settings.json, skips
// entirely when off, and processes each image in its own try/catch so a single
// unreadable or unsupported file can never fail the build (the same forgiving
// posture as the `|| true` on the Pagefind step).
//
// Interaction with Glaze/Nightshade-protected pieces (B2b): those images are
// served as untouched originals on the page (no astro:assets transform). This
// EXIF stamp re-saves images, which is lossless for PNG (pixels preserved) but
// re-encodes lossy formats. Glaze/Nightshade tolerate mild re-encoding, but the
// fuller guarantee — never touching a protected file's bytes even with the AI
// shield on — is a follow-up (would need a build-time exclude list of protected
// originals). The page-level promise (originals shown untransformed) holds today.

const RIGHTS_NOTE =
  'Do not use for AI or machine-learning training. No AI. (noai, noimageai)';

const RASTER = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif', '.tiff', '.gif']);

async function* walk(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) yield* walk(full);
    else yield full;
  }
}

export default function aiProtect() {
  return {
    name: 'gesso-ai-protect',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const srcDir = fileURLToPath(new URL('../content/site/', import.meta.url));
        let on = false;
        let owner = 'the site owner';
        try {
          const raw = await readFile(join(srcDir, 'settings.json'), 'utf8');
          const cfg = JSON.parse(raw);
          on = !!cfg.protectFromAI;
          owner = cfg.logoText || cfg.siteTitle || owner;
        } catch {
          /* no settings or unreadable — treat as off */
        }
        if (!on) return;

        const root = fileURLToPath(dir);

        // ai.txt — an emerging convention (spawning.ai) for stating AI usage terms
        // apart from robots.txt. Written only when the shield is on, so sites that
        // never opted in carry no such file.
        try {
          const aiTxt = [
            '# ai.txt — AI usage policy',
            `# The work on this site belongs to ${owner}.`,
            '',
            'User-Agent: *',
            'Disallow: /',
            '',
            '# No part of this site may be used to train, fine-tune, or otherwise',
            '# develop AI or machine-learning models without explicit written permission.',
            'Disallow-AI-Training: /',
            'Disallow-Generative-AI: /',
          ].join('\n');
          await writeFile(join(root, 'ai.txt'), aiTxt + '\n');
        } catch {
          /* best-effort */
        }

        // Sharp is already a dependency (the astro:assets image service uses it).
        let sharp;
        try {
          sharp = (await import('sharp')).default;
        } catch {
          logger.warn('AI shield: sharp unavailable, skipping image rights tags.');
          return;
        }

        // Collect first, then stamp in parallel: image re-encoding is CPU-bound, so
        // a bounded pool across cores is far faster than one-at-a-time on big sites.
        const files = [];
        for await (const file of walk(root)) {
          if (RASTER.has(extname(file).toLowerCase())) files.push(file);
        }

        let tagged = 0;
        await mapPool(files, Math.max(2, availableParallelism()), async (file) => {
          try {
            const buf = await readFile(file);
            const out = await sharp(buf)
              .withExifMerge({
                IFD0: { Copyright: RIGHTS_NOTE, ImageDescription: RIGHTS_NOTE },
              })
              .toBuffer();
            await writeFile(file, out);
            tagged++;
          } catch {
            /* unsupported/corrupt image — leave it untouched, never fail the build */
          }
        });
        logger.info(`AI shield: tagged ${tagged} image(s) "do not train".`);
      },
    },
  };
}
