/**
 * Normalize a YouTube/Vimeo share URL into an embeddable iframe src. We don't host
 * video (that's outside Easel's "host nothing" model) — artists paste a link and we
 * render the provider's player. Returns null for anything we don't recognize.
 */
export function toEmbedSrc(url: string): string | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\./, '');

  // YouTube: watch?v=ID, youtu.be/ID, /embed/ID, /shorts/ID
  if (host === 'youtube.com' || host === 'm.youtube.com') {
    const id = u.searchParams.get('v') ?? u.pathname.match(/\/(embed|shorts)\/([\w-]+)/)?.[2];
    return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
  }
  if (host === 'youtu.be') {
    const id = u.pathname.slice(1);
    return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
  }

  // Vimeo: vimeo.com/ID or player.vimeo.com/video/ID
  if (host === 'vimeo.com') {
    const id = u.pathname.split('/').filter(Boolean)[0];
    return /^\d+$/.test(id ?? '') ? `https://player.vimeo.com/video/${id}` : null;
  }
  if (host === 'player.vimeo.com') {
    return url; // already an embed URL
  }

  return null;
}
