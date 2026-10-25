<script lang="ts">
  import { app } from '../state/app.svelte';
  import ShotChart from './ShotChart.svelte';
  import Gauge from './Gauge.svelte';
  import { tempDialRange } from '../lib/gauge';
  import { yieldProgress } from '../lib/shot';

  let { onClose }: { onClose: () => void } = $props();

  let stopping = $state(false);
  const steps = $derived(app.workflow.profile?.steps ?? []);
  const frame = $derived(app.machine.profileFrame ?? 0);
  const elapsed = $derived(app.shot.at(-1)?.t ?? 0);
  const yieldTarget = $derived(app.workflow.context?.targetYield || null);

  // Live dials. The machine zeroes the target of the pump it isn't using, so
  // 0 means "no target" here, same as on the graph.
  const m = $derived(app.machine);
  const activeTarget = (v: number | undefined) => (v ? v : null);
  const tempRange = $derived(tempDialRange(steps.map((s) => s.temperature)));

  // Cup weight towards the planned yield. Live while pouring; afterwards the
  // last recorded weight, so lifting the cup off the scale doesn't empty it.
  const cupWeight = $derived(app.shotActive ? app.weight : (app.shot.at(-1)?.weight ?? app.weight));
  const progress = $derived(yieldProgress(cupWeight, yieldTarget, app.shotActive ? app.weightFlow : null));

  $effect(() => { if (!app.shotActive) stopping = false; });

  async function stop() {
    stopping = true;
    try { await app.stop(); } catch { stopping = false; }
  }
</script>

