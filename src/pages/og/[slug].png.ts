import type { APIContext, GetStaticPaths } from 'astro';
import { getCollection, getEntry } from 'astro:content';
import { stripMd } from '../../lib/href';
import { renderShareCard, getCardColors, pngResponse, type CardColors } from '../../lib/og';

// One branded share card per shareable page, built statically. Pages reference
// their card via pageImage={withBase('/og/<slug>.png')} (see SEO.astro). Work pages
// deliberately keep the actual artwork as their share image instead of a card.

export const getStaticPaths = (async () => {
  const settings = (await getEntry('site', 'settings'))!.data;
  const name = settings.logoText || settings.siteTitle;
  const colors = getCardColors(settings);

  const card = (slug: string, title: string, subtitle: string) => ({
    params: { slug },
    props: { title, subtitle, colors },
  });

  const cards = [
    card('home', settings.siteTitle, settings.tagline || name),
    card('about', name, settings.tagline || 'Portfolio'),
    card('news', 'News', name),
    card('projects', 'Projects', name),
    card('exhibitions', 'Exhibitions', name),
    card('available', 'Available work', name),
    card('links', name, settings.tagline || 'Links'),
    card('press-kit', 'Press kit', name),
  ];
  for (const s of await getCollection('collections')) {
    cards.push(card(`series-${stripMd(s.id)}`, s.data.title, name));
  }
  for (const p of (await getCollection('posts')).filter((p) => !p.data.draft)) {
    cards.push(card(`post-${stripMd(p.id)}`, p.data.title, name));
  }
  for (const p of (await getCollection('projects')).filter((p) => !p.data.draft)) {
    cards.push(card(`project-${stripMd(p.id)}`, p.data.title, name));
  }
  return cards;
}) satisfies GetStaticPaths;

export const GET = async ({ props }: APIContext) => {
  const { title, subtitle, colors } = props as { title: string; subtitle: string; colors: CardColors };
  return pngResponse(await renderShareCard({ title, subtitle, colors }));
};
