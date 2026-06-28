/**
 * Shared controller for the editor's simple list+edit collection views
 * (Series, News, Exhibitions, Testimonials). Each of those views was a verbatim
 * copy of the same load / open / dirty-track / save / delete wiring around a
 * different entity and form; this holds that wiring once. A view supplies only its
 * store functions, validation, confirm/message strings, and its own markup.
 *
 * The reactive state lives in `$state` class fields so the view can read
 * `c.items` / `c.editing` / `c.loading` / `c.saving` directly and bind to the
 * fields of `c.editing`. The unsaved-changes `$effect` stays in the view (effects
 * must be created during component init), calling back into `isDirty`/`save`/`cancel`.
 */
import type { Shell } from './shell.svelte';

type Notify = (msg: string, kind?: 'info' | 'error') => void;

export interface CrudConfig<T> {
  /** Load all entries (newest/ordered as the store decides). */
  load: () => Promise<T[]>;
  /** Persist one entry; `isNew` is true when it has no id yet. */
  save: (item: T, isNew: boolean) => Promise<unknown>;
  /** Delete one entry. */
  remove: (item: T) => Promise<unknown>;
  /** Return a message to block the save, or null when the entry is valid. */
  validate?: (item: T) => string | null;
  /** The window.confirm() prompt shown before deleting. */
  confirmRemove: (item: T) => string;
  messages: { saved: string; deleted: string; loadError: string };
  /** Optional hook run after a successful save or delete (e.g. refresh a parent). */
  onChange?: () => void;
}

export class CrudController<T extends { id: string }> {
  items = $state<T[]>([]);
  loading = $state(true);
  editing = $state<T | null>(null);
  saving = $state(false);
  #baseline = '';
  #notify: Notify;
  #shell: Shell;
  #cfg: CrudConfig<T>;

  constructor(notify: Notify, shell: Shell, cfg: CrudConfig<T>) {
    this.#notify = notify;
    this.#shell = shell;
    this.#cfg = cfg;
  }

  /** Open an entry (a fresh blank or a copy of an existing one) for editing. */
  open(item: T) {
    this.editing = item;
    this.#baseline = JSON.stringify($state.snapshot(item));
  }

  cancel() {
    this.editing = null;
  }

  isDirty(): boolean {
    return this.editing != null && JSON.stringify($state.snapshot(this.editing)) !== this.#baseline;
  }

  async refresh() {
    this.loading = true;
    try {
      this.items = await this.#cfg.load();
    } catch (e) {
      this.#notify(e instanceof Error ? e.message : this.#cfg.messages.loadError, 'error');
    }
    this.loading = false;
  }

  // Arrow fields so they can be passed as handlers (onclick={c.save}) without
  // losing `this`.
  save = async (): Promise<boolean> => {
    const editing = this.editing;
    if (!editing) return true;
    const err = this.#cfg.validate?.(editing) ?? null;
    if (err) {
      this.#notify(err, 'error');
      return false;
    }
    this.saving = true;
    try {
      await this.#cfg.save($state.snapshot(editing) as T, editing.id === '');
      this.#shell.markCommitted();
      this.#notify(this.#cfg.messages.saved);
      this.editing = null;
      await this.refresh();
      this.#cfg.onChange?.();
      this.saving = false;
      return true;
    } catch (e) {
      this.#notify(e instanceof Error ? e.message : 'Could not save.', 'error');
      this.saving = false;
      return false;
    }
  };

  remove = async (item: T): Promise<void> => {
    if (!confirm(this.#cfg.confirmRemove(item))) return;
    try {
      await this.#cfg.remove(item);
      this.#shell.markCommitted();
      this.#notify(this.#cfg.messages.deleted);
      await this.refresh();
      this.#cfg.onChange?.();
    } catch (e) {
      this.#notify(e instanceof Error ? e.message : 'Could not delete.', 'error');
    }
  };
}

/** Build a controller and kick off the initial load. Call during component init. */
export function createCrud<T extends { id: string }>(
  notify: Notify,
  shell: Shell,
  cfg: CrudConfig<T>,
): CrudController<T> {
  const c = new CrudController<T>(notify, shell, cfg);
  c.refresh();
  return c;
}
