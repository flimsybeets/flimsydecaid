<script lang="ts">
  import Modal from './Modal.svelte';

  // "Are you sure?" for anything destructive. Says what will happen; the
  // confirm button names the action. Stays open with the error if it fails.

  let {
    title,
    message,
    action,
    option,
    onConfirm,
    onClose,
  }: {
    title: string;
    message: string;
    /** e.g. "Delete category" */
    action: string;
    /** An optional tick box ("Give back 18 g to the bag"), on by default; its state is passed to onConfirm. */
    option?: string;
    onConfirm: (option: boolean) => Promise<void> | void;
    onClose: () => void;
  } = $props();

  let ticked = $state(true);
  let busy = $state(false);
  let error = $state<string | null>(null);

  async function confirm() {
    busy = true;
    error = null;
    try {
      await onConfirm(ticked);
      onClose();
    } catch (e) {
      error = (e as Error).message;
    } finally {
      busy = false;
    }
  }
</script>

<!-- No cancelling once it's under way: the action would still finish. -->
<Modal {title} onClose={() => { if (!busy) onClose(); }}>
  <p class="message">{message}</p>
  {#if option}
    <label class="option"><input type="checkbox" bind:checked={ticked} disabled={busy} /> {option}</label>
  {/if}
  {#if error}<p class="error" role="alert">That didn't work: {error}</p>{/if}
  {#snippet actions()}
    <button class="secondary glass" disabled={busy} onclick={onClose}>Cancel</button>
    <button class="danger glass" disabled={busy} onclick={confirm}>{busy ? 'Working…' : action}</button>
  {/snippet}
</Modal>

<style>
  .message { color: var(--paper-dim); max-width: 52ch; }
  .option { display: flex; align-items: center; gap: 10px; min-height: var(--touch); color: var(--paper); }
  .option input { width: 22px; height: 22px; accent-color: var(--paper); }
  .error { color: var(--stop); }
  .secondary, .danger { min-height: var(--touch); padding: 0 20px; border-radius: var(--radius-control); font-weight: 650; }
  .secondary { color: var(--paper-dim); }
  .secondary:disabled { opacity: 0.4; }
  .danger { background: linear-gradient(170deg, #ff8a7f, var(--stop)); color: #2a0b07; }
  .danger:disabled { opacity: 0.5; }
</style>
