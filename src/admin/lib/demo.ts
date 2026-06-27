/**
 * Demo backend for the Easel editor. Implements the same surface as the GitHub
 * client but entirely in-memory, seeded with sample content, so the whole UI can
 * be explored on localhost without signing in or touching a repo. Changes are
 * kept in memory only (a banner makes that clear).
 */
import type { GitHub, DirEntry, RepoRef, TreeEntry } from './github';
import { shapeImage } from './filler';

function md(data: Record<string, string | number | boolean>, body = ''): string {
  const fm = Object.entries(data)
    .map(([k, v]) => `${k}: ${typeof v === 'string' ? JSON.stringify(v) : v}`)
    .join('\n');
  return `---\n${fm}\n---\n${body ? `\n${body}\n` : '\n'}`;
}

function seed(): Map<string, string> {
  const f = new Map<string, string>();
  const arts = [
    { t: 'Composition in Blue', y: 2024, s: 'available', p: '$1,800' },
    { t: 'Red Square Study', y: 2024, s: 'sold' },
    { t: 'Yellow Triangle', y: 2023, s: 'inquire' },
    { t: 'Quiet Geometry', y: 2023, s: 'nfs' },
  ];
  arts.forEach((a, i) => {
    f.set(
      `src/content/artworks/piece-${i + 1}.md`,
      md(
        {
          image: `../../assets/artworks/piece-${i + 1}.jpg`,
          title: a.t,
          year: a.y,
          medium: 'Oil on canvas',
          dimensions: '24 × 30 in',
          status: a.s,
          ...(a.p ? { price: a.p } : {}),
          alt: `${a.t}, an abstract geometric painting`,
          order: i,
          featured: i === 0,
        },
        'A short note about this piece.',
      ),
    );
  });
  f.set('src/content/collections/forms.md', md({ title: 'Forms', description: 'Single geometric forms.', order: 0 }));
  f.set('src/content/collections/color.md', md({ title: 'Color', description: 'Where two colors meet.', order: 1 }));
  f.set('src/content/pages/about.md', md({ title: 'About', statement: 'Painter working in oil and gouache.' }, 'I make work about colour and edge.'));
  f.set('src/content/pages/contact.md', md({ title: 'Contact', intro: "I'd love to hear from you.", email: 'hello@example.com', formEnabled: true }));
  f.set('src/content/pages/cv.md', `---\ntitle: CV\ncv:\n  - heading: Exhibitions\n    items:\n      - year: "2024"\n        text: Solo show, Gallery X\n---\n`);
  f.set('src/content/pages/press.md', `---\ntitle: Press\npress:\n  - outlet: Art Weekly\n    title: A painter to watch\n---\n`);
  f.set(
    'src/content/site/settings.json',
    JSON.stringify(
      {
        siteTitle: 'Studio Demo',
        tagline: 'Paintings and works on paper',
        logoText: 'Demo Artist',
        theme: 'default',
        portfolioLayout: 'grid',
        columns: 3,
        motionDefault: 'full',
        rightClickProtect: false,
        watermark: false,
        socialLinks: [{ label: 'Instagram', url: 'https://instagram.com/example' }],
      },
      null,
      2,
    ),
  );
  return f;
}

class DemoGitHub {
  ref = { owner: 'demo', repo: 'portfolio', branch: 'main' };
  files = seed();

  async getLogin(): Promise<string> {
    return 'demo-artist';
  }
  async listDir(dir: string): Promise<DirEntry[]> {
    const out: DirEntry[] = [];
    for (const path of this.files.keys()) {
      if (path.startsWith(dir + '/') && !path.slice(dir.length + 1).includes('/')) {
        out.push({ name: path.slice(dir.length + 1), path, sha: 'demo', type: 'file' });
      }
    }
    return out;
  }
  async getFile(path: string): Promise<{ text: string; sha: string } | null> {
    const t = this.files.get(path);
    return t != null ? { text: t, sha: 'demo' } : null;
  }
  rawUrl(path: string): string {
    return shapeImage(path);
  }
  // --- Update-check surface (in-memory; the demo is always "up to date"). ---
  async getFileFrom(_over: RepoRef, path: string): Promise<string | null> {
    if (path === 'package.json') return JSON.stringify({ version: '1.0.0' });
    if (path === 'CHANGELOG.md') return '## 1.0.0\n\n- The first release of your Easel site.\n';
    return null;
  }
  async treeRecursive(): Promise<TreeEntry[]> {
    return [];
  }
  async getBlobBase64(): Promise<string> {
    return '';
  }
  async commit(changes: { path: string; content?: string; encoding?: string; remove?: boolean }[]): Promise<void> {
    await new Promise((r) => setTimeout(r, 400)); // feel like a real save
    for (const c of changes) {
      if (c.remove) this.files.delete(c.path);
      else this.files.set(c.path, c.encoding === 'base64' ? '[demo image]' : c.content ?? '');
    }
  }
}

export function makeDemoClient(): GitHub {
  return new DemoGitHub() as unknown as GitHub;
}
