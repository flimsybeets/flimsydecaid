<script lang="ts">
  import { app } from '../state/app.svelte';
  import { clockText } from '../lib/screensaver';
  import { GHOSTS, ghostPose } from '../lib/ghostPath';

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

  // Ghosts: a low-poly 3D ghost pre-rendered at 24 yaw angles (ghostFrames, a
  // lazy chunk). One rAF loop moves every ghost with a transform and opacity
  // at about 30 updates a second, and swaps which frame its <use> shows when the heading changes; the paths,
  // heading and turns are worked out in lib/ghostPath.
  let defs = $state('');
  let frames = $state(24);
  let aspect = $state(1.7);
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  let boxes: HTMLElement[] = [];
  let uses: SVGUseElement[] = [];

  $effect(() => {
    if (!app.halloween || defs) return;
    let live = true;
    void import('./ghostFrames').then((m) => {
      if (!live) return;
      frames = m.GHOST_FRAMES;
      aspect = m.GHOST_ASPECT;
      defs = m.GHOST_DEFS;
    });
    return () => (live = false);
  });

  $effect(() => {
    if (!app.halloween || !defs || reduced) return;
    const shown: number[] = GHOSTS.map(() => -1);
    const t0 = performance.now();
    let raf = 0;
    let last = 0;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      // The drift is slow: 30 updates a second look the same and cost half.
      if (now - last < 30) return;
      last = now;
      const t = (performance.now() - t0) / 1000;
      const w = innerWidth / 100;
      const h = innerHeight / 100;
      GHOSTS.forEach((g, i) => {
        const p = ghostPose(g, t, frames);
        const box = boxes[i];
        if (!box) return;
        box.style.opacity = String(p.opacity);
        // Skip the work while it is unseen.
        if (p.opacity <= 0.001) return;
        box.style.transform = `translate3d(${(p.x * w).toFixed(1)}px,${(p.y * h + p.bob * g.size * 0.03).toFixed(1)}px,0) rotate(${p.roll.toFixed(1)}deg)`;
        if (p.frame !== shown[i]) {
          shown[i] = p.frame;
          uses[i]?.setAttribute('href', `#gf${p.frame}`);
        }
      });
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
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

<button class="saver" onclick={onDismiss} aria-label={preview ? 'Close preview' : 'Wake the machine'}>
  {#if image}<img src={image} alt="" decoding="async" />{/if}
  {#if app.halloween}
    {#if defs}
      <svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>{@html defs}</defs></svg>
      <span class="ghosts" aria-hidden="true">
        {#each GHOSTS as g, i}
          <span class="ghost" bind:this={boxes[i]} style="left:{g.left}%;top:{g.top}%;width:{g.size}px;height:{g.size / aspect}px">
            <svg viewBox="0 0 {aspect * 100} 100"><use bind:this={uses[i]} href="#gf0" width={aspect * 100} height="100" /></svg>
          </span>
        {/each}
      </span>
    {/if}
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

  /* Ghosts: the loop sets transform and opacity only; the frame is a <use> of one
     pre-rendered symbol. */
  .ghosts { position: absolute; inset: 0; }
  .ghost { position: absolute; opacity: 0; will-change: transform, opacity; }
  .ghost svg { display: block; width: 100%; height: 100%; }

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

  /* No loop under reduced motion: still, front-facing, faint ghosts at their home spots. */
  @media (prefers-reduced-motion: reduce) {
    .ghost { opacity: 0.35; }
  }
</style>
