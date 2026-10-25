<script lang="ts">
  import type { Snippet } from 'svelte';

  let { title, onClose, children, actions }: {
    title: string;
    onClose: () => void;
    children: Snippet;
    actions?: Snippet;
  } = $props();

  let dialog: HTMLDivElement;
  $effect(() => { dialog?.focus(); });
</script>

<svelte:window onkeydown={(e) => { if (e.key === 'Escape') onClose(); }} />

<div class="backdrop" role="presentation" onclick={onClose}></div>
<div class="dialog" role="dialog" aria-modal="true" aria-label={title} tabindex="-1" bind:this={dialog}>
  <div class="head">
    <h2>{title}</h2>
    <button class="close" onclick={onClose} aria-label="Close">✕</button>
  </div>
  <div class="body">{@render children()}</div>
  {#if actions}<div class="actions">{@render actions()}</div>{/if}
</div>

<style>
  .backdrop {
    position: fixed; inset: 0;
    background: rgb(5 12 14 / 0.7);
    z-index: 20;
  }
  .dialog {
    position: fixed;
    left: 50%; bottom: 0;
    transform: translateX(-50%);
    width: min(720px, 100%);
    max-height: 90%;
    overflow: auto;
    z-index: 21;
    background: var(--ink-raised);
    border-radius: var(--radius-tile) var(--radius-tile) 0 0;
    padding: 24px 28px 28px;
    display: grid;
    gap: 24px;
    animation: rise 220ms cubic-bezier(.2,.8,.2,1);
    outline: none;
  }
  @keyframes rise { from { transform: translate(-50%, 40px); opacity: 0; } }
  .head { display: flex; align-items: center; justify-content: space-between; }
  h2 { font-size: var(--t-lg); font-weight: 650; }
  .close {
    width: var(--touch); height: var(--touch);
    border-radius: 50%;
    font-size: var(--t-md);
    color: var(--paper-dim);
  }
  .close:active { background: var(--line); }
  .body { display: grid; gap: 22px; }
  .actions { display: flex; gap: 12px; justify-content: flex-end; }
</style>
