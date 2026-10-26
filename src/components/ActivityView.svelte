<script lang="ts">
  import { app } from '../state/app.svelte';
  import { clockText, progress, type ActivityKind } from '../lib/activity';

  // Full-screen view while the machine flushes or steams. It is mounted by
  // App only while the machine is in that state, so it appears when the
  // machine's own button is pressed and goes away on its own when it ends.

  let { kind }: { kind: ActivityKind } = $props();

  const startedAt = Date.now();
  let now = $state(Date.now());
  $effect(() => {
    const t = setInterval(() => (now = Date.now()), 100);
    return () => clearInterval(t);
  });
  const elapsed = $derived((now - startedAt) / 1000);

  const m = $derived(app.machine);
  const steam = $derived(app.workflow.steamSettings);
  const rinse = $derived(app.workflow.rinseData);
  // Planned run time: the rinse time, or steam's maximum run time.
  const planned = $derived(kind === 'flush' ? rinse?.duration : steam?.duration);
  const used = $derived(progress(elapsed, planned));

  let stopping = $state(false);
  async function stop() {
    stopping = true;
    try { await app.stop(); } catch { stopping = false; }
  }
</script>

<section class="act {kind}" aria-label={kind === 'flush' ? 'Flushing' : 'Steaming'}>
  <header>
    <h2>{kind === 'flush' ? 'Flushing' : 'Steaming'}</h2>
    <div class="clock">
      {clockText(elapsed)}{#if planned}<small> of {clockText(planned)}</small>{/if}
    </div>
    <button class="stop glass" onclick={stop} disabled={stopping}>{stopping ? 'Stopping…' : 'Stop'}</button>
  </header>

  <div class="panel glass thick" role="status">
    <div class="bar" aria-hidden="true"><div class="fill" style="transform: scaleX({used ?? 0})"></div></div>
    {#if kind === 'flush'}
      <div class="reads">
        <div class="r"><span class="lab">Flow</span><b>{m.flow?.toFixed(1) ?? '–'}<small>ml/s</small></b></div>
        <div class="r"><span class="lab">Water</span><b>{m.mixTemperature?.toFixed(1) ?? '–'}<small>°C</small></b>
          <span class="target">{rinse?.targetTemperature ? `target ${rinse.targetTemperature}°` : ''}</span></div>
        <div class="r"><span class="lab">Group</span><b>{m.groupTemperature?.toFixed(1) ?? '–'}<small>°C</small></b></div>
      </div>
    {:else}
      <div class="reads">
        <div class="r"><span class="lab">Steam</span><b>{m.steamTemperature !== undefined ? Math.round(m.steamTemperature) : '–'}<small>°C</small></b>
          <span class="target">{steam && steam.targetTemperature > 0 ? `target ${steam.targetTemperature}°` : ''}</span></div>
        <div class="r"><span class="lab">Steam flow</span><b>{steam?.flow?.toFixed(1) ?? '–'}<small>ml/s</small></b></div>
      </div>
    {/if}
  </div>
</section>

<style>
  .act {
    position: fixed;
    inset: 0;
    z-index: 30;
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 15px var(--gutter) 18px;
    background:
      radial-gradient(60vmax 48vmax at 4% -6%, rgb(64 170 160 / 0.5), transparent 62%),
      radial-gradient(52vmax 46vmax at 34% 112%, rgb(201 154 216 / 0.3), transparent 62%),
      radial-gradient(40vmax 34vmax at 100% 10%, rgb(242 179 61 / 0.22), transparent 60%),
      linear-gradient(165deg, #12313a, #0a181c 70%);
    animation: appear 220ms ease;
  }
  header { flex: none; display: flex; align-items: center; gap: 21px; }
  h2 { flex: 1; font-size: var(--t-xxl); font-weight: 750; letter-spacing: -0.02em; }
  .clock { font-size: var(--t-xxl); font-weight: 700; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
  .clock small { font-size: var(--t-md); color: var(--paper-dim); font-weight: 500; }
  .stop {
    min-width: 135px;
    min-height: 65px;
    border-radius: var(--radius-tile);
    font-size: var(--t-lg);
    font-weight: 700;
    color: #2a0b07;
    background: linear-gradient(170deg, #ff8a7f, var(--stop));
    box-shadow: 0 12px 26px -12px rgb(255 107 94 / 0.7), inset 0 1px 0 rgb(255 255 255 / 0.55);
  }
  .stop:disabled { opacity: 0.6; }

  .panel { flex: 1; min-height: 0; display: grid; align-content: center; gap: 28px; padding: 24px; border-radius: 26px; }
  .bar { height: 12px; border-radius: var(--radius-pill); background: var(--well); box-shadow: var(--well-shadow); overflow: hidden; }
  .fill { height: 100%; width: 100%; transform-origin: left; background: var(--accent, var(--g-flow)); transition: transform 120ms linear; }
  .steam { --accent: var(--cat-2, #f2b33d); }
  .reads { display: flex; justify-content: center; gap: 56px; flex-wrap: wrap; }
  .r { display: grid; gap: 2px; justify-items: center; }
  .lab { color: var(--paper-dim); font-size: var(--t-sm); }
  .r b { font-size: var(--t-xxl); font-weight: 700; font-variant-numeric: tabular-nums; }
  .r b small { font-size: var(--t-md); color: var(--paper-dim); font-weight: 500; margin-left: 3px; }
  .target { color: var(--paper-faint); font-size: var(--t-sm); min-height: 1.2em; }
  @keyframes appear { from { opacity: 0; transform: scale(1.01); } }
</style>
