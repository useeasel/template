/**
 * Tiny motion helper. The source of truth for "should we animate" is:
 *   1. OS `prefers-reduced-motion` (always wins when set to reduce), then
 *   2. the in-UI motion toggle, persisted to localStorage and reflected as
 *      `data-motion="full|reduced"` on <html>.
 *
 * CSS in tokens.css reads both signals; this script just manages the toggle and
 * keeps the attribute in sync. It is written as a string-injectable module so it
 * can run inline early (avoiding a flash) and as a regular import for the toggle.
 */

const STORAGE_KEY = 'ez-motion';

export type MotionPref = 'full' | 'reduced';

export function prefersReducedMotionOS(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** Resolve the effective preference: OS reduce always wins. */
export function effectiveMotion(stored: MotionPref | null, fallback: MotionPref): MotionPref {
  if (prefersReducedMotionOS()) return 'reduced';
  return stored ?? fallback;
}

export function getStored(): MotionPref | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'full' || v === 'reduced' ? v : null;
  } catch {
    return null;
  }
}

export function setMotion(pref: MotionPref): void {
  try {
    localStorage.setItem(STORAGE_KEY, pref);
  } catch {
    /* ignore */
  }
  apply(pref);
}

export function apply(pref: MotionPref): void {
  document.documentElement.setAttribute('data-motion', pref);
}

/** Initialize on load using a settings-provided default. */
export function initMotion(defaultPref: MotionPref): MotionPref {
  const pref = effectiveMotion(getStored(), defaultPref);
  apply(pref);
  return pref;
}
