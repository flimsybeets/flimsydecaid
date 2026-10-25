<script lang="ts">
  import { app } from '../state/app.svelte';
  import { clockText } from '../lib/screensaver';

  // Full-screen photo with a clock drifting slowly over it, so nothing sits
  // in one place all night. Tapping wakes the machine (or, in a preview from
  // Settings, just closes).

  let { image, preview = false, onDismiss }: { image: string | null; preview?: boolean; onDismiss: () => void } = $props();

  let now = $state(new Date());
  $effect(() => {
    const t = setInterval(() => (now = new Date()), 1000);
    return () => clearInterval(t);
  });
  const time = $derived(clockText(now));

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

<button class="saver" onclick={onDismiss} aria-label={preview ? 'Close preview' : 'Wake the machine'}>
  {#if image}<img src={image} alt="" decoding="async" />{/if}
  <span class="drift-x" aria-hidden="true">
    <span class="drift-y">
      <span class="clock">{time}</span>
    </span>
  </span>
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
    animation: fade 600ms ease;
  }
  img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  /* Two slow, unrelated drifts give a wandering path that rarely repeats.
     Negative delays start each one halfway, so the clock first appears
     near the middle. */
  .drift-x { animation: drift-x 53s ease-in-out -26.5s infinite alternate; }
  .drift-y { display: block; animation: drift-y 37s ease-in-out -18.5s infinite alternate; }
  @keyframes drift-x { from { transform: translateX(-26vw); } to { transform: translateX(26vw); } }
  @keyframes drift-y { from { transform: translateY(-28vh); } to { transform: translateY(28vh); } }

  .clock {
    display: block;
    color: rgb(255 255 255 / 0.5);
    font-size: clamp(72px, 22vmin, 195px);
    font-weight: 500;
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.03em;
    line-height: 1;
    /* A faint shadow so it stays legible over bright photos. */
    text-shadow: 0 2px 22px rgb(0 0 0 / 0.18);
  }

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

  /* The global reduced-motion rule would make the endless drift flicker; stop it instead. */
  @media (prefers-reduced-motion: reduce) {
    .drift-x, .drift-y { animation: none !important; }
  }
</style>
