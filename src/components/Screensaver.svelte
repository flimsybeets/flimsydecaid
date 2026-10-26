<script lang="ts">
  import { app } from '../state/app.svelte';
  import { clockText } from '../lib/screensaver';
  import GhostSymbol from './GhostSymbol.svelte';

  // Full-screen photo with a big, fixed clock over it, or (Halloween theme)
  // a few ghosts drifting in and out. Tapping wakes the machine (or, in a
  // preview from Settings, just closes).

  let { image, preview = false, onDismiss }: { image: string | null; preview?: boolean; onDismiss: () => void } = $props();

  let now = $state(new Date());
  $effect(() => {
    const t = setInterval(() => (now = new Date()), 1000);
    return () => clearInterval(t);
  });
  const time = $derived(clockText(now));

  // Ghosts: size in px, start position in %, one cycle in seconds, and the
  // wander path as four vw/vh offsets. Negative delays stagger them so one or
  // two show at any moment (each is visible for ~40% of its cycle).
  const ghosts = [
    { size: 170, left: 8, top: 14, dur: 34, delay: -4, p: [0, 0, 14, -6, 22, 10, 30, 2], flip: 1, bob: 5.5 },
    { size: 110, left: 62, top: 52, dur: 29, delay: -12, p: [0, 0, -12, 8, -24, -4, -30, 6], flip: -1, bob: 4.3 },
    { size: 200, left: 38, top: 40, dur: 38, delay: -23, p: [0, 0, 10, 10, -8, 18, 6, 26], flip: 1, bob: 6.4 },
    { size: 90, left: 76, top: 10, dur: 31, delay: -30, p: [0, 0, -10, 12, -22, 6, -34, 16], flip: -1, bob: 3.8 },
  ];

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
  {#if app.halloween}
    <GhostSymbol />
    <span class="ghosts" aria-hidden="true">
      {#each ghosts as g}
        <span class="ghost" style="left:{g.left}%;top:{g.top}%;width:{g.size}px;height:{g.size * 0.9}px;animation-duration:{g.dur}s;animation-delay:{g.delay}s;--x1:{g.p[2]}vw;--y1:{g.p[3]}vh;--x2:{g.p[4]}vw;--y2:{g.p[5]}vh;--x3:{g.p[6]}vw;--y3:{g.p[7]}vh">
          <span class="bob" style="animation-duration:{g.bob}s;animation-delay:{g.delay}s">
            <svg viewBox="0 0 200 180" style="transform:scaleX({g.flip})"><use href="#flimsy-ghost" width="200" height="180" /></svg>
          </span>
        </span>
      {/each}
    </span>
  {:else}
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
    animation: fade 600ms ease;
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

  /* Ghosts: transform and opacity only. The outer span wanders and fades
     (visible for the first ~40% of the cycle, then it drifts on unseen); the
     inner span bobs. Each is a <use> of one shared symbol. */
  .ghosts { position: absolute; inset: 0; }
  .ghost {
    position: absolute;
    opacity: 0;
    will-change: transform, opacity;
    animation: wander linear infinite, appear linear infinite;
  }
  .bob { display: block; width: 100%; height: 100%; animation: bob ease-in-out infinite alternate; }
  .ghost svg { display: block; width: 100%; height: 100%; }
  @keyframes wander {
    0% { transform: translate(0, 0); }
    33% { transform: translate(var(--x1), var(--y1)); }
    66% { transform: translate(var(--x2), var(--y2)); }
    100% { transform: translate(var(--x3), var(--y3)); }
  }
  @keyframes appear {
    0% { opacity: 0; }
    10% { opacity: 0.92; }
    30% { opacity: 0.92; }
    40%, 100% { opacity: 0; }
  }
  @keyframes bob {
    from { transform: translateY(-5%) rotate(-3deg); }
    to { transform: translateY(5%) rotate(3deg); }
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

  /* The global reduced-motion rule would make endless animation flicker; show still, faint ghosts instead. */
  @media (prefers-reduced-motion: reduce) {
    .ghost, .bob { animation: none !important; }
    .ghost { opacity: 0.35; }
  }
</style>
