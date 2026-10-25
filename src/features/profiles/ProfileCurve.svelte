<script lang="ts">
  import type { ProfileStep } from '../../api/types';
  import type { ShotSample } from '../../lib/shot';
  import { exitText, profileCurve, type CurveSegment } from '../../lib/profileEdit';

  // What the profile asks for, step by step: pressure and flow targets (with
  // smooth ramps), exit thresholds and limiters, and step temperatures in
  // their own lane underneath, like the shot graph. Each step is a column; tap one to edit it. Optionally
  // the last real shot with this profile is drawn faintly behind.

  let {
    steps,
    selected,
    onselect,
    overlay = [],
  }: {
    steps: ProfileStep[];
    selected: number;
    onselect: (index: number) => void;
    overlay?: ShotSample[];
  } = $props();

  let width = $state(900);
  let height = $state(300);
  const PAD = { l: 44, r: 16, t: 34, b: 30 };

  const curve = $derived(profileCurve(steps));
  const shotEnd = $derived(overlay.at(-1)?.t ?? 0);
  const tMax = $derived(Math.max(10, curve.total, shotEnd));
  const tStep = $derived(tMax > 90 ? 20 : tMax > 40 ? 10 : 5);
  const temps = $derived(steps.map((s) => s.temperature));
  const tempRange = $derived.by(() => {
    const lo = Math.min(...temps), hi = Math.max(...temps);
    const mid = (lo + hi) / 2;
    const half = Math.max(5, (hi - lo) / 2 + 2);
    return [Math.floor(mid - half), Math.ceil(mid + half)] as const;
  });

  const plotW = $derived(Math.max(10, width - PAD.l - PAD.r));
  const plotH = $derived(Math.max(10, height - PAD.t - PAD.b));
  const LANE_GAP = 22;
  const tempH = $derived(Math.max(28, plotH * 0.24));
  const mainH = $derived(plotH - tempH - LANE_GAP);
  const tempTop = $derived(PAD.t + mainH + LANE_GAP);
  const x = (t: number) => PAD.l + (t / tMax) * plotW;
  const y = (v: number) => PAD.t + mainH - (Math.min(12, Math.max(0, v)) / 12) * mainH;
  const yT = (v: number) => tempTop + tempH - ((v - tempRange[0]) / (tempRange[1] - tempRange[0])) * tempH;

  /** One path per run of steps on the same pump; the line breaks where control switches. */
  function targetPath(pump: 'pressure' | 'flow'): string {
    let d = '';
    let prev: CurveSegment | null = null;
    for (const s of curve.segments) {
      if (s.pump !== pump) { prev = null; continue; }
      d += `${prev ? 'L' : 'M'}${x(s.t0).toFixed(1)},${y(s.from).toFixed(1)}L${x(s.t1).toFixed(1)},${y(s.to).toFixed(1)}`;
      prev = s;
    }
    return d;
  }

  function overlayPath(key: 'pressure' | 'flow'): string {
    let d = '';
    let pen = false;
    for (const s of overlay) {
      const v = s[key];
      if (v === undefined) { pen = false; continue; }
      d += `${pen ? 'L' : 'M'}${x(s.t).toFixed(1)},${y(v).toFixed(1)}`;
      pen = true;
    }
    return d;
  }

  const ticks = $derived(Array.from({ length: Math.floor(tMax / tStep) + 1 }, (_, i) => i * tStep));
  const tempTicks = $derived.by(() => {
    const [lo, hi] = tempRange;
    // Keep labels at least ~18px apart in the lane.
    const step = [1, 2, 5, 10, 20].find((s) => (tempH / (hi - lo)) * s >= 18) ?? 20;
    const out: number[] = [];
    for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) out.push(v);
    return out;
  });
  const colour = (pump: 'pressure' | 'flow') => (pump === 'pressure' ? 'var(--g-pressure)' : 'var(--g-flow)');
</script>

