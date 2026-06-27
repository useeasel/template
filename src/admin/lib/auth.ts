/**
 * GitHub sign-in for the Easel editor. Reuses the shared easel-sveltia-auth relay
 * (a Cloudflare Worker), but delivers the token over a SAME-ORIGIN channel:
 *   1. We open the relay's /auth in a popup, telling it where to send us back.
 *   2. The popup finishes OAuth on the relay, which 302-redirects it back to THIS
 *      origin at /admin/#easel_token=<token>.
 *   3. A tiny inline handler on /admin (see src/pages/admin/index.astro) reads that
 *      fragment, stores the token, and broadcasts it to us over BroadcastChannel +
 *      a localStorage `storage` event, then closes itself.
 *   4. We receive it here and resolve.
 *
 * Why not cross-origin window.opener.postMessage (the old approach): the popup and
 * the editor are on different origins, and browsers wall off cross-origin
 * `window.opener` for OAuth popups — Firefox (state partitioning) and Safari/WebKit
 * (anti-tracking) — so the token got stranded in the popup ("stuck on Completing
 * sign-in…"). Same-origin localStorage/BroadcastChannel is first-party everywhere.
 *
 * The token is kept in localStorage so the artist stays signed in.
 */

const TOKEN_KEY = 'easel_gh_token';
/** Same-origin channels the popup-landing handler uses to hand us the result. */
export const AUTH_CHANNEL = 'easel-auth';
export const AUTH_SIGNAL_KEY = 'easel_auth_event';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}
export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

type AuthResult = { kind: 'success'; token: string } | { kind: 'error'; message: string };

export function signIn(authBaseUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const base = authBaseUrl.replace(/\/$/, '');
    // site_id gates which origin may receive the token (the relay verifies it); redirect_uri
    // tells the relay exactly where to send the popup back — our own origin + path, so it
    // works at the root (Netlify, github.io user pages) and under a base path alike.
    const url =
      `${base}/auth?provider=github&scope=public_repo` +
      `&site_id=${encodeURIComponent(location.host)}` +
      `&redirect_uri=${encodeURIComponent(location.origin + location.pathname)}`;

    const w = 720;
    const h = 760;
    const left = window.screenX + (window.outerWidth - w) / 2;
    const top = window.screenY + (window.outerHeight - h) / 2;
    const popup = window.open(
      url,
      'easel-auth',
      `width=${w},height=${h},left=${left},top=${top}`,
    );
    if (!popup) {
      reject(new Error('Pop-up blocked. Please allow pop-ups and try again.'));
      return;
    }

    // If a stale token is sitting in storage, only count a NEW one as success (see poll).
    const tokenBefore = getToken();
    let done = false;

    const handle = (result: AuthResult | null) => {
      if (done || !result) return;
      if (result.kind === 'success' && result.token) {
        finish();
        setToken(result.token);
        resolve(result.token);
      } else if (result.kind === 'error') {
        finish();
        reject(new Error(result.message || 'Sign-in failed.'));
      }
    };

    // Belt and braces: either channel alone is enough, but a BroadcastChannel message can be
    // missed if it races us, and `storage` doesn't fire in some embedded contexts.
    const channel = 'BroadcastChannel' in window ? new BroadcastChannel(AUTH_CHANNEL) : null;
    if (channel) channel.onmessage = (e) => handle(e.data as AuthResult);

    const onStorage = (e: StorageEvent) => {
      if (e.key !== AUTH_SIGNAL_KEY || !e.newValue) return;
      try {
        handle(JSON.parse(e.newValue) as AuthResult);
      } catch {
        /* ignore malformed signal */
      }
    };
    window.addEventListener('storage', onStorage);

    const poll = window.setInterval(() => {
      if (popup.closed && !done) {
        // The popup may have stored the token a beat before closing and we missed the live
        // event; treat a freshly-changed token as success, otherwise it was cancelled.
        const stored = getToken();
        finish();
        if (stored && stored !== tokenBefore) resolve(stored);
        else reject(new Error('Sign-in was cancelled.'));
      }
    }, 500);

    // Backstop: never hang forever. If the popup never makes it back (blocked, slow, or the
    // artist wandered off), fail with a clear, retryable error instead of an open popup.
    const timeout = window.setTimeout(() => {
      if (!done) {
        finish();
        reject(
          new Error(
            'Sign-in is taking too long — your connection may be slow. Please close the pop-up and try again.',
          ),
        );
      }
    }, 120_000);

    function finish() {
      done = true;
      window.clearInterval(poll);
      window.clearTimeout(timeout);
      window.removeEventListener('storage', onStorage);
      if (channel) channel.close();
      try {
        popup && popup.close();
      } catch {
        /* ignore */
      }
    }
  });
}
