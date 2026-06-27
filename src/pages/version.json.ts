import type { APIRoute } from 'astro';
import { BUILD_ID } from '../lib/version';

// A tiny build stamp. The client fetches this with `cache: 'no-store'` (see
// Base.astro) to detect when a newer build has gone live and refresh itself —
// which is how an edit shows up without the visitor doing a hard refresh.
export const GET: APIRoute = () =>
  new Response(JSON.stringify({ v: BUILD_ID }), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
