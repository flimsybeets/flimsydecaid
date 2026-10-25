<script lang="ts">
  import { app } from '../state/app.svelte';
  import { heaterOn } from '../lib/steam';

  let { onSteam }: { onSteam: () => void } = $props();

  const scaleName = $derived(app.scaleDevice?.name ?? 'Scale');
  const steamIsOn = $derived(heaterOn(app.steam));
  const steamTemp = $derived(app.machine.steamTemperature);
  const steamReady = $derived(steamIsOn && steamTemp !== undefined && app.steam && steamTemp >= app.steam.targetTemperature - 5);

  function onScaleTap() {
    if (app.scaleConnected) void app.tare();
    else app.scanForScale();
  }
</script>

<footer class="glass">
  <button class="scale well" class:off={!app.scaleConnected} onclick={onScaleTap}>
    <span class="label">
      <span class="dot" aria-hidden="true"></span>
      {app.scaleConnected ? scaleName : app.scanning ? 'Looking for scale…' : 'No scale'}
      {#if app.scaleConnected && app.scaleBattery !== null}
        <span class="battery">{app.scaleBattery}%</span>
      {/if}
    </span>
    {#if app.scaleConnected}
      <span class="weight">{app.weight === null ? '–' : app.weight.toFixed(1)}<small>g</small></span>
      <span class="action">Tap to tare</span>
    {:else}
      <span class="action">Tap to connect</span>
    {/if}
  </button>

  <div class="temps" aria-label="Group temperatures">
    <span class="t water"><i aria-hidden="true"></i>Water {app.machine.mixTemperature?.toFixed(1) ?? '–'}°</span>
    <span class="t puck"><i aria-hidden="true"></i>Puck {app.machine.groupTemperature?.toFixed(1) ?? '–'}°</span>
  </div>

  <button class="steam glass" class:solid={steamIsOn} class:on={steamIsOn} onclick={onSteam} aria-haspopup="dialog">
    <span class="label">Steam</span>
    <span class="value">
      {#if steamIsOn}
        {steamTemp !== undefined ? `${Math.round(steamTemp)}°` : 'On'}
        <small>{steamReady ? 'ready' : `heating to ${app.steam?.targetTemperature}°`}</small>
      {:else}
        Off
      {/if}
    </span>
  </button>
</footer>

<style>
  /* Floating glass dock, inset from the screen edges. */
  /* Out of the way while typing, so forms get the room. */
  :global(html.kb-open) footer { display: none; }

  footer {
    display: grid;
    grid-template-columns: minmax(280px, 1fr) auto minmax(220px, auto);
    align-items: stretch;
    gap: 12px;
    margin: 10px var(--gutter) 14px;
    padding: 10px;
    border-radius: 34px;
    z-index: 5;
  }

  .scale, .steam {
    display: flex;
    align-items: center;
    gap: 18px;
    min-height: 66px;
    padding: 0 22px;
    border-radius: 24px;
    text-align: left;
  }
  .scale:active { background: rgb(4 14 17 / 0.5); }

  .label {
    display: flex;
    align-items: center;
    gap: 10px;
    color: var(--paper-dim);
    font-size: var(--t-sm);
  }
  .dot { width: 10px; height: 10px; border-radius: 50%; background: var(--go); box-shadow: 0 0 10px var(--go); }
  .scale.off .dot { background: var(--paper-faint); box-shadow: none; }
  .battery { color: var(--paper-faint); }

  .weight {
    font-size: var(--t-xl);
    font-weight: 650;
    letter-spacing: -0.01em;
    min-width: 4.2ch;
  }
  .weight small, .value small { font-size: var(--t-sm); font-weight: 500; color: var(--paper-dim); margin-left: 4px; }
  .action { margin-left: auto; color: var(--paper-faint); font-size: var(--t-xs); }

  .temps {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 6px;
    padding: 0 12px;
    font-size: var(--t-sm);
    color: var(--paper-dim);
  }
  .t { display: flex; align-items: center; gap: 10px; }
  .t i { display: block; width: 22px; border-radius: 2px; }
  .water i { height: 3px; background: var(--g-water); }
  .puck i { height: 6px; background: var(--g-puck); }

  .steam { justify-content: space-between; }
  .steam .value { font-size: var(--t-lg); font-weight: 650; color: var(--paper-faint); }
  .steam.on .label, .steam.on .value small { color: #3c5559; }
  .steam.on .value { color: var(--ink); }

  @media (max-width: 900px) {
    footer { grid-template-columns: 1fr auto; }
    .temps { display: none; }
  }
</style>
