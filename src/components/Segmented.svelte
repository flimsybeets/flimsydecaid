<script lang="ts" generics="T extends string">
  // A row of mutually exclusive choices, iOS-style: the chosen one is a lens
  // of bright glass in a recessed track.
  let {
    options,
    value,
    onchange,
    label,
    disabled = false,
  }: {
    options: readonly { value: T; label: string; tone?: string }[];
    value: T;
    onchange: (value: T) => void;
    label: string;
    disabled?: boolean;
  } = $props();
</script>

<div class="seg well" role="radiogroup" aria-label={label} class:disabled>
  {#each options as o (o.value)}
    <button
      role="radio"
      aria-checked={o.value === value}
      class:on={o.value === value}
      style={o.tone ? `--tone: ${o.tone}` : undefined}
      {disabled}
      onclick={() => { if (o.value !== value) onchange(o.value); }}
    >{#if o.tone}<i aria-hidden="true"></i>{/if}{o.label}</button>
  {/each}
</div>

<style>
  .seg {
    display: flex;
    gap: 4px;
    padding: 4px;
    border-radius: 16px;
    min-height: 56px;
  }
  .seg.disabled { opacity: 0.45; }
  button {
    flex: 1;
    min-width: 0;
    padding: 0 12px;
    border-radius: 12px;
    color: var(--paper-dim);
    font-size: var(--t-sm);
    white-space: nowrap;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    transition: background 150ms ease, color 150ms ease;
  }
  button.on {
    background: linear-gradient(170deg, rgb(255 255 255 / 0.95), rgb(226 236 232 / 0.86));
    color: var(--ink);
    font-weight: 650;
    box-shadow: 0 4px 12px -4px rgb(0 0 0 / 0.5), inset 0 1px 0 #fff;
  }
  i { width: 10px; height: 10px; border-radius: 50%; background: var(--tone); flex: none; }
</style>
