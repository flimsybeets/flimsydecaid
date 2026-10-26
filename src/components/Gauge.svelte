<script lang="ts">
  import { arcPath, polar, ticks, valueToAngle } from '../lib/gauge';

  // A round dial in the skin's glass: a flat frosted disc with a fine rim,
  // a thin track, a soft value arc filled from zero to the reading, thin
  // needle(s) that sweep smoothly between the ~10 Hz readings, a small
  // marker on the rim for each target, and the number in the open bottom.
  // No filters or shadows: this repaints ten times a second on a weak GPU.

  interface Needle { value: number | null | undefined; colour: string; width?: number; name?: string }
  interface Target { value: number | null | undefined; colour: string }

  let {
    label, unit, min, max, major, minor = 2, needles, targets = [], decimals = 1, redline, side = false,
  }: {
    label: string;
    unit: string;
    min: number;
    max: number;
    /** Numbered tick spacing. */
    major: number;
    /** Minor steps per major tick. */
    minor?: number;
    needles: Needle[];
    targets?: Target[];
    decimals?: number;
    /** Start of a red zone that runs to max. */
    redline?: number;
    /** Put the label beside the dial instead of under it (the dial then fills the height and is square); the label runs vertically on its left. */
    side?: boolean;
  } = $props();

  const C = 100;
  const R = 80;
  const uid = $props.id();

  const scale = $derived(ticks(min, max, major, minor));
  const shown = (v: number | null | undefined): v is number => typeof v === 'number' && Number.isFinite(v);
  const angle = (v: number) => valueToAngle(v, min, max);
  const fmt = (v: number | null | undefined) => (shown(v) ? v.toFixed(decimals) : '–');
  const single = $derived(needles.length === 1 ? needles[0] : undefined);
  // Thick needles first so a thin one is never hidden underneath.
  const drawOrder = $derived([...needles].sort((a, b) => (b.width ?? 3) - (a.width ?? 3)));
</script>

