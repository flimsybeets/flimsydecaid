<script lang="ts">
  import { app } from '../state/app.svelte';
  import ShotChart from './ShotChart.svelte';
  import Gauge from './Gauge.svelte';
  import { tempDialRange } from '../lib/gauge';

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
    gap: 12px;
    padding: 15px var(--gutter) 18px;
  }
  header { flex: none; display: flex; align-items: center; gap: 21px; }
  .what { flex: 1; min-width: 0; }
  h2 { font-size: var(--t-xl); font-weight: 700; letter-spacing: -0.01em; }
  .what p { color: var(--paper-dim); font-size: var(--t-md); }
  .clock { font-size: var(--t-xxl); font-weight: 700; letter-spacing: -0.02em; }
  .clock small { font-size: var(--t-md); color: var(--paper-dim); margin-left: 3px; }

  .stop, .done {
    min-width: 135px;
    min-height: 65px;
    border-radius: var(--radius-tile);
    font-size: var(--t-lg);
    font-weight: 700;
  }
  .stop {
    color: #2a0b07;
    background: linear-gradient(170deg, #ff8a7f, var(--stop));
    box-shadow: 0 12px 26px -12px rgb(255 107 94 / 0.7), inset 0 1px 0 rgb(255 255 255 / 0.55);
  }
  .stop:disabled { opacity: 0.6; }

  .steps {
    flex: none;
    display: flex;
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;
    overflow-x: auto;
  }
  .steps li {
    padding: 8px 14px;
    border-radius: var(--radius-pill);
    background: var(--well);
    box-shadow: var(--well-shadow);
    color: var(--paper-faint);
    white-space: nowrap;
  }
  .steps li.past { color: var(--paper-dim); }
  .steps li.current { background: linear-gradient(170deg, #fff, #dde9e5); color: var(--ink); font-weight: 650; box-shadow: 0 4px 12px -6px rgb(0 0 0 / 0.5); }

  .dials {
    flex: none;
    height: clamp(112px, 25vh, 195px);
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    grid-template-rows: minmax(0, 1fr);
    gap: 9px;
    animation: appear 260ms ease;
  }

  @media (max-height: 760px) {
    .shot { gap: 9px; padding-top: 10px; }
    .dials { height: 21vh; }
  }

  .graph { flex: 1; min-height: 135px; display: flex; padding: 14px 15px 10px; border-radius: 26px; }
  .graph > :global(*) { flex: 1; }
  @keyframes appear { from { opacity: 0; transform: scale(1.01); } }
</style>
