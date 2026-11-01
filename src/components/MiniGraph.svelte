<script lang="ts">
  import type { MiniLines } from '../lib/miniGraph';
  import { H, W } from '../lib/miniGraph';

  // The little graph on a profile tile: pressure green, flow blue and (for a
  // real shot) weight brown, in the same colours as every other graph.
  let { lines, kind }: { lines: MiniLines; kind: 'plan' | 'shot' } = $props();
</script>

<svg class="mini" class:plan={kind === 'plan'} viewBox="0 0 {W} {H}" preserveAspectRatio="none" aria-hidden="true">
  {#if lines.weight}<path class="w" d={lines.weight} />{/if}
  <path class="f" d={lines.flow} />
  <path class="p" d={lines.pressure} />
</svg>

<style>
  .mini { display: block; width: 100%; height: 38px; overflow: visible; }
  path { fill: none; stroke-width: 1.8; stroke-linejoin: round; stroke-linecap: round; vector-effect: non-scaling-stroke; }
  .p { stroke: var(--g-pressure); }
  .f { stroke: var(--g-flow); }
  .w { stroke: var(--g-weight); stroke-width: 1.4; opacity: 0.8; }
  /* The plan is a target, so dashed like targets on the big graphs. */
  .plan path { stroke-dasharray: 4 3; }
</style>
