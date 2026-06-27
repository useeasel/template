/**
 * Backup & restore — a full copy of the artist's content, made and re-applied
 * entirely in the browser. A backup is a ZIP of everything the artist owns (their
 * pages, artwork files, and settings); a restore reads that ZIP and commits it
 * back. Both stay within the content prefixes, so template code and the deploy
 * workflow are never touched. Nothing leaves the artist's machine except the
 * commit they choose to push.
 */
import type { GitHub, FileChange } from './github';

// The artist's own files — same set the editor preserves across template updates.
const PREFIXES = ['src/content/', 'src/assets/', 'public/assets/'];
const inScope = (p: string) => PREFIXES.some((x) => p.startsWith(x));

/** Build a ZIP of all the artist's content and return it as a Blob to download. */
export async function buildBackup(gh: GitHub): Promise<Blob> {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  const tree = (await gh.treeRecursive()).filter((t) => inScope(t.path));
  for (const entry of tree) {
    const base64 = await gh.getBlobBase64(entry.sha);
    zip.file(entry.path, base64, { base64: true });
  }
  return zip.generateAsync({ type: 'blob' });
}

/**
 * Restore a backup ZIP: commit every content file it holds back to the site in a
 * single commit. Files outside the content prefixes are ignored, so a tampered or
 * mismatched ZIP can't overwrite template code. Returns the number of files written.
 */
export async function restoreBackup(gh: GitHub, file: File): Promise<number> {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const changes: FileChange[] = [];
  for (const [path, entry] of Object.entries(zip.files)) {
    if (entry.dir || !inScope(path)) continue;
    changes.push({ path, content: await entry.async('base64'), encoding: 'base64' });
  }
  if (!changes.length) {
    throw new Error("That file doesn't look like an Easel backup.");
  }
  await gh.commit(changes, 'Restore from backup');
  return changes.length;
}
