/**
 * Host + form configuration, read at build time from the admin config that the
 * Easel provisioner patches (public/admin/config.json).
 *
 * `host` is where the site is published ('netlify' | 'github-pages'); `formEndpoint`
 * is where the contact/newsletter forms POST. Netlify sites leave it empty and use
 * native Netlify Forms; hosts without a forms backend (GitHub Pages) get a FormSubmit
 * endpoint keyed to the artist's email. Defaults keep local/dev builds on Netlify.
 */
import adminConfig from '../../public/admin/config.json';

export interface HostConfig {
  host: 'netlify' | 'github-pages';
  formEndpoint: string;
  /** True when forms should use native Netlify Forms (no external endpoint). */
  useNetlifyForms: boolean;
}

export function hostConfig(): HostConfig {
  const cfg = adminConfig as { host?: string; formEndpoint?: string };
  const host = cfg.host === 'github-pages' ? 'github-pages' : 'netlify';
  const formEndpoint = cfg.formEndpoint ?? '';
  return { host, formEndpoint, useNetlifyForms: host === 'netlify' && !formEndpoint };
}
