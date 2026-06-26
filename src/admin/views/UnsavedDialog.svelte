<script lang="ts">
  import { useShell } from '../lib/shell.svelte';

  const shell = useShell();
  let saving = $state(false);

  async function save() {
    saving = true;
    await shell.confirmSave();
    saving = false;
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') shell.cancelNav();
  }
</script>

<svelte:window onkeydown={onKeydown} />

<div
  class="ez-modal"
  role="dialog"
  aria-modal="true"
  aria-labelledby="ez-unsaved-title"
  tabindex="-1"
>
  <button class="ez-modal__scrim" aria-label="Cancel" onclick={() => shell.cancelNav()}></button>
  <div class="ez-modal__panel">
    <h2 id="ez-unsaved-title">Save your changes?</h2>
    <p>You have edits that haven't been saved yet. Save them before you move on?</p>
    <div class="ez-modal__actions">
      <button class="ez-btn ez-btn--ghost" onclick={() => shell.cancelNav()} disabled={saving}>Cancel</button>
      <button class="ez-btn ez-btn--outline" onclick={() => shell.confirmDiscard()} disabled={saving}>Discard</button>
      <button class="ez-btn ez-btn--primary ez-btn--depth" onclick={save} disabled={saving}>
        {saving ? 'Saving…' : 'Save & continue'}
      </button>
    </div>
  </div>
</div>
