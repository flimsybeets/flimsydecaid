<script lang="ts">
  import { app, gateway } from '../../state/app.svelte';
  import Stepper from '../../components/Stepper.svelte';
  import Choice from './Choice.svelte';
  import SaveStatus from './SaveStatus.svelte';
  import { Saver } from './saving.svelte';
  import { REFILL_MAX_MM, REFILL_MIN_MM } from '../../lib/water';
  import { machinePatch, parseMachineSettings, RANGES as R, type MachineSettings } from '../../lib/decaidSettings';
  import type { Workflow } from '../../api/types';

  // Machine settings need a connected machine; flush goes through
  // the workflow, which Decaid keeps even while the machine is off.
  const saver = new Saver();
  let m = $state<MachineSettings | null>(null);
  let mError = $state<string | null>(null);

  $effect(() => {
    gateway.getMachineSettings().then((r) => { m = parseMachineSettings(r); }, () => { mError = 'Connect the machine to change these.'; });
    return () => saver.flushAll();
  });

  const mq = saver.queue<MachineSettings>((p) => gateway.saveMachineSettings(machinePatch(p)));
  type Rinse = NonNullable<Workflow['rinseData']>;
  const rq = saver.queue<Rinse>((p) => app.saveWaterSettings({ rinseData: p }));

  const rinse = $derived(app.workflow.rinseData);
  function setRinse(k: keyof Rinse, v: number) {
    if (!rinse) return;
    app.workflow = { ...app.workflow, rinseData: { ...rinse, [k]: v } };
    rq.set({ [k]: v } as Partial<Rinse>);
  }
  function setM<K extends keyof MachineSettings>(k: K, v: MachineSettings[K]) {
    if (!m) return;
    m = { ...m, [k]: v };
    mq.set({ [k]: v } as Partial<MachineSettings>);
  }
</script>

<div class="pane-head"><SaveStatus {saver} /></div>

<section class="card glass frost">
  <h2>Water tank</h2>
  <p>The machine warns you to refill when the tank drops to this height.</p>
  <div class="grid">
    <Stepper label="Warn at" unit="mm" min={REFILL_MIN_MM} max={REFILL_MAX_MM} step={1}
      bind:value={() => (app.water && Number.isFinite(app.water.refillLevel) ? app.water.refillLevel : undefined), (v) => { if (v !== undefined) app.setWaterRefill(v); }}
      placeholder="…" disabled={!app.water || !Number.isFinite(app.water.refillLevel)} />
    <Stepper label="Tank heater" hint="0 = off" unit="°C" min={R.tankTemp.min} max={R.tankTemp.max} step={R.tankTemp.step}
      bind:value={() => m?.tankTemp, (v) => { if (v !== undefined) setM('tankTemp', v); }} disabled={!m} />
  </div>
  <p class="small">{app.water && Number.isFinite(app.water.currentLevel) ? `The tank is at ${Math.round(app.water.currentLevel)} mm now.` : 'Waiting for the machine.'} The tank heater keeps the water in the tank warm, so shots heat up faster.</p>
</section>

<section class="card glass frost">
  <h2>Flush</h2>
  <p>What runs when you press flush on the group head, or Rinse in Guide me.</p>
  {#if rinse}
    <div class="grid">
      <Stepper label="Temperature" unit="°C" min={R.rinseTemp.min} max={R.rinseTemp.max} step={R.rinseTemp.step}
        bind:value={() => rinse.targetTemperature, (v) => { if (v !== undefined) setRinse('targetTemperature', v); }} />
      <Stepper label="Time" unit="s" min={R.rinseDuration.min} max={R.rinseDuration.max} step={R.rinseDuration.step}
        bind:value={() => rinse.duration, (v) => { if (v !== undefined) setRinse('duration', v); }} />
      <Stepper label="Flow" unit="ml/s" decimals={1} min={R.rinseFlow.min} max={R.rinseFlow.max} step={R.rinseFlow.step}
        bind:value={() => rinse.flow, (v) => { if (v !== undefined) setRinse('flow', v); }} />
    </div>
  {:else}
    <p class="small">Waiting for Decaid.</p>
  {/if}
</section>

<section class="card glass frost">
  <h2>Steam and fan</h2>
  <p class="small">Steam and hot water have their own buttons in the bottom bar.</p>
  {#if mError}<p class="note">{mError}</p>{/if}
  <Choice label="Steam button" value={String(m?.steamPurgeMode ?? 0)} disabled={!m}
    options={[{ value: '0', label: 'Normal' }, { value: '1', label: 'Two-tap stop' }]}
    notes={{ '0': 'Steam stops with one tap.', '1': 'The steam button needs two taps to stop steaming.' }}
    onchange={(v) => setM('steamPurgeMode', Number(v))} />
  <div class="grid">
    <Stepper label="Fan comes on above" unit="°C" min={R.fan.min} max={R.fan.max} step={R.fan.step}
      bind:value={() => m?.fan, (v) => { if (v !== undefined) setM('fan', v); }} disabled={!m} />
  </div>
</section>
