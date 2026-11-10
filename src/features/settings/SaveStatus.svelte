<script lang="ts">
  import type { Saver } from './saving.svelte';
  let { saver }: { saver: Saver } = $props();
</script>

<span class="status {saver.status}" role="status" aria-live="polite">
  {#if saver.status === 'saving'}Saving…{:else if saver.status === 'saved'}Saved{:else if saver.status === 'error'}Couldn't save: {saver.message}{/if}
</span>

<style>
  .status { font-size: var(--t-sm); color: var(--paper-faint); min-height: 1.4em; }
  .saved { color: var(--go); }
  .error { color: var(--stop); }
</style>
