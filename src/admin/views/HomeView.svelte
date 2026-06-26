<script lang="ts">
  import type { GitHub } from '../lib/github';
  import { loadArtworks, loadSeries, loadPosts } from '../lib/store';
  import type { NavId } from '../Sidebar.svelte';

  let {
    gh,
    go,
    siteUrl = '/',
    designEmpty = false,
    onWizard,
  }: {
    gh: GitHub;
    go: (view: NavId, tab?: string) => void;
    siteUrl?: string;
    designEmpty?: boolean;
    onWizard: () => void;
  } = $props();

  let counts = $state<{ art: number; series: number; posts: number } | null>(null);

  async function load() {
    try {
      const [a, s, p] = await Promise.all([loadArtworks(gh), loadSeries(gh), loadPosts(gh)]);
      counts = { art: a.length, series: s.length, posts: p.length };
    } catch {
      counts = { art: 0, series: 0, posts: 0 };
    }
  }
  load();

  const n = (v: number | undefined) => (v === undefined ? '—' : String(v));
  const isEmpty = $derived(counts !== null && counts.art === 0);
</script>

<div class="ez-home">
  {#if designEmpty}
    <div class="ez-callout ez-callout--accent">
      <div>
        <strong>Finish setting up your style</strong>
        <p class="ez-help">Pick fonts, colours, and a layout in about a minute. You can change anything later.</p>
      </div>
      <button class="ez-btn ez-btn--primary ez-btn--depth" onclick={onWizard}>Open the style wizard</button>
    </div>
  {/if}

  {#if isEmpty}
    <div class="ez-callout ez-callout--blue">
      <div>
        <strong>Let's add your first piece</strong>
        <p>Upload a photo of your work — that's all it takes to get your portfolio going.</p>
      </div>
      <button class="ez-btn ez-btn--accent ez-btn--depth" onclick={() => go('work', 'artwork')}>Add artwork</button>
    </div>
  {/if}

  <section>
    <h2 class="ez-home__h">Your site at a glance</h2>
    <div class="ez-statgrid">
      <button class="ez-stat" onclick={() => go('work', 'artwork')}>
        <span class="ez-stat__num">{n(counts?.art)}</span>
        <span class="ez-stat__label">artworks</span>
      </button>
      <button class="ez-stat" onclick={() => go('work', 'series')}>
        <span class="ez-stat__num">{n(counts?.series)}</span>
        <span class="ez-stat__label">series</span>
      </button>
      <button class="ez-stat" onclick={() => go('pages', 'news')}>
        <span class="ez-stat__num">{n(counts?.posts)}</span>
        <span class="ez-stat__label">posts</span>
      </button>
    </div>
  </section>

  <section>
    <h2 class="ez-home__h">Quick actions</h2>
    <div class="ez-quickgrid">
      <button class="ez-quick" onclick={() => go('work', 'artwork')}>
        <span class="ez-shape ez-shape--square"></span>
        <span><strong>Add artwork</strong><span class="ez-help">Upload new work</span></span>
      </button>
      <button class="ez-quick" onclick={() => go('pages', 'news')}>
        <span class="ez-shape ez-shape--circle"></span>
        <span><strong>Write a post</strong><span class="ez-help">Share an update</span></span>
      </button>
      <button class="ez-quick" onclick={() => go('pages', 'about')}>
        <span class="ez-shape ez-shape--triangle"></span>
        <span><strong>Edit your About</strong><span class="ez-help">Tell your story</span></span>
      </button>
      <button class="ez-quick" onclick={() => go('design')}>
        <span class="ez-shape ez-shape--square" style="background:var(--ez-blue)"></span>
        <span><strong>Change your look</strong><span class="ez-help">Fonts & colours</span></span>
      </button>
    </div>
  </section>

  <p class="ez-help">
    Want to see the live result? <a href={siteUrl} target="_blank" rel="noopener">View your site ↗</a>
    Edits go live a minute or so after you save.
  </p>
</div>
