<script lang="ts">
  import type { ShotSample } from '../lib/shot';

  // Two stacked panels sharing a time axis:
  //   top    pressure (green), flow (blue), weight (brown, own scale)
  //   bottom temperatures: water entering the group (thin coral) and the
  //          group/puck sensor (thick gold). Targets are dashed.
  // Temperatures get their own panel and their own °C axis so a 1° swing
  // is visible instead of being flattened against a 0–12 bar scale.

  let { samples, yieldTarget = null }: { samples: ShotSample[]; yieldTarget?: number | null } = $props();

  let width = $state(800);
  let height = $state(480);

  const PAD = { l: 38, r: 48, t: 12, b: 28 };
  const TEMP_SHARE = 0.32;

  // One walk over the samples for everything that needs a maximum or range
  // (the live graph calls this about ten times a second).
  const stats = $derived.by(() => {
    let weight = 0, lo = Infinity, hi = -Infinity;
    for (const s of samples) {
      if (s.weight !== undefined && s.weight > weight) weight = s.weight;
      for (const v of [s.waterTemp, s.puckTemp, s.targetWaterTemp, s.targetPuckTemp]) {
        if (v === undefined) continue;
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
    }
    return { last: samples.at(-1)?.t ?? 0, weight, lo, hi };
  });
  const tMax = $derived(Math.max(10, Math.ceil((stats.last + 1) / 5) * 5));
  // Weight has its own scale. With a target, the target sits near the top
  // (above the usual 9 bar of pressure) like a finish line the weight climbs
  // to; an overshoot stretches the scale so nothing is clipped.
  const weightMax = $derived.by(() => {
    const seen = stats.weight;
    if (yieldTarget) return Math.max(yieldTarget / 0.92, seen * 1.04);
    return Math.max(10, Math.ceil((seen * 1.15) / 10) * 10);
  });
  const tempRange = $derived.by(() => {
    const { lo, hi } = stats;
    if (!Number.isFinite(lo)) return [85, 95] as const;
    const mid = (lo + hi) / 2;
    const half = Math.max(3, (hi - lo) / 2 + 1);
    return [Math.floor(mid - half), Math.ceil(mid + half)] as const;
  });

  // Gap between the two panels: roomy on a tall graph, tighter on a short one.
  const GAP = $derived(Math.round(Math.min(38, Math.max(18, (height - PAD.t - PAD.b) * 0.12))));
  const plotW = $derived(Math.max(10, width - PAD.l - PAD.r));
  const innerH = $derived(Math.max(10, height - PAD.t - PAD.b - GAP));
  const mainH = $derived(innerH * (1 - TEMP_SHARE));
  const tempH = $derived(innerH * TEMP_SHARE);
  const mainTop = PAD.t;
  const tempTop = $derived(PAD.t + mainH + GAP);

  const x = (t: number) => PAD.l + (t / tMax) * plotW;
  const yMain = (v: number) => mainTop + mainH - (Math.min(12, Math.max(0, v)) / 12) * mainH;
  const yWeight = (v: number) => mainTop + mainH - (Math.max(0, v) / weightMax) * mainH;
  const yTemp = (v: number) => tempTop + tempH - ((v - tempRange[0]) / (tempRange[1] - tempRange[0])) * tempH;

  type Series = [key: keyof ShotSample, y: (v: number) => number];
  const SERIES = $derived<Record<'tp' | 'tf' | 'tw' | 'tpk' | 'w' | 'p' | 'f' | 'wt' | 'pk', Series>>({
    tp: ['targetPressure', yMain], tf: ['targetFlow', yMain], tw: ['targetWaterTemp', yTemp], tpk: ['targetPuckTemp', yTemp],
    w: ['weight', yWeight], p: ['pressure', yMain], f: ['flow', yMain], wt: ['waterTemp', yTemp], pk: ['puckTemp', yTemp],
  });

  /** Every series' SVG path, in one pass over the samples, with gaps where a value is missing. */
  const paths = $derived.by(() => {
    const names = Object.keys(SERIES) as (keyof typeof SERIES)[];
    const d = Object.fromEntries(names.map((n) => [n, ''])) as Record<keyof typeof SERIES, string>;
    const pen = Object.fromEntries(names.map((n) => [n, false])) as Record<keyof typeof SERIES, boolean>;
    for (const s of samples) {
      const px = x(s.t).toFixed(1);
      for (const n of names) {
        const [key, y] = SERIES[n];
        const v = s[key];
        if (v === undefined || v === null) { pen[n] = false; continue; }
        d[n] += `${pen[n] ? 'L' : 'M'}${px},${y(v as number).toFixed(1)}`;
        pen[n] = true;
      }
    }
    return d;
  });

  const timeTicks = $derived(Array.from({ length: Math.floor(tMax / 5) + 1 }, (_, i) => i * 5));
  const tempTicks = $derived.by(() => {
    const [lo, hi] = tempRange;
    // Keep labels at least ~22px apart however short the panel is.
    const step = [1, 2, 5, 10].find((st) => (tempH / (hi - lo)) * st >= 22) ?? 10;
    const out: number[] = [];
    for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) out.push(v);
    return out;
  });

  const last = $derived(samples.at(-1));
