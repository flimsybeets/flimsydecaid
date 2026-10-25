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
<div class="dialog glass thick" role="dialog" aria-modal="true" aria-label={title} tabindex="-1" bind:this={dialog}>
  <div class="head">
    <h2>{title}</h2>
    <button class="close glass" onclick={onClose} aria-label="Close">✕</button>
  </div>
  <div class="body">{@render children()}</div>
  {#if actions}<div class="actions">{@render actions()}</div>{/if}
</div>

<style>
  .backdrop {
    position: fixed; inset: 0;
    background: rgb(5 12 14 / 0.38);
    -webkit-backdrop-filter: blur(10px) saturate(120%);
    backdrop-filter: blur(10px) saturate(120%);
    z-index: 20;
    animation: fade 220ms ease;
  }
  .dialog {
    position: fixed;
    left: 50%; bottom: 14px;
    transform: translateX(-50%);
    width: min(720px, calc(100% - 28px));
    max-height: calc(100% - 40px);
    overflow: hidden;
    grid-template-rows: auto minmax(0, 1fr) auto;
    z-index: 21;
    border-radius: 36px;
    padding: 24px 28px 28px;
    display: grid;
    gap: 24px;
    animation: rise 220ms cubic-bezier(.2,.8,.2,1);
    outline: none;
  }
  @keyframes rise { from { transform: translate(-50%, 40px) scale(0.98); opacity: 0; } }
  @keyframes fade { from { opacity: 0; } }
  .head { display: flex; align-items: center; justify-content: space-between; }
  h2 { font-size: var(--t-lg); font-weight: 650; }
  .close {
    width: var(--touch); height: var(--touch);
    border-radius: 50%;
    font-size: var(--t-md);
    color: var(--paper-dim);
  }
  .body { display: grid; gap: 22px; align-content: start; min-height: 0; overflow-y: auto; margin: 0 -8px; padding: 4px 8px; }
  .actions { display: flex; gap: 12px; justify-content: flex-end; }
</style>
