<script lang="ts">
  import { wispLayout, wispsEnd, type WispMode } from '../lib/wisps';

  // A few soft steam curls rising over the screen: 'rise' while the screensaver
  // comes up, 'clear' while it lifts off. Each wisp is a wavy ribbon (three
  // stacked strokes of different widths, a vertical gradient fading both ends),
  // so no blur filter is needed. CSS keyframes move transform and opacity only,
  // and the whole thing removes itself when the last wisp is done.

  let { mode = 'rise' }: { mode?: WispMode } = $props();

  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Capture once: the mode never changes while mounted.
  // svelte-ignore state_referenced_locally
  const m = mode;
  const wisps = reduced ? [] : wispLayout(m === 'rise' ? 6 : 5, m);
  let done = $state(reduced);
  $effect(() => {
    if (done) return;
    const t = setTimeout(() => (done = true), wispsEnd(wisps) + 100);
    return () => clearTimeout(t);
  });
  const uid = `sw${Math.random().toString(36).slice(2, 7)}`;
</script>

{#if !done}
  <div class="wisps {m}" aria-hidden="true">
    {#each wisps as w, i}
      <div
        class="wisp"
        style="left:{w.x}%;width:{w.width}%;margin-left:-{w.width / 2}%;--d:{w.delay}ms;--t:{w.duration}ms;--sw:{w.sway}%;--pk:{w.peak}"
      >
        <div class="sway">
          <svg viewBox="0 0 100 300" preserveAspectRatio="none" class:flip={w.flip}>
            <defs>
              <linearGradient id="{uid}{i}" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="300">
                <stop offset="0" stop-color="#fff" stop-opacity="0" />
                <stop offset="0.28" stop-color="#fff" stop-opacity="0.9" />
                <stop offset="0.62" stop-color="#fff" stop-opacity="0.75" />
                <stop offset="1" stop-color="#fff" stop-opacity="0" />
              </linearGradient>
            </defs>
            <g fill="none" stroke="url(#{uid}{i})" stroke-linecap="round" stroke-linejoin="round">
              <path d="M50 296 C 8 244, 92 206, 50 156 S 10 66, 52 6" stroke-width="46" stroke-opacity="0.10" />
              <path d="M50 296 C 8 244, 92 206, 50 156 S 10 66, 52 6" stroke-width="30" stroke-opacity="0.14" />
              <path d="M50 292 C 14 242, 88 208, 50 158 S 14 70, 50 10" stroke-width="18" stroke-opacity="0.18" />
              <path d="M52 290 C 22 244, 84 210, 52 160 S 20 76, 50 14" stroke-width="7" stroke-opacity="0.22" />
            </g>
          </svg>
        </div>
      </div>
    {/each}
  </div>
{/if}

<style>
  .wisps { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }
  .wisp {
    position: absolute;
    bottom: -20%;
    height: 90%;
    opacity: 0;
    transform-origin: 50% 100%;
    will-change: transform, opacity;
    animation: rise var(--t) cubic-bezier(0.3, 0.1, 0.4, 1) var(--d) both;
  }
  .clear .wisp { bottom: -45%; animation-name: clear; }
  .sway {
    width: 100%;
    height: 100%;
    will-change: transform;
    animation: sway var(--t) ease-in-out var(--d) both;
  }
  svg { display: block; width: 100%; height: 100%; overflow: visible; }
  svg.flip { transform: scaleX(-1); }

  @keyframes rise {
    0% { opacity: 0; transform: translate3d(0, 6%, 0) scale(0.6, 0.8); }
    22% { opacity: calc(var(--pk) * 0.9); }
    60% { opacity: calc(var(--pk) * 0.6); }
    100% { opacity: 0; transform: translate3d(0, -55%, 0) scale(1.5, 1.2); }
  }
  @keyframes clear {
    0% { opacity: 0; transform: translate3d(0, 10%, 0) scale(0.7, 0.8); }
    25% { opacity: calc(var(--pk) * 0.85); }
    100% { opacity: 0; transform: translate3d(0, -50%, 0) scale(1.4, 1.15); }
  }
  @keyframes sway {
    0% { transform: translate3d(0, 0, 0); }
    30% { transform: translate3d(var(--sw), 0, 0); }
    65% { transform: translate3d(calc(var(--sw) * -0.7), 0, 0); }
    100% { transform: translate3d(calc(var(--sw) * 0.5), 0, 0); }
  }

  @media (prefers-reduced-motion: reduce) {
    .wisps { display: none; }
  }
</style>
