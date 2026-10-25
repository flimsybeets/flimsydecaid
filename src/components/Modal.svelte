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
    -webkit-backdrop-filter: blur(8px) saturate(120%);
    backdrop-filter: blur(8px) saturate(120%);
    /* Above full-screen views (shot view, profile editor); below the screensaver. */
    z-index: 60;
    animation: fade 220ms ease;
  }
  .dialog {
    position: fixed;
    left: 50%; bottom: calc(14px + var(--kb));
    transform: translateX(-50%);
    width: min(540px, calc(100% - 21px));
    max-height: calc(100% - 40px - var(--kb));
    transition: bottom 180ms ease, max-height 180ms ease;
    overflow: hidden;
    grid-template-rows: auto minmax(0, 1fr) auto;
    z-index: 61;
    border-radius: 27px;
    padding: 18px 21px 21px;
    display: grid;
    gap: 18px;
    animation: rise 220ms cubic-bezier(.2,.8,.2,1);
    outline: none;
  }
  @keyframes rise { from { transform: translate(-50%, 30px) scale(0.98); opacity: 0; } }
  @keyframes fade { from { opacity: 0; } }
  .head { display: flex; align-items: center; justify-content: space-between; }
  h2 { font-size: var(--t-lg); font-weight: 650; }
  .close {
    width: var(--touch); height: var(--touch);
    border-radius: 50%;
    font-size: var(--t-md);
    color: var(--paper-dim);
  }
  .body { display: grid; gap: 16px; align-content: start; min-height: 0; overflow-y: auto; margin: 0 -8px; padding: 3px 6px; }
  .actions { display: flex; gap: 9px; justify-content: flex-end; }
</style>
