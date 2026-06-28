<script lang="ts">
  import { useShell } from '../lib/shell.svelte';

  const shell = useShell();

  // Map the shell's publish state to a label + visual tone. The dirty state wins
  // visually so the artist always knows there's something to save.
  const view = $derived.by(() => {
    if (shell.saving) return { kind: 'busy', label: 'Saving…' };
    if (shell.dirty) return { kind: 'dirty', label: 'Unsaved changes' };
    switch (shell.publishState) {
      case 'publishing':
        return { kind: 'busy', label: 'Publishing…' };
      case 'error':
        return { kind: 'error', label: "Couldn't save" };
      case 'live':
        return { kind: 'live', label: 'All changes live' };
      default:
        return { kind: 'idle', label: 'All changes saved' };
    }
  });
</script>

<span class="ez-chip ez-chip--{view.kind}" role="status" aria-live="polite">
  <span class="ez-chip__dot ez-chip__dot--{view.kind}"></span>
  {view.label}
</span>
