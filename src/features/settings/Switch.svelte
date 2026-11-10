<script lang="ts">
  // A whole-row on/off switch: what it does on the left, On/Off on the right,
  // an optional plain-language note under it.
  let { label, on, note, disabled = false, onchange }: {
    label: string;
    on: boolean;
    note?: string;
    disabled?: boolean;
    onchange: (on: boolean) => void;
  } = $props();
</script>

<div class="switch">
  <button class="glass" class:lit={on} role="switch" aria-checked={on} {disabled} onclick={() => onchange(!on)}>
    <span>{label}</span><b>{on ? 'On' : 'Off'}</b>
  </button>
  {#if note}<p>{note}</p>{/if}
</div>

<style>
  .switch { display: grid; gap: 4px; }
  button {
    display: flex; justify-content: space-between; align-items: center; gap: 12px;
    min-height: var(--touch); padding: 0 18px; border-radius: var(--radius-control);
    font-weight: 650; color: var(--paper); text-align: left;
  }
  button:disabled { opacity: 0.45; }
  b { flex: none; min-width: 52px; text-align: center; padding: 5px 12px; border-radius: 999px; background: rgb(0 0 0 / 0.28); color: var(--paper-dim); font-size: var(--t-sm); }
  .lit b { background: var(--paper); color: var(--ink); }
  p { font-size: var(--t-xs); color: var(--paper-dim); padding: 0 4px; }
</style>
