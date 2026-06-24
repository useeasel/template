<script lang="ts">
  import { contrastIssues, type DesignTokens } from '../../lib/design';
  let { design }: { design: DesignTokens } = $props();
  const issues = $derived(contrastIssues(design));
</script>

{#if issues.length}
  <div class="ez-warn" role="status">
    <strong>Readability check</strong>
    <ul>
      {#each issues as i (i.label)}
        <li>{i.label} — {i.ratio}:1 (aim for {i.min}:1 or higher)</li>
      {/each}
    </ul>
    <p class="ez-help">These combinations may be hard to read. This is just a heads-up, not a block.</p>
  </div>
{/if}
