<script lang="ts">
  import { GHOSTS, ghostPose } from './ghostPath';

  // Personal edition: the Halloween screensaver's ghosts (Settings → Theme
  // options). A low-poly 3D ghost pre-rendered at 24 yaw angles (ghostFrames,
  // a lazy chunk). One rAF loop moves every ghost with a transform and opacity
  // at about 30 updates a second, and swaps which frame its <use> shows when
  // the heading changes; the paths, heading and turns are in ./ghostPath.

  let defs = $state('');
  let frames = $state(24);
  let aspect = $state(1.7);
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  let boxes: HTMLElement[] = [];
  let uses: SVGUseElement[] = [];

  $effect(() => {
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
    if (!defs || reduced) return;
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
</script>

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

<style>
  .ghosts { position: absolute; inset: 0; }
  .ghost { position: absolute; opacity: 0; will-change: transform, opacity; }
  .ghost svg { display: block; width: 100%; height: 100%; }
  /* No loop under reduced motion: still, front-facing, faint ghosts at their home spots. */
  @media (prefers-reduced-motion: reduce) {
    .ghost { opacity: 0.35; }
  }
</style>
