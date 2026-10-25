<script lang="ts">
  import { arcPath, polar, ticks, valueToAngle } from '../lib/gauge';

  // An automotive-style round dial: numbered ticks, glowing needle(s) that
  // sweep smoothly between the ~10 Hz readings, dashed target markers, and a
  // digital readout in the open bottom of the dial.

  interface Needle { value: number | null | undefined; colour: string; width?: number; name?: string }
  interface Target { value: number | null | undefined; colour: string }

  let {
    label, unit, min, max, major, minor = 2, needles, targets = [], decimals = 1, redline,
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

<figure class="gauge">
  <svg viewBox="0 0 200 200" role="img" aria-label="{label}: {needles.map((n) => `${n.name ? `${n.name} ` : ''}${fmt(n.value)} ${unit}`).join(', ')}">
    <defs>
      <radialGradient id="face-{uid}" cx="50%" cy="38%" r="62%">
        <stop offset="0%" stop-color="#1d3d46" />
        <stop offset="70%" stop-color="#0c1d22" />
        <stop offset="100%" stop-color="#060f12" />
      </radialGradient>
      <linearGradient id="bezel-{uid}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="rgb(255 255 255 / 0.75)" />
        <stop offset="35%" stop-color="rgb(255 255 255 / 0.12)" />
        <stop offset="65%" stop-color="rgb(255 255 255 / 0.05)" />
        <stop offset="100%" stop-color="rgb(255 255 255 / 0.35)" />
      </linearGradient>
      <linearGradient id="glass-{uid}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="rgb(255 255 255 / 0.16)" />
        <stop offset="45%" stop-color="rgb(255 255 255 / 0)" />
      </linearGradient>
    </defs>

    <!-- face and bezel -->
    <circle cx={C} cy={C} r="96" fill="url(#face-{uid})" />
    <circle cx={C} cy={C} r="96" fill="none" stroke="url(#bezel-{uid})" stroke-width="2.5" />
    <circle cx={C} cy={C} r="90" fill="none" stroke="rgb(0 0 0 / 0.5)" stroke-width="1" />

    <!-- track, red zone, live sweep -->
    <path class="track" d={arcPath(C, C, R, angle(min), angle(max))} />
    {#if redline !== undefined}
      <path class="redline" d={arcPath(C, C, R, angle(redline), angle(max))} />
    {/if}
    {#if single && shown(single.value)}
      <path class="sweep" stroke={single.colour} d={arcPath(C, C, R, angle(min), angle(single.value))} />
    {/if}

    <!-- ticks and numerals -->
    {#each scale as t (t.value)}
      {@const a = angle(t.value)}
      {@const outer = polar(C, C, 89, a)}
      {@const inner = polar(C, C, t.major ? 72 : 82, a)}
      <line class="tick" class:major={t.major} x1={outer.x} y1={outer.y} x2={inner.x} y2={inner.y} />
      {#if t.major}
        {@const n = polar(C, C, 60, a)}
        <text class="num" x={n.x} y={n.y + 4.5} text-anchor="middle">{t.value}</text>
      {/if}
    {/each}

    <!-- targets: a notch on the rim and a dashed line across the track -->
    {#each targets as tg, i (i)}
      {#if shown(tg.value)}
        {@const a = angle(tg.value)}
        {@const tip = polar(C, C, 86, a)}
        {@const l = polar(C, C, 94, a - 4)}
        {@const r = polar(C, C, 94, a + 4)}
        {@const d0 = polar(C, C, 88, a)}
        {@const d1 = polar(C, C, 68, a)}
        <g class="target">
          <line x1={d0.x} y1={d0.y} x2={d1.x} y2={d1.y} stroke={tg.colour} />
          <path d="M{tip.x},{tip.y} L{l.x},{l.y} L{r.x},{r.y} Z" fill={tg.colour} />
        </g>
      {/if}
    {/each}

    <!-- needles -->
    {#each drawOrder as n, i (i)}
      {@const w = n.width ?? 3}
      <g class="needle" class:idle={!shown(n.value)} style="transform: rotate({angle(shown(n.value) ? n.value : min)}deg); --c: {n.colour}">
        <path d="M{C - w},{C + 14} L{C - w * 0.35},{C - 76} L{C},{C - 80} L{C + w * 0.35},{C - 76} L{C + w},{C + 14} Z" fill={n.colour} />
      </g>
    {/each}
    <circle cx={C} cy={C} r="10" class="hub" />
    <circle cx={C} cy={C} r="3.5" fill="rgb(255 255 255 / 0.5)" />

    <!-- glass reflection over the top half -->
    <path d="M{C - 92},{C} A92,92 0 0 1 {C + 92},{C} Q{C},{C - 26} {C - 92},{C} Z" fill="url(#glass-{uid})" pointer-events="none" />

    <!-- digital readout in the open bottom -->
    {#if single}
      <text class="value" x={C} y="162" text-anchor="middle">{fmt(single.value)}</text>
    {:else}
      {#each needles as n, i (i)}
        <text class="value two" x={C + (i === 0 ? -25 : 25)} y="160" text-anchor="middle" style="fill: {n.colour}">{fmt(n.value)}</text>
      {/each}
    {/if}
    <text class="unit" x={C} y="181" text-anchor="middle">{unit}</text>
  </svg>
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
  svg {
    flex: 1;
    min-height: 0;
    width: 100%;
    overflow: visible;
    filter: drop-shadow(0 14px 22px rgb(0 0 0 / 0.45));
  }
  figcaption {
    margin-top: 2px;
    color: var(--paper-dim);
    font-size: var(--t-sm);
    font-weight: 600;
    letter-spacing: 0.02em;
  }

  text { font-family: var(--font); font-variant-numeric: tabular-nums; }
  .num { fill: var(--paper-dim); font-size: 13px; font-weight: 600; }
  .value { fill: var(--paper); font-size: 30px; font-weight: 700; letter-spacing: -0.02em; }
  .value.two { font-size: 19px; }
  .unit { fill: var(--paper-faint); font-size: 12px; font-weight: 500; }

  .track { fill: none; stroke: rgb(255 255 255 / 0.09); stroke-width: 7; }
  .redline { fill: none; stroke: var(--stop); stroke-width: 7; opacity: 0.55; }
  .sweep { fill: none; stroke-width: 7; opacity: 0.6; }
  .tick { stroke: rgb(238 243 239 / 0.35); stroke-width: 1.2; }
  .tick.major { stroke: var(--paper); stroke-width: 2.4; }
  .target line { stroke-width: 2; stroke-dasharray: 3.5 3; }

  .needle {
    transform-origin: 100px 100px;
    transition: transform 110ms linear;
    filter: drop-shadow(0 0 4px var(--c));
  }
  .needle.idle { opacity: 0.35; filter: none; }
  .hub { fill: #0b1a1e; stroke: rgb(255 255 255 / 0.35); stroke-width: 1.2; }
</style>
