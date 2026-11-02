<script lang="ts">
  import { puffLayout, wispsEnd, type WispMode } from '../lib/wisps';

  // Fog: a dozen or so big, soft, overlapping puffs ('rise' while the
  // screensaver comes up, 'clear' while it lifts off). Each puff is one div with
  // a radial-gradient fill (no blur filter), grown and faded by CSS keyframes
  // on transform and opacity only, so it reads as vapour dispersing. The whole
  // thing removes itself when the last puff is done.

  let { mode = 'rise' }: { mode?: WispMode } = $props();

  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Capture once: the mode never changes while mounted.
  // svelte-ignore state_referenced_locally
  const m = mode;
  const puffs = reduced ? [] : puffLayout(m === 'rise' ? 15 : 14, m);
  let done = $state(reduced);
  $effect(() => {
    if (done) return;
    const t = setTimeout(() => (done = true), wispsEnd(puffs) + 100);
    return () => clearTimeout(t);
  });
</script>

{#if !done}
  <div class="fog {m}" aria-hidden="true">
    {#each puffs as p}
      <div
        class="puff"
        style="left:{p.x}%;top:{p.y}%;width:{p.size}%;aspect-ratio:1/{p.aspect};--d:{p.delay}ms;--t:{p.duration}ms;--dx:{p.drift}%;--dy:{-p.rise * 100}%;--s0:{p.s0};--s1:{p.s1};--pk:{p.peak};--pk2:{p.peak * 0.5};--pk3:{p.peak * 0.16}"
      ></div>
    {/each}
  </div>
{/if}

<style>
  .fog { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }
  .puff {
    position: absolute;
    /* Centred on left/top through the transform below. */
    border-radius: 50%;
    opacity: 0;
    background: radial-gradient(
      closest-side,
      rgb(255 255 255 / var(--pk)) 0%,
      rgb(255 255 255 / var(--pk2)) 42%,
      rgb(255 255 255 / var(--pk3)) 72%,
      rgb(255 255 255 / 0) 100%
    );
    will-change: transform, opacity;
    animation: puff-rise var(--t) cubic-bezier(0.25, 0.5, 0.5, 1) var(--d) both;
  }
  .clear .puff { animation-name: puff-clear; }

  @keyframes puff-rise {
    0% { opacity: 0; transform: translate3d(-50%, -50%, 0) scale(var(--s0)); }
    35% { opacity: 1; }
    100% {
      opacity: 0;
      transform: translate3d(calc(-50% + var(--dx)), calc(-50% + var(--dy)), 0) scale(var(--s1));
    }
  }
  @keyframes puff-clear {
    0% { opacity: 0; transform: translate3d(-50%, -50%, 0) scale(var(--s0)); }
    16% { opacity: 1; }
    100% {
      opacity: 0;
      transform: translate3d(calc(-50% + var(--dx)), calc(-50% + var(--dy) * 1.3), 0) scale(var(--s1));
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .fog { display: none; }
  }
</style>
