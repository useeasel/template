/**
 * Client-side reader for an Instagram "Download Your Information" export (the JSON
 * format, downloaded as a .zip). We never talk to Instagram's API — there is no
 * live scraping here; the artist requests their own archive from Instagram, and we
 * read it entirely in the browser. Each post becomes a draft ready for the bulk
 * review queue (caption → title + description, post date → year).
 *
 * Export shapes vary by Instagram version, so this is deliberately forgiving: it
 * scans for any images and any posts JSON, and falls back to filenames when a
 * caption or date is missing. A folder of plain photos works too via the normal
 * multi-file picker, so this is the convenience path, not the only one.
 */

export interface ImportedItem {
  file: File;
  title: string;
  alt: string;
  year?: number;
}

const IMG_RE = /\.(jpe?g|png|webp|gif|heic)$/i;
// Posts live in files like content/posts_1.json, your_instagram_activity/media/
// posts_1.json, etc. Match the family without pinning one layout.
const POSTS_JSON_RE = /posts.*\.json$/i;

/**
 * Instagram double-encodes UTF-8 as Latin-1 in these JSONs ("é" → "Ã©"). Undo it,
 * but conservatively: only when every character is a single byte (so it could be
 * mis-decoded UTF-8) AND the reinterpretation is itself valid UTF-8. A caption
 * that is already clean (or holds real multi-byte characters) is left untouched.
 */
function fixMojibake(s: string): string {
  if (!s || ![...s].every((c) => c.charCodeAt(0) <= 0xff)) return s;
  try {
    const bytes = Uint8Array.from(Array.from(s, (c) => c.charCodeAt(0) & 0xff));
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return s; // not valid UTF-8 when reinterpreted — it was already fine
  }
}

/** First non-empty line of a caption, trimmed to a sensible title length. */
function titleFromCaption(caption: string): string {
  const first = caption.split('\n').map((l) => l.trim()).find(Boolean) ?? '';
  return first.length > 80 ? `${first.slice(0, 77).trimEnd()}…` : first;
}

function titleFromPath(path: string): string {
  const base = path.split('/').pop() ?? path;
  return (
    base
      .replace(/\.[^.]+$/, '')
      .replace(/[-_]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, (c) => c.toUpperCase()) || 'Untitled'
  );
}

function yearFromTimestamp(ts: unknown): number | undefined {
  const n = typeof ts === 'number' ? ts : Number(ts);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  // Instagram uses seconds; guard against accidental milliseconds.
  const ms = n > 1e12 ? n : n * 1000;
  const y = new Date(ms).getFullYear();
  return y >= 1990 && y <= 2100 ? y : undefined;
}

type PostMeta = { caption: string; year?: number };

/** Walk whatever posts JSON shape we were handed, mapping media uri → metadata. */
function collectPostMeta(json: any, into: Map<string, PostMeta>): void {
  // Top level is usually an array of posts, but some exports wrap it.
  const posts: any[] = Array.isArray(json) ? json : json?.posts ?? json?.media ?? [];
  for (const post of posts) {
    if (!post || typeof post !== 'object') continue;
    const postCaption = typeof post.title === 'string' ? fixMojibake(post.title) : '';
    const postYear = yearFromTimestamp(post.creation_timestamp);
    const media: any[] = Array.isArray(post.media) ? post.media : post.uri ? [post] : [];
    for (const m of media) {
      const uri: string | undefined = typeof m?.uri === 'string' ? m.uri : undefined;
      if (!uri) continue;
      const caption = (typeof m.title === 'string' && m.title ? fixMojibake(m.title) : postCaption) || '';
      const year = yearFromTimestamp(m.creation_timestamp) ?? postYear;
      // Match on the basename so path-prefix differences don't matter.
      into.set(uri.split('/').pop()!, { caption, year });
    }
  }
}

export async function parseInstagramExport(zipFile: File): Promise<ImportedItem[]> {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(await zipFile.arrayBuffer());

  // Pass 1: gather caption/date metadata from every posts JSON we can find.
  const meta = new Map<string, PostMeta>();
  const jsonEntries = Object.values(zip.files).filter(
    (f) => !f.dir && POSTS_JSON_RE.test(f.name),
  );
  for (const entry of jsonEntries) {
    try {
      collectPostMeta(JSON.parse(await entry.async('string')), meta);
    } catch {
      /* skip an unreadable JSON; images still import */
    }
  }

  // Pass 2: turn each image into a draft, enriched by metadata when we have it.
  const imageEntries = Object.values(zip.files)
    .filter((f) => !f.dir && IMG_RE.test(f.name))
    .sort((a, b) => a.name.localeCompare(b.name));

  const items: ImportedItem[] = [];
  for (const entry of imageEntries) {
    const blob = await entry.async('blob');
    const base = entry.name.split('/').pop() ?? entry.name;
    const file = new File([blob], base, { type: blob.type || 'image/jpeg' });
    const m = meta.get(base);
    const caption = m?.caption ?? '';
    items.push({
      file,
      title: caption ? titleFromCaption(caption) : titleFromPath(entry.name),
      alt: caption,
      year: m?.year,
    });
  }
  return items;
}