<div class="curve" bind:clientWidth={width} bind:clientHeight={height}>
  <svg {width} {height} role="img" aria-label="Profile shape: {steps.length} steps over {curve.total} seconds">
    <!-- step columns (tap targets) -->
    {#each curve.segments as s (s.index)}
      {@const x0 = x(s.t0)}
      {@const w = Math.max(6, x(s.t1) - x0)}
      <g class="col" class:sel={s.index === selected} role="button" tabindex="-1" aria-label="Step {s.index + 1}"
        onpointerdown={() => onselect(s.index)}>
        <rect x={x0} y={PAD.t - 26} width={w} height={plotH + 26} class="band" class:odd={s.index % 2 === 1} />
        {#if s.index === selected}<rect x={x0} y={PAD.t - 26} width={w} height="3" class="sel-bar" />{/if}
        <text class="name" x={x0 + 8} y={PAD.t - 9}>{#if w > 34}{s.index + 1} {w > 90 ? steps[s.index]?.name : ''}{:else}{s.index + 1}{/if}</text>
      </g>
    {/each}

    <!-- grid -->
    {#each [0, 3, 6, 9, 12] as v (v)}
      <line class="grid" x1={PAD.l} x2={PAD.l + plotW} y1={y(v)} y2={y(v)} />
      <text class="axis" x={PAD.l - 10} y={y(v) + 5} text-anchor="end">{v}</text>
    {/each}
    {#each tempTicks as v (v)}
      <line class="grid" x1={PAD.l} x2={PAD.l + plotW} y1={yT(v)} y2={yT(v)} />
      <text class="axis" x={PAD.l - 10} y={yT(v) + 5} text-anchor="end">{v}°</text>
    {/each}
    {#each ticks as t (t)}
      <text class="axis" x={x(t)} y={height - 8} text-anchor="middle">{t}s</text>
    {/each}

    <!-- last real shot, faint -->
    {#if overlay.length}
      <path class="ghost" stroke="var(--g-pressure)" d={overlayPath('pressure')} />
      <path class="ghost" stroke="var(--g-flow)" d={overlayPath('flow')} />
    {/if}

    <!-- temperatures, per step, on their own scale -->
    {#each curve.segments as s (s.index)}
      <line class="temp" class:water={s.sensor === 'water'} x1={x(s.t0)} x2={x(s.t1)} y1={yT(s.temperature)} y2={yT(s.temperature)} />
    {/each}

    <!-- limiters and exit thresholds -->
    {#each steps as st, i (i)}
      {@const s = curve.segments[i]}
      {#if s}
        {#if st.limiter && st.limiter.value > 0}
          <line class="limit" stroke={colour(st.pump === 'pressure' ? 'flow' : 'pressure')} x1={x(s.t0)} x2={x(s.t1)} y1={y(st.limiter.value)} y2={y(st.limiter.value)} />
        {/if}
        {#if st.exit && st.exit.value > 0}
          {@const ey = y(st.exit.value)}
          <g class="exit">
            <line stroke={colour(st.exit.type)} x1={x(s.t0)} x2={x(s.t1)} y1={ey} y2={ey} />
            <text x={x(s.t1) - 6} y={st.exit.condition === 'over' ? ey - 6 : ey + 15} text-anchor="end" fill={colour(st.exit.type)}>{exitText(st.exit)}</text>
          </g>
        {/if}
      {/if}
    {/each}

    <!-- targets -->
    <path class="target" stroke="var(--g-pressure)" d={targetPath('pressure')} />
    <path class="target" stroke="var(--g-flow)" d={targetPath('flow')} />
  </svg>
</div>

<style>
  .curve { position: relative; width: 100%; height: 100%; min-height: 0; }
  svg { position: absolute; inset: 0; display: block; overflow: visible; touch-action: manipulation; }
  .col { cursor: pointer; }
  .band { fill: transparent; }
  .band.odd { fill: rgb(255 255 255 / 0.025); }
  .col.sel .band { fill: rgb(255 255 255 / 0.09); }
  .sel-bar { fill: var(--paper); }
  .name { fill: var(--paper-faint); font-family: var(--font); font-size: 13px; font-weight: 600; pointer-events: none; }
  .col.sel .name { fill: var(--paper); }
  .grid { stroke: var(--g-grid); stroke-width: 1; }
  .axis { fill: var(--paper-faint); font-family: var(--font); font-size: 13px; }
  .target { fill: none; stroke-width: 4; stroke-linejoin: round; stroke-linecap: round; pointer-events: none; }
  .ghost { fill: none; stroke-width: 2; opacity: 0.35; pointer-events: none; }
  .temp { stroke: var(--g-puck); stroke-width: 4; stroke-linecap: round; opacity: 0.85; pointer-events: none; }
  .temp.water { stroke: var(--g-water); stroke-width: 2; }
  .limit { stroke-width: 2; stroke-dasharray: 2 5; opacity: 0.8; pointer-events: none; }
  .exit line { stroke-width: 1.5; stroke-dasharray: 6 5; pointer-events: none; }
  .exit text { font-family: var(--font); font-size: 12px; font-weight: 700; pointer-events: none; }
</style>
