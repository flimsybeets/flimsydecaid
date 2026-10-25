<script lang="ts">
  import { untrack } from 'svelte';
  import Modal from './Modal.svelte';

  let { title, label, action, initial = '', onSave, onClose }: {
    title: string;
    label: string;
    action: string;
    initial?: string;
    onSave: (name: string) => void | Promise<void>;
    onClose: () => void;
  } = $props();

  let name = $state(untrack(() => initial));
  let input: HTMLInputElement;
  $effect(() => { input?.focus(); });

  const trimmed = $derived(name.trim());
</script>

<Modal {title} {onClose}>
  <label>
    <span>{label}</span>
    <input bind:this={input} bind:value={name} maxlength="40" onkeydown={(e) => { if (e.key === 'Enter' && trimmed) onSave(trimmed); }} />
  </label>
  {#snippet actions()}
    <button class="secondary glass" onclick={onClose}>Cancel</button>
    <button class="primary glass solid" disabled={!trimmed} onclick={() => onSave(trimmed)}>{action}</button>
  {/snippet}
</Modal>

<style>
  label { display: grid; gap: 8px; color: var(--paper-dim); }
  input {
    min-height: var(--touch);
    padding: 0 18px;
    border-radius: var(--radius-control);
    border: 1px solid rgb(255 255 255 / 0.08);
    background: var(--well);
    box-shadow: var(--well-shadow);
    font-size: var(--t-md);
    color: var(--paper);
    user-select: text;
  }
  input:focus { border-color: var(--paper); outline: none; }
  .primary, .secondary { min-height: var(--touch); padding: 0 28px; border-radius: var(--radius-control); font-weight: 650; }
  .primary:disabled { opacity: 0.4; }
  .secondary { color: var(--paper-dim); }
</style>
