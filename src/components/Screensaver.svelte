<script lang="ts">
  import { app } from '../state/app.svelte';
  import { clockText } from '../lib/screensaver';
  import type { Component } from 'svelte';
  import { EDITION } from '../edition';
  import { fade } from 'svelte/transition';

  // Full-screen photo with a big, fixed clock over it, or (when the edition
  // has one and it's on) its own screensaver art instead. Tapping wakes the machine (or, in a
  // preview from Settings, just closes).

  let { image, preview = false, onDismiss }: { image: string | null; preview?: boolean; onDismiss: () => void } = $props();

  let now = $state(new Date());
  $effect(() => {
    const t = setInterval(() => (now = new Date()), 1000);
    return () => clearInterval(t);
  });
  const time = $derived(clockText(now));

  // Extra screensaver art from this edition (if it has any), loaded only
  // when it's switched on in Settings.
  let Extra = $state<Component | null>(null);
  $effect(() => {
    if (!app.halloween || Extra || !EDITION.screensaverExtra) return;
    let live = true;
    void EDITION.screensaverExtra.load().then((m) => { if (live) Extra = m.default; });
    return () => (live = false);
  });

  // Decaid lets the screen turn off while the machine sleeps; hold it on
  // while the screensaver is up and hand control back when it goes.
  $effect(() => {
    if (preview) return;
    void app.keepScreenOn(true);
    return () => void app.keepScreenOn(false);
  });

  // Dim while showing (the preview too, so it looks like the real thing),
  // and restore the previous brightness on close.
  $effect(() => {
    void app.dimScreen(true);
    return () => void app.dimScreen(false);
  });
</script>

<button class="saver" out:fade|global={{ duration: 250 }} onclick={onDismiss} aria-label={preview ? 'Close preview' : 'Wake the machine'}>
  {#if image}<img src={image} alt="" decoding="async" />{/if}
  {#if app.halloween && EDITION.screensaverExtra}
    {#if Extra}<Extra />{/if}
  {:else if app.screensaverClock}
    <span class="clock" aria-hidden="true">{time}</span>
  {/if}
  {#if preview}<span class="hint">Preview. Tap to close.</span>{/if}
</button>

<style>
  .saver {
    position: fixed;
    inset: 0;
    z-index: 100;
    display: grid;
    place-items: center;
    overflow: hidden;
    background: #000;
    cursor: default;
    animation: fade 400ms ease;
  }
  img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  /* Centred and fixed: about 65% of the screen width for "12:34". */
  .clock {
    display: block;
    position: relative;
    color: rgb(255 255 255 / 0.5);
    font-size: clamp(96px, 27.8vw, 640px);
    font-weight: 500;
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.03em;
    line-height: 1;
    white-space: nowrap;
    /* A faint shadow so it stays legible over bright photos. */
    text-shadow: 0 2px 22px rgb(0 0 0 / 0.18);
  }

  /* Ghosts: the loop sets transform and opacity only; the frame is a <use> of one
     pre-rendered symbol. */

  .hint {
    position: absolute;
    bottom: 21px;
    left: 50%;
    transform: translateX(-50%);
    padding: 9px 16px;
    border-radius: var(--radius-pill);
    background: rgb(0 0 0 / 0.4);
    color: rgb(255 255 255 / 0.8);
    font-size: var(--t-sm);
  }

  @keyframes fade { from { opacity: 0; } }

</style>
