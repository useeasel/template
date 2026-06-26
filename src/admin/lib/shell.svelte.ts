/**
 * Editor "shell" — the single source of truth the chrome (sidebar, section bar,
 * status chip, unsaved-changes dialog) shares with whichever section view is on
 * screen. The root (Editor.svelte) creates one and hands it down via context so
 * views can register their save/dirty behaviour without prop-drilling.
 *
 * Why a store and not just callbacks like `notify`: the relationship is
 * bidirectional. The shell must *pull* "are you dirty?" and *call* "save now" on
 * the active view (for the section-bar Save button and the navigation guard),
 * which a one-way prop can't express.
 */
import { getContext, setContext } from 'svelte';

export type PublishState = 'idle' | 'saving' | 'publishing' | 'live' | 'error';

/** What a deploy probe reports for the most recent push. */
export type DeployState = 'building' | 'live' | 'error' | 'unknown';

export interface SectionRegistration {
  /** True when the section has edits that aren't committed yet. */
  isDirty: () => boolean;
  /** Persist the section. Resolve true on success, false on a handled failure. */
  save: () => Promise<boolean>;
  /** Throw away in-memory edits (used by the unsaved dialog's "Discard"). */
  discard?: () => void;
  /**
   * Silent sections take part in the unsaved-changes guard but do NOT surface a
   * Save button in the section bar — used by full-screen sub-forms that carry
   * their own Save/Cancel footer (artwork form, post editor, series editor).
   */
  silent?: boolean;
}

type Notify = (msg: string, kind?: 'info' | 'error') => void;

const KEY = Symbol('easel-shell');

export function createShell(notify: Notify, opts: { demo?: boolean } = {}) {
  // The publishing window: how long we optimistically say "your site is
  // updating" after a successful commit. Demo commits are instant, so we keep it
  // short there just to let the chip visibly cycle back to "live".
  let publishMs = opts.demo ? 2500 : 75000;

  // $state.raw: we only ever reassign `active` (never mutate its fields), and we
  // compare it by identity in the unregister cleanup — a deep proxy would break
  // that `===` check (proxy vs. the raw object the caller holds).
  let active = $state.raw<SectionRegistration | null>(null);
  let saving = $state(false);
  let publishState = $state<PublishState>('idle');
  let pendingNav = $state<(() => void) | null>(null);
  let publishTimer: ReturnType<typeof setTimeout> | undefined;

  // Optional real-deploy probe (set once the GitHub client exists). When present,
  // the publishing chip tracks the actual build instead of a blind timer.
  let probe: (() => Promise<DeployState>) | null = null;
  // Bumped on every publish so an in-flight poll from an earlier save bails the
  // moment a newer save supersedes it.
  let publishSeq = 0;

  function beginPublishing() {
    publishState = 'publishing';
    clearTimeout(publishTimer);
    const seq = ++publishSeq;

    // No probe (demo, or before the client is wired): keep the simple optimistic
    // timer — we can't know the real build state.
    if (!probe) {
      publishTimer = setTimeout(() => {
        if (seq === publishSeq) publishState = 'live';
      }, publishMs);
      return;
    }

    // Poll the real deploy until it's live/failed, or until publishMs elapses — at
    // which point we optimistically call it live rather than spin forever (the
    // host may simply not report status; see GitHub.deployState).
    const deadline = Date.now() + publishMs;
    const tick = async () => {
      if (seq !== publishSeq) return; // superseded by a newer save
      let state: DeployState = 'unknown';
      try {
        state = await probe!();
      } catch {
        /* network blip — treat as still-unknown and keep waiting */
      }
      if (seq !== publishSeq) return;
      if (state === 'live') return void (publishState = 'live');
      if (state === 'error') return void (publishState = 'error');
      if (Date.now() >= deadline) return void (publishState = 'live');
      publishTimer = setTimeout(tick, 4000);
    };
    publishTimer = setTimeout(tick, 4000);
  }

  async function runSave(): Promise<boolean> {
    if (!active) return true;
    saving = true;
    publishState = 'saving';
    try {
      const ok = await active.save();
      saving = false;
      if (ok) {
        beginPublishing();
        return true;
      }
      publishState = 'error';
      return false;
    } catch (e) {
      saving = false;
      publishState = 'error';
      notify(e instanceof Error ? e.message : 'Could not save.', 'error');
      return false;
    }
  }

  const shell = {
    notify,

    /** Switch to the short demo publishing window (demo mode is detected late). */
    demoTiming() {
      publishMs = 2500;
    },

    /**
     * Wire a real-deploy probe (returns the live build state for the most recent
     * push). Once set, the publishing chip reflects the actual deploy instead of a
     * fixed timer. Safe to leave unset — the timer is the fallback.
     */
    setProbe(fn: () => Promise<DeployState>) {
      probe = fn;
    },

    /** A view registers its behaviour; the returned fn unregisters it. */
    register(reg: SectionRegistration): () => void {
      active = reg;
      return () => {
        if (active === reg) active = null;
      };
    },

    get dirty() {
      return active?.isDirty() ?? false;
    },
    /** Whether the section bar should show a Save button. */
    get canSave() {
      return !!active && !active.silent;
    },
    get saving() {
      return saving;
    },
    get publishState() {
      return publishState;
    },
    get hasPendingNav() {
      return pendingNav !== null;
    },

    /** Section-bar Save: persist the active section in place. */
    save: runSave,

    /**
     * Mark that something was committed outside the section-bar flow (a sub-form
     * save, a reorder, a delete) so the status chip reflects the rebuild.
     */
    markCommitted() {
      beginPublishing();
    },

    /** Run `nav` now if clean, otherwise hold it and open the unsaved dialog. */
    guard(nav: () => void) {
      if (active?.isDirty()) pendingNav = nav;
      else nav();
    },

    /** Unsaved dialog → Save & continue. */
    async confirmSave() {
      const nav = pendingNav;
      pendingNav = null;
      const ok = await runSave();
      if (ok) nav?.();
    },
    /** Unsaved dialog → Discard. */
    confirmDiscard() {
      const nav = pendingNav;
      pendingNav = null;
      active?.discard?.();
      nav?.();
    },
    /** Unsaved dialog → Cancel. */
    cancelNav() {
      pendingNav = null;
    },
  };

  return shell;
}

export type Shell = ReturnType<typeof createShell>;

export function provideShell(shell: Shell) {
  setContext(KEY, shell);
}

export function useShell(): Shell {
  return getContext(KEY) as Shell;
}
