<script lang="ts">
  import { app, gateway } from '../state/app.svelte';
  import Modal from './Modal.svelte';
  import Stepper from './Stepper.svelte';
  import { parseAppSettings, RANGES as R } from '../lib/decaidSettings';

  // Hot water, from the bottom bar: a draft until Save, like Steam. Amount,
  // temperature, longest time and flow go out through the workflow
  // (hotWaterData); "stop by the scale" is Decaid's stopHotWaterAtWeight.
  let { onClose }: { onClose: () => void } = $props();

  const hot = app.workflow.hotWaterData;
  let temperature = $state<number | undefined>(hot?.targetTemperature ?? 80);
  let volume = $state<number | undefined>(hot?.volume ?? 120);
  let duration = $state<number | undefined>(hot?.duration ?? 60);
  let flow = $state<number | undefined>(hot?.flow ?? 6);
  let byScale = $state<boolean | null>(null);
  let byScaleWas: boolean | null = null;
  let saving = $state(false);
  let error = $state<string | null>(null);

  $effect(() => {
    gateway.getAppSettings().then((r) => { byScale = byScaleWas = parseAppSettings(r).stopHotWaterAtWeight; }, () => {});
  });

  const presets = [70, 80, 93];

  async function save() {
    saving = true;
    error = null;
    try {
      await app.saveWaterSettings({ hotWaterData: { targetTemperature: temperature, volume, duration, flow } });
      if (byScale !== null && byScale !== byScaleWas) await gateway.saveAppSettings({ stopHotWaterAtWeight: byScale });
      onClose();
    } catch (e) {
      error = `Hot water settings weren't saved: ${(e as Error).message}`;
    } finally {
      saving = false;
    }
  }
</script>

<Modal title="Hot water" {onClose}>
  <p class="intro">What comes out when you press hot water on the machine.</p>
  <div class="grid">
    <div class="temp">
      <Stepper label="Temperature" bind:value={temperature} min={R.hotWaterTemp.min} max={R.hotWaterTemp.max} step={R.hotWaterTemp.step} unit="°C" />
      <div class="presets">
        {#each presets as p (p)}
          <button class="glass" class:solid={temperature === p} class:active={temperature === p} onclick={() => (temperature = p)}>{p}°</button>
        {/each}
      </div>
    </div>
    <Stepper label="Amount" bind:value={volume} min={R.hotWaterVolume.min} max={R.hotWaterVolume.max} step={R.hotWaterVolume.step} unit={byScale ? 'g' : 'ml'} />
    <Stepper label="Longest time" bind:value={duration} min={R.hotWaterDuration.min} max={R.hotWaterDuration.max} step={R.hotWaterDuration.step} unit="s" />
    <Stepper label="Flow" bind:value={flow} min={R.hotWaterFlow.min} max={R.hotWaterFlow.max} step={R.hotWaterFlow.step} decimals={1} unit="ml/s" />
  </div>

  <button class="byscale glass" class:lit={byScale} class:on={byScale} role="switch" aria-checked={byScale ?? false} disabled={byScale === null} onclick={() => (byScale = !byScale)}>
    <span>Stop by the scale</span>
    <span class="state">{byScale ? 'On' : 'Off'}</span>
  </button>
  <p class="note">{byScale ? 'With a scale connected, it tares and stops when the cup holds the amount above. Without one, the machine stops at its own measure.' : 'The machine stops at its own measure of the amount, or at the longest time.'}</p>

  {#if error}<p class="error" role="alert">{error}</p>{/if}

  {#snippet actions()}
    <button class="secondary glass" onclick={onClose}>Cancel</button>
    <button class="primary glass solid" onclick={save} disabled={saving || (!app.mock && !app.gatewayOnline)}>
      {saving ? 'Saving…' : 'Save hot water settings'}
    </button>
  {/snippet}
</Modal>

<style>
  .intro, .note { color: var(--paper-dim); }
  .note { font-size: var(--t-xs); margin-top: -8px; padding: 0 4px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; align-items: start; }
  .temp { display: grid; gap: 8px; }
  .presets { display: flex; gap: 6px; }
  .presets button { flex: 1; min-height: 40px; border-radius: var(--radius-pill); color: var(--paper-dim); }
  .presets button.active { color: var(--ink); font-weight: 650; }

  .byscale {
    display: flex; justify-content: space-between; align-items: center;
    min-height: 56px; padding: 0 12px 0 18px; border-radius: 18px;
    font-size: var(--t-md); font-weight: 600; color: var(--paper);
  }
  .byscale:disabled { opacity: 0.45; }
  .byscale .state {
    min-width: 72px; padding: 8px 0; text-align: center; border-radius: var(--radius-pill);
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
