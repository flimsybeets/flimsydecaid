<script lang="ts">
  import { app } from '../state/app.svelte';
  import ShotChart from './ShotChart.svelte';

  let { onClose }: { onClose: () => void } = $props();

  let stopping = $state(false);
  const steps = $derived(app.workflow.profile?.steps ?? []);
  const frame = $derived(app.machine.profileFrame ?? 0);
  const elapsed = $derived(app.shot.at(-1)?.t ?? 0);
  const yieldTarget = $derived(app.workflow.context?.targetYield || null);

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
      <button class="stop" onclick={stop} disabled={stopping}>{stopping ? 'Stopping…' : 'Stop'}</button>
    {:else}
      <button class="done" onclick={onClose}>Done</button>
    {/if}
  </header>

  {#if steps.length}
    <ol class="steps" aria-label="Profile steps">
      {#each steps as s, i (i)}
        <li class:current={app.shotActive && i === frame} class:past={i < frame || !app.shotActive && app.shot.length > 0}>{s.name}</li>
      {/each}
    </ol>
  {/if}

  <div class="graph">
    <ShotChart samples={app.shot} {yieldTarget} />
  </div>
</section>

<style>
  .shot {
    position: fixed;
    inset: 0;
    z-index: 30;
    background: var(--ink);
    display: grid;
    grid-template-rows: auto auto 1fr;
    gap: 16px;
    padding: 20px var(--gutter) 24px;
  }
  header { display: flex; align-items: center; gap: 28px; }
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
  .stop { background: var(--stop); color: #2a0b07; }
  .stop:disabled { opacity: 0.6; }
  .done { background: var(--paper); color: var(--ink); }

  .steps {
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
    background: var(--ink-raised);
    color: var(--paper-faint);
    white-space: nowrap;
  }
  .steps li.past { color: var(--paper-dim); }
  .steps li.current { background: var(--paper); color: var(--ink); font-weight: 650; }

  .graph { min-height: 0; }
</style>
