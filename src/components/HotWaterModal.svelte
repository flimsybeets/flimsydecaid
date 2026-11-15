<script lang="ts">
  import { app, gateway } from '../state/app.svelte';
  import Modal from './Modal.svelte';
  import Stepper from './Stepper.svelte';
  import RunControl from './RunControl.svelte';
  import { parseAppSettings, RANGES as R } from '../lib/decaidSettings';

  // Hot water, from the bottom bar: a draft until Save, like Steam. Amount,
  // temperature, longest time and flow go out through the workflow
  // (hotWaterData); "stop by the scale" is Decaid's stopHotWaterAtWeight.
  let { onClose }: { onClose: () => void } = $props();

  // Filled from Decaid's workflow once it has loaded (right after a reload it may not have),
  // so Save and Start never write made-up defaults over the real settings.
  let temperature = $state<number | undefined>();
  let volume = $state<number | undefined>();
  let duration = $state<number | undefined>();
  let flow = $state<number | undefined>();
  let filled = false;
  $effect(() => {
    if (!app.loaded || filled) return;
    filled = true;
    const hot = app.workflow.hotWaterData;
    temperature = hot?.targetTemperature ?? 80;
    volume = hot?.volume ?? 120;
    duration = hot?.duration ?? 60;
    flow = hot?.flow ?? 6;
  });
  const complete = $derived(app.loaded && [temperature, volume, duration, flow].every((v) => v !== undefined));
  let byScale = $state<boolean | null>(null);
  let byScaleWas: boolean | null = null;
  let saving = $state(false);
  let error = $state<string | null>(null);

  $effect(() => {
    gateway.getAppSettings().then((r) => { byScale = byScaleWas = parseAppSettings(r).stopHotWaterAtWeight; }, () => {});
  });

  const presets = [70, 80, 93];

  async function persist() {
    if (!complete) throw new Error('fill in every setting first');
    await app.saveWaterSettings({ hotWaterData: { targetTemperature: temperature, volume, duration, flow } });
    if (byScale !== null && byScale !== byScaleWas) { await gateway.saveAppSettings({ stopHotWaterAtWeight: byScale }); byScaleWas = byScale; }
  }
  async function save() {
    saving = true;
    error = null;
    try {
      await persist();
      onClose();
    } catch (e) {
      error = `Hot water settings weren't saved: ${(e as Error).message}`;
    } finally {
      saving = false;
    }
  }
</script>

<Modal title="Hot water" {onClose}>
  <!-- Only when the group head starts it: otherwise Start below says it all, and the dialog must fit at 960×600. -->
  {#if app.ghc}<p class="intro">What comes out when you press hot water on the machine.</p>{/if}
  <div class="grid">
    <div class="temp">
      <Stepper label="Temperature" bind:value={temperature} min={R.hotWaterTemp.min} max={R.hotWaterTemp.max} step={R.hotWaterTemp.step} unit="°C" />
      <div class="presets">
        {#each presets as p (p)}
          <button class="glass" class:solid={temperature === p} class:active={temperature === p} onclick={() => (temperature = p)}>{p}°</button>
        {/each}
      </div>
    </div>
    <div class="temp">
      <Stepper label="Amount" bind:value={volume} min={R.hotWaterVolume.min} max={R.hotWaterVolume.max} step={R.hotWaterVolume.step} unit={byScale ? 'g' : 'ml'} />
      <button class="byscale glass" class:lit={byScale} class:on={byScale} role="switch" aria-checked={byScale ?? false} disabled={byScale === null} onclick={() => (byScale = !byScale)}>
        <span>Stop by the scale</span>
        <span class="state">{byScale ? 'On' : 'Off'}</span>
      </button>
    </div>
    <Stepper label="Longest time" bind:value={duration} min={R.hotWaterDuration.min} max={R.hotWaterDuration.max} step={R.hotWaterDuration.step} unit="s" />
    <Stepper label="Flow" bind:value={flow} min={R.hotWaterFlow.min} max={R.hotWaterFlow.max} step={R.hotWaterFlow.step} decimals={1} unit="ml/s" />
  </div>
  <p class="note">{byScale ? 'It tares first. Without a scale, the machine measures the amount itself.' : 'The machine measures the amount itself, and stops at the longest time.'}</p>

  <RunControl kind="hotWater" label="Start hot water" blocked={!app.loaded ? 'Waiting for Decaid.' : !complete ? 'Fill in every setting first.' : null} detail={complete ? `${volume} ${byScale ? 'g' : 'ml'} at ${temperature}°C${byScale ? ', stopped by the scale' : ''}.` : null} beforeStart={persist} onStarted={onClose} />

  {#if error}<p class="error" role="alert">{error}</p>{/if}

  {#snippet actions()}
    <button class="secondary glass" onclick={onClose}>Cancel</button>
    <button class="primary glass solid" onclick={save} disabled={saving || !complete || (!app.mock && !app.gatewayOnline)}>
      {saving ? 'Saving…' : 'Save hot water settings'}
    </button>
  {/snippet}
</Modal>

<style>
  .intro, .note { color: var(--paper-dim); }
  .note { font-size: var(--t-xs); margin-top: -6px; padding: 0 4px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; align-items: start; }
  .temp { display: grid; gap: 8px; }
  .presets { display: flex; gap: 6px; }
  .presets button { flex: 1; min-height: 40px; border-radius: var(--radius-pill); color: var(--paper-dim); }
  .presets button.active { color: var(--ink); font-weight: 650; }

  /* Under Amount, level with the temperature presets. */
  .byscale {
    display: flex; justify-content: space-between; align-items: center;
    min-height: 44px; padding: 0 5px 0 16px; border-radius: var(--radius-pill);
    font-weight: 600; color: var(--paper);
  }
  .byscale:disabled { opacity: 0.45; }
  .byscale .state {
    min-width: 64px; padding: 6px 0; text-align: center; border-radius: var(--radius-pill);
    background: var(--well); box-shadow: var(--well-shadow); color: var(--paper-dim);
    transition: background 180ms ease, color 180ms ease;
  }
  .byscale.on .state { background: var(--go); color: var(--cat-ink); }

  .error { color: var(--stop); }
  .primary, .secondary { min-height: var(--touch); padding: 0 21px; border-radius: var(--radius-control); font-weight: 650; }
  .primary:disabled { opacity: 0.5; }
  .secondary { color: var(--paper-dim); }

  @media (max-width: 640px) { .grid { grid-template-columns: 1fr; } }
</style>
