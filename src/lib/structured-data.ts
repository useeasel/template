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

export interface LdExhibition {
  title: string;
  startDate: string; // YYYY-MM-DD
  endDate?: string;
  venue?: string;
  location?: string;
  url?: string;
  description?: string;
}

/** An exhibition as a schema.org ExhibitionEvent, for show rich results. */
export function eventLd(x: LdExhibition, artist: { name: string }): Record<string, unknown> {
  const place = x.venue || x.location
    ? prune({
        '@type': 'Place',
        name: x.venue || x.location,
        address: x.venue && x.location ? x.location : undefined,
      })
    : undefined;
  return prune({
    '@context': 'https://schema.org',
    '@type': 'ExhibitionEvent',
    name: x.title,
    startDate: x.startDate || undefined,
    endDate: x.endDate || undefined,
    url: x.url,
    description: x.description,
    location: place,
    performer: { '@type': 'Person', name: artist.name },
    organizer: x.venue ? { '@type': 'Organization', name: x.venue } : undefined,
  });
}

export interface LdArticle {
  title: string;
  url: string; // absolute
  datePublished: string; // YYYY-MM-DD
  description?: string;
  imageUrl?: string; // absolute
}

/** A news post as a BlogPosting, so updates can surface as fresh content. */
export function articleLd(a: LdArticle, author: { name: string; url: string }): Record<string, unknown> {
  return prune({
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: a.title,
    url: a.url,
    mainEntityOfPage: a.url,
    datePublished: a.datePublished || undefined,
    description: a.description,
    image: a.imageUrl,
    author: { '@type': 'Person', name: author.name, url: author.url },
  });
}

export interface LdProject {
  title: string;
  url: string; // absolute
  description?: string;
  imageUrl?: string; // absolute
  year?: string;
  keywords?: string[];
}

/** A project / case study as a CreativeWork, for portfolio rich results. */
export function creativeWorkLd(p: LdProject, author: { name: string; url: string }): Record<string, unknown> {
  return prune({
    '@context': 'https://schema.org',
    '@type': 'CreativeWork',
    name: p.title,
    url: p.url,
    mainEntityOfPage: p.url,
    description: p.description,
    image: p.imageUrl,
    dateCreated: p.year || undefined,
    keywords: p.keywords && p.keywords.length ? p.keywords.join(', ') : undefined,
    creator: { '@type': 'Person', name: author.name, url: author.url },
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