</script>

<div class="chart">
  <div class="plot" bind:clientWidth={width} bind:clientHeight={height}>
  <svg {width} {height} role="img" aria-label="Shot graph">
    <!-- grid: main panel -->
    {#each [0, 3, 6, 9, 12] as v (v)}
      <line class="grid" x1={PAD.l} x2={PAD.l + plotW} y1={yMain(v)} y2={yMain(v)} />
      <text class="axis" x={PAD.l - 10} y={yMain(v) + 5} text-anchor="end">{v}</text>
    {/each}
    {#if !yieldTarget}<text class="axis" x={PAD.l + plotW + 10} y={yWeight(weightMax) + 5}>{weightMax}g</text>{/if}
    {#if yieldTarget}
      <!-- The weight the shot is working up to: a bold dashed finish line with its value in a pill. -->
      {@const yy = yWeight(yieldTarget)}
      <line class="yield" x1={PAD.l} x2={PAD.l + plotW} y1={yy} y2={yy} />
      <g class="yield-pill">
        <rect x={PAD.l + plotW + 4} y={yy - 11} width={PAD.r - 2} height="22" rx="11" />
        <text x={PAD.l + plotW + 4 + (PAD.r - 2) / 2} y={yy + 4} text-anchor="middle">{yieldTarget} g</text>
      </g>
    {/if}

    <!-- grid: temperature panel -->
    {#each tempTicks as v (v)}
      <line class="grid" x1={PAD.l} x2={PAD.l + plotW} y1={yTemp(v)} y2={yTemp(v)} />
      <text class="axis" x={PAD.l - 10} y={yTemp(v) + 5} text-anchor="end">{v}°</text>
    {/each}

    <!-- time axis -->
    {#each timeTicks as t (t)}
      <text class="axis" x={x(t)} y={height - 8} text-anchor="middle">{t}s</text>
    {/each}

    <!-- targets (dashed) -->
    <path class="line target" stroke="var(--g-pressure)" d={paths.tp} />
    <path class="line target" stroke="var(--g-flow)" d={paths.tf} />
    <path class="line target thin" stroke="var(--g-water)" d={paths.tw} />
    <path class="line target" stroke="var(--g-puck)" d={paths.tpk} />

    <!-- measured -->
    <path class="line" stroke="var(--g-weight)" stroke-width="1.8" d={paths.w} />
    <path class="line" stroke="var(--g-pressure)" stroke-width="2.4" d={paths.p} />
    <path class="line" stroke="var(--g-flow)" stroke-width="2.4" d={paths.f} />
    <path class="line" stroke="var(--g-water)" stroke-width="1.4" d={paths.wt} />
    <path class="line" stroke="var(--g-puck)" stroke-width="3.4" d={paths.pk} />
  </svg>
  </div>

  <ul class="legend" aria-label="Live readings">
    <li style="--c: var(--g-pressure)"><i></i>Pressure <b>{last?.pressure?.toFixed(1) ?? '–'}</b> bar</li>
    <li style="--c: var(--g-flow)"><i></i>Flow <b>{last?.flow?.toFixed(1) ?? '–'}</b> ml/s</li>
    <li style="--c: var(--g-weight)"><i></i>Weight <b>{last?.weight?.toFixed(1) ?? '–'}</b> g</li>
    <li class="water" style="--c: var(--g-water)"><i></i>Water <b>{last?.waterTemp?.toFixed(1) ?? '–'}</b>°</li>
    <li class="puck" style="--c: var(--g-puck)"><i></i>Puck <b>{last?.puckTemp?.toFixed(1) ?? '–'}</b>°</li>
  </ul>
</div>

<style>
  .chart { width: 100%; height: 100%; min-height: 120px; contain: layout paint; display: grid; grid-template-rows: minmax(0, 1fr) auto; }
  .plot { position: relative; min-height: 0; }
  svg { position: absolute; inset: 0; display: block; overflow: visible; }
  .grid { stroke: var(--g-grid); stroke-width: 1; }
  .axis { fill: var(--paper-faint); font-size: 11px; font-family: var(--font); }
  .yield { stroke: var(--g-weight); stroke-width: 2; stroke-dasharray: 10 7; }
  .yield-pill rect { fill: var(--g-weight); }
  .yield-pill text { fill: #23140a; font-family: var(--font); font-size: 11px; font-weight: 700; }
  .line { fill: none; stroke-linejoin: round; stroke-linecap: round; }
  .target { stroke-width: 1.5; stroke-dasharray: 7 6; opacity: 0.7; }
  .target.thin { stroke-width: 1; }

  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 21px;
    margin: 0;
    padding: 8px 0 0 36px;
    list-style: none;
    color: var(--paper-dim);
    font-size: var(--t-sm);
  }
  .legend li { display: flex; align-items: center; gap: 6px; }
  .legend i { display: block; width: 20px; height: 2.5px; border-radius: 2px; background: var(--c); }
  .legend .water i { height: 1.5px; }
  .legend .puck i { height: 3.5px; }
  .legend b { color: var(--paper); font-size: var(--t-md); font-weight: 650; }
</style>
