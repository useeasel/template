/**
 * Schema.org JSON-LD builders.
 *
 * These run at build time from the same content the pages already render, so they
 * cost the artist nothing and add the structured-data tier on top of the existing
 * OG/canonical/sitemap basics — getting artworks into image search + rich results.
 *
 * All builders take already-absolute URLs (resolve with `new URL(path, Astro.site)`)
 * so this module stays environment-agnostic and easy to unit-test.
 */

export interface LdArtist {
  name: string;
  url: string; // site origin
  sameAs?: string[]; // social profile URLs
}

/** The artist as a schema.org Person, reused as `creator` across artwork nodes. */
export function personLd(artist: LdArtist): Record<string, unknown> {
  return prune({
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: artist.name,
    url: artist.url,
    sameAs: artist.sameAs && artist.sameAs.length ? artist.sameAs : undefined,
  });
}

/** The site itself as a WebSite node. */
export function websiteLd(opts: {
  name: string;
  url: string;
  description?: string;
  author: string;
}): Record<string, unknown> {
  return prune({
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: opts.name,
    url: opts.url,
    description: opts.description,
    author: { '@type': 'Person', name: opts.author },
  });
}

export interface LdArtwork {
  title: string;
  imageUrl: string; // absolute
  pageUrl: string; // absolute
  year?: number;
  medium?: string;
  description?: string;
  status?: string;
  price?: string;
}

/** A single piece as a VisualArtwork, with an Offer when it's for sale. */
export function visualArtworkLd(
  art: LdArtwork,
  creator: { name: string; url: string },
): Record<string, unknown> {
  const offer =
    art.status === 'available'
      ? prune({
          '@type': 'Offer',
          availability: 'https://schema.org/InStock',
          price: numericPrice(art.price),
          priceCurrency: numericPrice(art.price) ? 'USD' : undefined,
        })
      : art.status === 'sold'
        ? { '@type': 'Offer', availability: 'https://schema.org/SoldOut' }
        : undefined;

  return prune({
    '@context': 'https://schema.org',
    '@type': 'VisualArtwork',
    name: art.title,
    image: art.imageUrl,
    url: art.pageUrl,
    dateCreated: art.year ? String(art.year) : undefined,
    artMedium: art.medium,
    description: art.description,
    creator: { '@type': 'Person', name: creator.name, url: creator.url },
    offers: offer,
  });
}

/** A breadcrumb trail. `items` are [name, absoluteUrl] in order. */
export function breadcrumbLd(items: Array<[string, string]>): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map(([name, url], i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name,
      item: url,
    })),
  };
}

/** Best-effort numeric price from a free-text field like "$1,800" → 1800. */
function numericPrice(price?: string): number | undefined {
  if (!price) return undefined;
  const digits = price.replace(/[^0-9.]/g, '');
  const n = Number.parseFloat(digits);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/** Drop undefined values so emitted JSON-LD stays clean. */
function prune(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
}
