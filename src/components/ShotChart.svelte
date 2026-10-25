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

  const PAD = { l: 48, r: 58, t: 14, b: 34 };
  const TEMP_SHARE = 0.32;

  const tMax = $derived.by(() => {
    const last = samples.at(-1)?.t ?? 0;
    return Math.max(10, Math.ceil((last + 1) / 5) * 5);
  });
  const weightMax = $derived.by(() => {
    const seen = samples.reduce((m, s) => Math.max(m, s.weight ?? 0), 0);
    return Math.max(10, Math.ceil((Math.max(seen, yieldTarget ?? 0) * 1.15) / 10) * 10);
  });
  const tempRange = $derived.by(() => {
    let lo = Infinity, hi = -Infinity;
    for (const s of samples) {
      for (const v of [s.waterTemp, s.puckTemp, s.targetWaterTemp, s.targetPuckTemp]) {
        if (v === undefined) continue;
        lo = Math.min(lo, v); hi = Math.max(hi, v);
      }
    }
    if (!Number.isFinite(lo)) return [85, 95] as const;
    const mid = (lo + hi) / 2;
    const half = Math.max(3, (hi - lo) / 2 + 1);
    return [Math.floor(mid - half), Math.ceil(mid + half)] as const;
  });

  // Gap between the two panels: roomy on a tall graph, tighter on a short one.
  const GAP = $derived(Math.round(Math.min(48, Math.max(22, (height - PAD.t - PAD.b) * 0.12))));
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

  /** SVG path with gaps where a value is missing. */
  function path(key: keyof ShotSample, y: (v: number) => number): string {
    let d = '';
    let pen = false;
    for (const s of samples) {
      const v = s[key];
      if (v === undefined || v === null) { pen = false; continue; }
      d += `${pen ? 'L' : 'M'}${x(s.t).toFixed(1)},${y(v as number).toFixed(1)}`;
      pen = true;
    }
    return d;
  }

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
    <text class="axis" x={PAD.l + plotW + 10} y={yWeight(weightMax) + 5}>{weightMax}g</text>
    {#if yieldTarget}
      <line class="yield" x1={PAD.l} x2={PAD.l + plotW} y1={yWeight(yieldTarget)} y2={yWeight(yieldTarget)} />
      <text class="axis weight-label" x={PAD.l + plotW + 10} y={yWeight(yieldTarget) + 5}>{yieldTarget}g</text>
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
    <path class="line target" stroke="var(--g-pressure)" d={path('targetPressure', yMain)} />
    <path class="line target" stroke="var(--g-flow)" d={path('targetFlow', yMain)} />
    <path class="line target thin" stroke="var(--g-water)" d={path('targetWaterTemp', yTemp)} />
    <path class="line target" stroke="var(--g-puck)" d={path('targetPuckTemp', yTemp)} />

    <!-- measured -->
    <path class="line" stroke="var(--g-weight)" stroke-width="3" d={path('weight', yWeight)} />
    <path class="line" stroke="var(--g-pressure)" stroke-width="4" d={path('pressure', yMain)} />
    <path class="line" stroke="var(--g-flow)" stroke-width="4" d={path('flow', yMain)} />
    <path class="line" stroke="var(--g-water)" stroke-width="2.5" d={path('waterTemp', yTemp)} />
    <path class="line" stroke="var(--g-puck)" stroke-width="6" d={path('puckTemp', yTemp)} />
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
  .chart { width: 100%; height: 100%; min-height: 160px; display: grid; grid-template-rows: minmax(0, 1fr) auto; }
  .plot { position: relative; min-height: 0; }
  svg { position: absolute; inset: 0; display: block; overflow: visible; }
  .grid { stroke: var(--g-grid); stroke-width: 1; }
  .axis { fill: var(--paper-faint); font-size: 14px; font-family: var(--font); }
  .weight-label { fill: var(--g-weight); }
  .yield { stroke: var(--g-weight); stroke-width: 1.5; stroke-dasharray: 2 6; opacity: 0.8; }
  .line { fill: none; stroke-linejoin: round; stroke-linecap: round; }
  .target { stroke-width: 2.5; stroke-dasharray: 8 7; opacity: 0.7; }
  .target.thin { stroke-width: 1.5; }

  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 28px;
    margin: 0;
    padding: 10px 0 0 48px;
    list-style: none;
    color: var(--paper-dim);
    font-size: var(--t-sm);
  }
  .legend li { display: flex; align-items: center; gap: 8px; }
  .legend i { display: block; width: 26px; height: 4px; border-radius: 2px; background: var(--c); }
  .legend .water i { height: 2.5px; }
  .legend .puck i { height: 7px; }
  .legend b { color: var(--paper); font-size: var(--t-md); font-weight: 650; }
</style>
