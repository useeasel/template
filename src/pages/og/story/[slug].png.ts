import type { APIContext, GetStaticPaths } from 'astro';
import { getCollection, getEntry } from 'astro:content';
import { stripMd } from '../../../lib/href';
import { renderShareCard, getCardColors, pngResponse, type CardColors } from '../../../lib/og';

// A 9:16 "story" share card per artwork, built statically — a branded image the
// artist can download and post to an Instagram/TikTok story. The work page links
// to it. (Work pages keep the actual artwork as their OpenGraph link-preview
// image; this is a separate, downloadable asset.)

export const getStaticPaths = (async () => {
  const settings = (await getEntry('site', 'settings'))!.data;
  const name = settings.logoText || settings.siteTitle;
  const colors = getCardColors(settings);

  return (await getCollection('artworks')).map((a) => ({
    params: { slug: stripMd(a.id) },
    props: {
      title: a.data.title,
      subtitle: [a.data.year, name].filter(Boolean).join(' · '),
      colors,
    },
  }));
}) satisfies GetStaticPaths;

export const GET = async ({ props }: APIContext) => {
  const { title, subtitle, colors } = props as { title: string; subtitle: string; colors: CardColors };
  return pngResponse(await renderShareCard({ title, subtitle, colors, format: 'story' }));
};
