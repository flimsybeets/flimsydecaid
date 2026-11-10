<script lang="ts" generics="T extends string">
  import Segmented from '../../components/Segmented.svelte';
  // A titled set of choices with a note that explains the one picked.
  let { label, value, options, notes, disabled = false, onchange }: {
    label: string;
    value: T;
    options: readonly { value: T; label: string }[];
    /** Plain-language note per option, shown for the current one. */
    notes?: Partial<Record<T, string>>;
    disabled?: boolean;
    onchange: (value: T) => void;
  } = $props();
</script>

<div class="choice">
  <span class="label">{label}</span>
  <Segmented {label} {value} {options} {disabled} {onchange} />
  {#if notes?.[value]}<p>{notes[value]}</p>{/if}
</div>

<style>
  .choice { display: grid; gap: 6px; justify-items: start; }
  .label { color: var(--paper-dim); font-size: var(--t-sm); }
  p { font-size: var(--t-xs); color: var(--paper-dim); padding: 0 4px; }
</style>
