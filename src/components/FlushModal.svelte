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

  // Filled from Decaid's workflow once it has loaded (right after a reload it may not have),
  // so Save and Start never write made-up defaults over the real settings.
  let temperature = $state<number | undefined>();
  let duration = $state<number | undefined>();
  let flow = $state<number | undefined>();
  let filled = false;
  $effect(() => {
    if (!app.loaded || filled) return;
    filled = true;
    const rinse = app.workflow.rinseData;
    temperature = rinse?.targetTemperature ?? 90;
    duration = rinse?.duration ?? 5;
    flow = rinse?.flow ?? 6;
  });
  const complete = $derived(app.loaded && [temperature, duration, flow].every((v) => v !== undefined));
  let saving = $state(false);
  let error = $state<string | null>(null);

  async function persist() {
    if (!complete) throw new Error('fill in every setting first');
    await app.saveWaterSettings({ rinseData: { targetTemperature: temperature, duration, flow } });
  }
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

  <RunControl kind="flush" label="Start flush" blocked={!app.loaded ? 'Waiting for Decaid.' : !complete ? 'Fill in every setting first.' : null} detail={complete ? `Runs for ${duration} s at ${temperature}°C.` : null} beforeStart={persist} onStarted={onClose} />

  {#if error}<p class="error" role="alert">{error}</p>{/if}

  {#snippet actions()}
    <button class="secondary glass" onclick={onClose}>Cancel</button>
    <button class="primary glass solid" onclick={save} disabled={saving || !complete || (!app.mock && !app.gatewayOnline)}>
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
