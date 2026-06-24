/**
 * SEO helpers — builds title / description / canonical / OpenGraph values from
 * site settings plus per-page overrides.
 */

export interface SeoInput {
  siteTitle: string;
  metaDescription?: string;
  ogImage?: string;
  pageTitle?: string;
  pageDescription?: string;
  pageImage?: string;
  /** The current page URL (Astro.url). */
  url: URL;
  /** The configured site origin (Astro.site). */
  site?: URL;
}

export interface SeoData {
  title: string;
  description: string;
  canonical: string;
  ogImage?: string;
  ogType: string;
}

export function buildSeo(input: SeoInput): SeoData {
  const title = input.pageTitle
    ? `${input.pageTitle} — ${input.siteTitle}`
    : input.siteTitle;

  const description =
    input.pageDescription ?? input.metaDescription ?? input.siteTitle;

  const canonical = new URL(input.url.pathname, input.site ?? input.url).href;

  const rawImage = input.pageImage ?? input.ogImage;
  const ogImage = rawImage
    ? new URL(rawImage, input.site ?? input.url).href
    : undefined;

  return {
    title,
    description,
    canonical,
    ogImage,
    ogType: input.pageTitle ? 'article' : 'website',
  };
}