<figure class="gauge" class:side>
  <div class="face">
  <svg viewBox="0 0 200 200" role="img" aria-label="{label}: {needles.map((n) => `${n.name ? `${n.name} ` : ''}${fmt(n.value)} ${unit}`).join(', ')}">
    <defs>
      <linearGradient id="face-{uid}" x1="0.1" y1="0" x2="0.9" y2="1">
        <stop offset="0%" stop-color="#fff" stop-opacity="0.16" />
        <stop offset="55%" stop-color="#fff" stop-opacity="0.05" />
        <stop offset="100%" stop-color="#fff" stop-opacity="0.09" />
      </linearGradient>
    </defs>

    <!-- frosted disc with a fine rim -->
    <circle cx={C} cy={C} r="97" fill="url(#face-{uid})" stroke="rgb(255 255 255 / 0.28)" stroke-width="1" />

    <!-- track, red zone, value arc -->
    <path class="track" d={arcPath(C, C, R, angle(min), angle(max))} />
    {#if redline !== undefined}
      <path class="redline" d={arcPath(C, C, R, angle(redline), angle(max))} />
    {/if}
    {#if single && shown(single.value)}
      <path class="sweep" stroke={single.colour} d={arcPath(C, C, R, angle(min), angle(single.value))} />
    {/if}

    <!-- ticks and numerals, inside the track -->
    {#each scale as t (t.value)}
      {@const a = angle(t.value)}
      {@const outer = polar(C, C, 72, a)}
      {@const inner = polar(C, C, t.major ? 64 : 68, a)}
      <line class="tick" class:major={t.major} x1={outer.x} y1={outer.y} x2={inner.x} y2={inner.y} />
      {#if t.major}
        {@const n = polar(C, C, 53, a)}
        <text class="num" x={n.x} y={n.y + 4} text-anchor="middle">{t.value}</text>
      {/if}
    {/each}

    <!-- targets: a small bright marker across the track -->
    {#each targets as tg, i (i)}
      {#if shown(tg.value)}
        {@const a = angle(tg.value)}
        {@const o = polar(C, C, 90, a)}
        {@const n = polar(C, C, 74, a)}
        <line class="target" x1={o.x} y1={o.y} x2={n.x} y2={n.y} stroke={tg.colour} />
      {/if}
    {/each}

    <!-- readout in the open bottom -->
    {#if single}
      <text class="value" x={C} y="160" text-anchor="middle">{fmt(single.value)}</text>
    {:else}
      {#each needles as n, i (i)}
        <text class="value two" x={C + (i === 0 ? -26 : 26)} y="158" text-anchor="middle" style="fill: {n.colour}">{fmt(n.value)}</text>
      {/each}
    {/if}
    <text class="unit" x={C} y="179" text-anchor="middle">{unit}</text>
  </svg>
  <!-- Needles are their own SVGs so the browser can turn them on the compositor: a transition on an SVG child costs main-thread style work every frame. -->
  {#each drawOrder as n, i (i)}
    <svg class="needle" class:idle={!shown(n.value)} viewBox="0 0 200 200" aria-hidden="true" style="transform: rotate({angle(shown(n.value) ? n.value : min)}deg)">
      <line x1={C} y1={C} x2={C} y2={C - 76} stroke={n.colour} stroke-width={(n.width ?? 3) * 0.5} stroke-linecap="round" />
      <circle cx={C} cy={C} r="4.5" class="hub" />
    </svg>
  {/each}
  </div>
  <figcaption>{label}</figcaption>
</figure>

<style>
  /* The dial fits whatever height its row gives it; the SVG keeps its
     aspect ratio and centres itself in the space. */
  .gauge {
    margin: 0;
    height: 100%;
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .face { flex: 1; min-height: 0; width: 100%; position: relative; }
  .face > svg { position: absolute; inset: 0; width: 100%; height: 100%; }
  .gauge.side { flex-direction: row; align-items: center; gap: 2px; }
  .gauge.side .face { flex: none; width: auto; height: 100%; aspect-ratio: 1; }
  /* Vertical label left of the dial, reading bottom to top, centred on the dial. */
  .gauge.side figcaption {
    order: -1;
    flex: none;
    margin: 0;
    line-height: 1.2;
    white-space: nowrap;
    writing-mode: vertical-rl;
    transform: rotate(180deg);
  }
  figcaption {
    margin-top: 2px;
    color: var(--paper-dim);
    font-size: var(--t-sm);
    font-weight: 600;
    letter-spacing: 0.02em;
  }

  text { font-family: var(--font); font-variant-numeric: tabular-nums; }
  .num { fill: var(--paper-faint); font-size: 11px; font-weight: 600; }
  .value { fill: var(--paper); font-size: 32px; font-weight: 700; letter-spacing: -0.02em; }
  .value.two { font-size: 20px; }
  .unit { fill: var(--paper-faint); font-size: 11px; font-weight: 500; }

  .track { fill: none; stroke: rgb(255 255 255 / 0.12); stroke-width: 3; stroke-linecap: round; }
  .redline { fill: none; stroke: var(--stop); stroke-width: 3; stroke-linecap: round; opacity: 0.4; }
  .sweep { fill: none; stroke-width: 5; stroke-linecap: round; opacity: 0.55; }
  .tick { stroke: rgb(238 243 239 / 0.22); stroke-width: 1; }
  .tick.major { stroke: rgb(238 243 239 / 0.5); stroke-width: 1.4; }
  .target { stroke-width: 3; stroke-linecap: round; }

  .face > svg.needle {
    pointer-events: none;
    transform-origin: 50% 50%;
    transition: transform 110ms linear;
    will-change: transform;
  }
  .needle.idle { opacity: 0.3; }
  .hub { fill: rgb(238 243 239 / 0.85); }
</style>
