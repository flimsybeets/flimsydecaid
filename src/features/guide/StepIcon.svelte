<script lang="ts">
  import type { TemplateKey } from '../../lib/workflow';

  // A quiet line icon for a step that has no picture of its own: translucent
  // fill, light rim, one accent stroke. No filters.
  let { kind }: { kind: TemplateKey } = $props();
</script>

<svg class="icon" viewBox="0 0 64 64" aria-hidden="true">
  <g class="body">
    {#if kind === 'weigh'}
      <rect x="8" y="42" width="48" height="11" rx="4" />
      <path d="M20 42 22 26h20l2 16z" />
      <path class="acc" d="M26 34h12" />
      <circle class="acc" cx="46" cy="47.5" r="1.4" />
    {:else if kind === 'grinder'}
      <circle cx="32" cy="32" r="21" />
      <circle cx="32" cy="32" r="12" />
      <path class="acc" d="M32 11v8M32 32l8-8" />
      <path d="M14 20l3 2M50 20l-3 2M12 34h4M52 34h-4" />
    {:else if kind === 'grind'}
      <path d="M18 8h28l-6 16H24z" />
      <rect x="20" y="24" width="24" height="26" rx="4" />
      <path d="M14 56h36" />
      <path class="acc" d="M32 32v10M28 38l4 4 4-4" />
    {:else if kind === 'pull'}
      <rect x="10" y="10" width="44" height="8" rx="3" />
      <path class="acc" d="M32 22v12" stroke-dasharray="3 4" />
      <path d="M16 38h28v8a8 8 0 0 1-8 8h-12a8 8 0 0 1-8-8z" />
      <path d="M44 41h4a4 4 0 0 1 0 8h-4" />
    {:else if kind === 'rinse'}
      <rect x="12" y="8" width="40" height="9" rx="3" />
      <path class="acc" d="M22 24c3 4 4 6 0 9-4-3-3-5 0-9zM32 28c3 4 4 6 0 9-4-3-3-5 0-9zM42 24c3 4 4 6 0 9-4-3-3-5 0-9z" />
      <path d="M14 50h36" />
    {:else if kind === 'steam'}
      <path d="M22 24h20l-2 28H24z" />
      <path d="M42 30h6a3 3 0 0 1 0 8h-5" />
      <path class="acc" d="M26 8c-3 3 3 5 0 8M34 8c-3 3 3 5 0 8" />
    {:else if kind === 'done'}
      <path d="M14 26h30v12a10 10 0 0 1-10 10h-10a10 10 0 0 1-10-10z" />
      <path d="M44 29h4a4 4 0 0 1 0 9h-4" />
      <path d="M12 54h34" />
      <path class="acc" d="M24 10c-3 3 3 5 0 8M34 10c-3 3 3 5 0 8" />
    {:else if kind === 'spray'}
      <rect x="22" y="26" width="16" height="28" rx="4" />
      <path d="M26 26v-6h10v6M36 20h8v4" />
      <g class="acc"><circle cx="50" cy="20" r="1.4" /><circle cx="54" cy="25" r="1.4" /><circle cx="50" cy="30" r="1.4" /></g>
    {:else if kind === 'wdt'}
      <ellipse cx="32" cy="46" rx="22" ry="8" />
      <path class="acc" d="M20 46a12 4 0 0 1 24 0M26 46a6 2 0 0 1 12 0" />
      <path d="M32 6v32" />
      <circle cx="32" cy="8" r="3" />
    {:else if kind === 'distribute'}
      <path d="M10 22h44l-4 28H14z" />
      <path class="acc" d="M16 34h32M40 28l8 6-8 6" />
    {:else if kind === 'funnel'}
      <path d="M12 12h40L38 34v18H26V34z" />
      <path class="acc" d="M26 22h12" />
    {:else if kind === 'basket'}
      <path d="M12 20h40l-5 28a6 6 0 0 1-6 5H23a6 6 0 0 1-6-5z" />
      <path d="M26 30v14M38 30v14M32 28v18" />
      <path class="acc" d="M22 12l6 6 12-12" />
    {:else if kind === 'tamp'}
      <path d="M26 6h12v16H26z" />
      <path d="M16 22h32v8H16z" />
      <path class="acc" d="M12 40h40v10H12z" />
    {:else if kind === 'puckscreen'}
      <circle cx="32" cy="32" r="22" />
      <g class="acc"><circle cx="32" cy="32" r="1.6" /><circle cx="24" cy="26" r="1.6" /><circle cx="40" cy="26" r="1.6" /><circle cx="24" cy="38" r="1.6" /><circle cx="40" cy="38" r="1.6" /><circle cx="32" cy="20" r="1.6" /><circle cx="32" cy="44" r="1.6" /></g>
    {:else if kind === 'paper'}
      <circle cx="32" cy="32" r="22" stroke-dasharray="4 3" />
      <path class="acc" d="M22 32h20M26 40h12" />
    {:else if kind === 'minerals'}
      <path d="M26 26h12v26a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4z" />
      <path d="M28 26v-8a4 4 0 0 1 8 0v8" />
      <path class="acc" d="M32 4c2.5 3 3.5 5 0 7.5-3.5-2.5-2.5-4.5 0-7.5z" />
    {:else if kind === 'knock'}
      <path d="M10 40h44v12H10z" />
      <path d="M22 40h20" />
      <circle class="acc" cx="32" cy="22" r="9" />
      <path class="acc" d="M32 8v-2" />
    {:else if kind === 'shake'}
      <g transform="rotate(16 32 36)">
        <path d="M22 22h20l-3 30a3 3 0 0 1-3 3h-8a3 3 0 0 1-3-3z" />
        <path d="M24 22v-5h16v5" />
        <path d="M28 17v-4h8v4" />
        <path d="M24 31h16" />
      </g>
      <path class="acc" d="M13 26q-4 8 0 16M7 22q-6 12 0 24M51 26q4 8 0 16M57 22q6 12 0 24" />
    {:else}
      <rect x="12" y="10" width="40" height="44" rx="6" />
      <path d="M20 22h4M20 32h4M20 42h4" />
      <path class="acc" d="M30 22h14M30 32h14M30 42h10" />
    {/if}
  </g>
</svg>

<style>
  .icon { width: 100%; height: 100%; max-width: 280px; max-height: 280px; margin: auto; --acc: var(--go); }
  .body { fill: rgb(238 243 239 / 0.07); stroke: rgb(238 243 239 / 0.7); stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
  .body :global(.acc) { stroke: var(--acc); }
  .body :global(g.acc) { fill: var(--acc); stroke: none; }
  .body :global(circle.acc), .body :global(path.acc), .body :global(ellipse.acc) { stroke: var(--acc); }
</style>