<section class="shot" aria-label="Shot in progress">
  <header>
    <div class="what">
      <h2>{app.workflow.profile?.title ?? 'Espresso'}</h2>
      {#if app.workflow.context?.coffeeName}
        <p>{app.workflow.context.coffeeRoaster ? `${app.workflow.context.coffeeRoaster} ` : ''}{app.workflow.context.coffeeName}</p>
      {/if}
    </div>
    <div class="clock">{elapsed.toFixed(1)}<small>s</small></div>
    {#if app.shotActive}
      <button class="stop glass" onclick={stop} disabled={stopping}>{stopping ? 'Stopping…' : 'Stop'}</button>
    {:else}
      <button class="done glass solid" onclick={onClose}>Done</button>
    {/if}
  </header>

  {#if steps.length}
    <ol class="steps" aria-label="Profile steps">
      {#each steps as s, i (i)}
        <li class:current={app.shotActive && i === frame} class:past={i < frame || !app.shotActive && app.shot.length > 0}>{s.name}</li>
      {/each}
    </ol>
  {/if}

  {#if progress && yieldTarget}
    <div class="progress" role="progressbar" aria-label="Cup weight" aria-valuemin={0} aria-valuemax={yieldTarget} aria-valuenow={cupWeight ?? 0}>
      <div class="track well">
        <div class="fill" class:full={progress.fraction >= 1} style="width: {progress.fraction * 100}%"></div>
      </div>
      <p class="cup">
        <b>{(cupWeight ?? 0).toFixed(1)}</b> of {yieldTarget} g
        {#if progress.secondsLeft !== null}<span class="left">· about {Math.ceil(progress.secondsLeft)} s to go</span>{/if}
      </p>
    </div>
  {/if}

  {#if app.shotActive}
    <div class="dials" aria-label="Live readings">
      <Gauge label="Flow in" unit="ml/s" min={0} max={8} major={1} minor={2}
        needles={[{ value: m.flow, colour: 'var(--g-flow)', width: 3.2 }]}
        targets={[{ value: activeTarget(m.targetFlow), colour: 'var(--g-flow)' }]} />
      <Gauge label="Flow out" unit="g/s" min={0} max={8} major={1} minor={2}
        needles={[{ value: app.scaleConnected ? app.weightFlow : null, colour: 'var(--g-weight)', width: 3.2 }]} />
      <Gauge label="Pressure" unit="bar" min={0} max={12} major={2} minor={4} redline={10}
        needles={[{ value: m.pressure, colour: 'var(--g-pressure)', width: 3.2 }]}
        targets={[{ value: activeTarget(m.targetPressure), colour: 'var(--g-pressure)' }]} />
      <Gauge label="Water · Puck" unit="°C" min={tempRange[0]} max={tempRange[1]} major={5} minor={5}
        needles={[
          { name: 'Water', value: m.mixTemperature, colour: 'var(--g-water)', width: 2 },
          { name: 'Puck', value: m.groupTemperature, colour: 'var(--g-puck)', width: 4.2 },
        ]}
        targets={[
          { value: m.targetMixTemperature, colour: 'var(--g-water)' },
          { value: m.targetGroupTemperature, colour: 'var(--g-puck)' },
        ]} />
    </div>
  {/if}

  <div class="graph glass thick">
    <ShotChart samples={app.shot} {yieldTarget} />
  </div>
</section>

<style>
  .shot {
    position: fixed;
    inset: 0;
    z-index: 30;
    /* Its own copy of the page backdrop, so the full-screen view still has
       colour behind its glass. */
    background: inherit;
    background:
      radial-gradient(60vmax 48vmax at 4% -6%, rgb(64 170 160 / 0.5), transparent 62%),
      radial-gradient(52vmax 46vmax at 34% 112%, rgb(201 154 216 / 0.3), transparent 62%),
      radial-gradient(40vmax 34vmax at 100% 10%, rgb(242 179 61 / 0.22), transparent 60%),
      linear-gradient(165deg, #12313a, #0a181c 70%);
    animation: appear 220ms ease;
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 20px var(--gutter) 24px;
  }
  header { flex: none; display: flex; align-items: center; gap: 28px; }
  .what { flex: 1; min-width: 0; }
  h2 { font-size: var(--t-xl); font-weight: 700; letter-spacing: -0.01em; }
  .what p { color: var(--paper-dim); font-size: var(--t-md); }
  .clock { font-size: var(--t-xxl); font-weight: 700; letter-spacing: -0.02em; }
  .clock small { font-size: var(--t-md); color: var(--paper-dim); margin-left: 4px; }

  .stop, .done {
    min-width: 180px;
    min-height: 88px;
    border-radius: var(--radius-tile);
    font-size: var(--t-lg);
    font-weight: 700;
  }
  .stop {
    color: #2a0b07;
    background: linear-gradient(170deg, #ff8a7f, var(--stop));
    box-shadow: 0 16px 34px -12px rgb(255 107 94 / 0.7), inset 0 1px 0 rgb(255 255 255 / 0.55);
  }
  .stop:disabled { opacity: 0.6; }

  .steps {
    flex: none;
    display: flex;
    gap: 8px;
    margin: 0;
    padding: 0;
    list-style: none;
    overflow-x: auto;
  }
  .steps li {
    padding: 10px 18px;
    border-radius: var(--radius-pill);
    background: var(--well);
    box-shadow: var(--well-shadow);
    color: var(--paper-faint);
    white-space: nowrap;
  }
  .steps li.past { color: var(--paper-dim); }
  .steps li.current { background: linear-gradient(170deg, #fff, #dde9e5); color: var(--ink); font-weight: 650; box-shadow: 0 6px 16px -6px rgb(0 0 0 / 0.5); }

  .progress { flex: none; display: flex; align-items: center; gap: 20px; }
  .track {
    flex: 1;
    height: 30px;
    border-radius: var(--radius-pill);
    overflow: hidden;
    padding: 4px;
  }
  .fill {
    height: 100%;
    min-width: 22px;
    border-radius: var(--radius-pill);
    background: linear-gradient(90deg, color-mix(in srgb, var(--g-weight) 55%, transparent), var(--g-weight));
    box-shadow: 0 0 18px color-mix(in srgb, var(--g-weight) 60%, transparent), inset 0 1px 0 rgb(255 255 255 / 0.45);
    transition: width 120ms linear;
  }
  .fill.full { background: linear-gradient(90deg, color-mix(in srgb, var(--go) 55%, transparent), var(--go)); box-shadow: 0 0 18px rgb(143 211 192 / 0.6), inset 0 1px 0 rgb(255 255 255 / 0.45); }
  .cup { flex: none; min-width: 9.5em; color: var(--paper-dim); font-size: var(--t-md); white-space: nowrap; }
  .cup b { color: var(--paper); font-size: var(--t-lg); font-weight: 700; }
  .left { font-size: var(--t-sm); color: var(--paper-faint); }

  .dials {
    flex: none;
    height: clamp(150px, 25vh, 260px);
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    grid-template-rows: minmax(0, 1fr);
    gap: 12px;
    animation: appear 260ms ease;
  }

  @media (max-height: 760px) {
    .shot { gap: 12px; padding-top: 14px; }
    .dials { height: 21vh; }
  }

  .graph { flex: 1; min-height: 180px; display: flex; padding: 18px 20px 14px; border-radius: 34px; }
  .graph > :global(*) { flex: 1; }
  @keyframes appear { from { opacity: 0; transform: scale(1.01); } }
</style>
