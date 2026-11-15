<script lang="ts">
  import { app } from '../state/app.svelte';
  import Modal from './Modal.svelte';
  import Stepper from './Stepper.svelte';
  import RunControl from './RunControl.svelte';
  import { RANGES as R } from '../lib/decaidSettings';

  // Flush, from the bottom bar: a draft until Save, like Steam and Hot water.
  // These settings go out through the workflow (rinseData) and are what runs
  // for the group head's flush button and Guide me's rinse step too.
  let { onClose }: { onClose: () => void } = $props();

  const rinse = app.workflow.rinseData;
  let temperature = $state<number | undefined>(rinse?.targetTemperature ?? 90);
  let duration = $state<number | undefined>(rinse?.duration ?? 5);
  let flow = $state<number | undefined>(rinse?.flow ?? 6);
  let saving = $state(false);
  let error = $state<string | null>(null);

  const persist = () => app.saveWaterSettings({ rinseData: { targetTemperature: temperature, duration, flow } });
  async function save() {
    saving = true;
    error = null;
    try {
      await persist();
      onClose();
    } catch (e) {
      error = `Flush settings weren't saved: ${(e as Error).message}`;
    } finally {
      saving = false;
    }
  }
</script>

<Modal title="Flush" {onClose}>
  <p class="intro">Rinses the group head: before a shot to heat it, after one to clean the screen.</p>
  <div class="grid">
    <Stepper label="Temperature" bind:value={temperature} min={R.rinseTemp.min} max={R.rinseTemp.max} step={R.rinseTemp.step} unit="°C" />
    <Stepper label="Time" bind:value={duration} min={R.rinseDuration.min} max={R.rinseDuration.max} step={R.rinseDuration.step} unit="s" />
    <Stepper label="Flow" bind:value={flow} min={R.rinseFlow.min} max={R.rinseFlow.max} step={R.rinseFlow.step} decimals={1} unit="ml/s" />
  </div>

  <RunControl kind="flush" label="Start flush" detail={duration ? `Runs for ${duration} s at ${temperature}°C.` : null} beforeStart={persist} onStarted={onClose} />

  {#if error}<p class="error" role="alert">{error}</p>{/if}

  {#snippet actions()}
    <button class="secondary glass" onclick={onClose}>Cancel</button>
    <button class="primary glass solid" onclick={save} disabled={saving || (!app.mock && !app.gatewayOnline)}>
      {saving ? 'Saving…' : 'Save flush settings'}
    </button>
  {/snippet}
</Modal>

<style>
  .intro { color: var(--paper-dim); }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; align-items: start; }
  .error { color: var(--stop); }
  .primary, .secondary { min-height: var(--touch); padding: 0 21px; border-radius: var(--radius-control); font-weight: 650; }
  .primary:disabled { opacity: 0.5; }
  .secondary { color: var(--paper-dim); }
  @media (max-width: 640px) { .grid { grid-template-columns: 1fr; } }
</style>
