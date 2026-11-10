<script lang="ts">
  import { app, gateway } from '../../state/app.svelte';
  import Stepper from '../../components/Stepper.svelte';
  import Switch from './Switch.svelte';
  import Choice from './Choice.svelte';
  import SaveStatus from './SaveStatus.svelte';
  import { Saver } from './saving.svelte';
  import { REFILL_MAX_MM, REFILL_MIN_MM } from '../../lib/water';
  import { machinePatch, parseAppSettings, parseMachineSettings, RANGES as R, type AppSettings, type MachineSettings } from '../../lib/decaidSettings';
  import type { Workflow } from '../../api/types';

  // Machine settings need a connected machine; hot water and flush go through
  // the workflow, which Decaid keeps even while the machine is off.
  const saver = new Saver();
  let m = $state<MachineSettings | null>(null);
  let mError = $state<string | null>(null);
  let a = $state<AppSettings | null>(null);

  $effect(() => {
    gateway.getMachineSettings().then((r) => { m = parseMachineSettings(r); }, () => { mError = 'Connect the machine to change these.'; });
    gateway.getAppSettings().then((r) => { a = parseAppSettings(r); }, () => {});
    return () => saver.flushAll();
  });

  const mq = saver.queue<MachineSettings>((p) => gateway.saveMachineSettings(machinePatch(p)));
  const aq = saver.queue<AppSettings>((p) => gateway.saveAppSettings(p as Record<string, unknown>));
  type Hot = NonNullable<Workflow['hotWaterData']>;
  type Rinse = NonNullable<Workflow['rinseData']>;
  const hq = saver.queue<Hot>((p) => app.saveWaterSettings({ hotWaterData: p }));
  const rq = saver.queue<Rinse>((p) => app.saveWaterSettings({ rinseData: p }));

  const hot = $derived(app.workflow.hotWaterData);
  const rinse = $derived(app.workflow.rinseData);
  function setHot(k: keyof Hot, v: number) {
    if (!hot) return;
    app.workflow = { ...app.workflow, hotWaterData: { ...hot, [k]: v } };
    hq.set({ [k]: v } as Partial<Hot>);
  }
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
  function setA<K extends keyof AppSettings>(k: K, v: AppSettings[K]) {
    if (!a) return;
    a = { ...a, [k]: v };
    aq.set({ [k]: v } as Partial<AppSettings>);
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
  <h2>Hot water</h2>
  {#if hot}
    <div class="grid">
      <Stepper label="Temperature" unit="°C" min={R.hotWaterTemp.min} max={R.hotWaterTemp.max} step={R.hotWaterTemp.step}
        bind:value={() => hot.targetTemperature, (v) => { if (v !== undefined) setHot('targetTemperature', v); }} />
      <Stepper label="Amount" unit="ml" min={R.hotWaterVolume.min} max={R.hotWaterVolume.max} step={R.hotWaterVolume.step}
        bind:value={() => hot.volume, (v) => { if (v !== undefined) setHot('volume', v); }} />
      <Stepper label="Longest time" unit="s" min={R.hotWaterDuration.min} max={R.hotWaterDuration.max} step={R.hotWaterDuration.step}
        bind:value={() => hot.duration, (v) => { if (v !== undefined) setHot('duration', v); }} />
      <Stepper label="Flow" unit="ml/s" decimals={1} min={R.hotWaterFlow.min} max={R.hotWaterFlow.max} step={R.hotWaterFlow.step}
        bind:value={() => hot.flow, (v) => { if (v !== undefined) setHot('flow', v); }} />
    </div>
  {:else}
    <p class="small">Waiting for Decaid.</p>
  {/if}
  {#if a}
    <Switch label="Stop at the amount on the scale" on={a.stopHotWaterAtWeight} onchange={(v) => setA('stopHotWaterAtWeight', v)}
      note="With a scale connected, it tares and stops when the cup holds the amount above (in grams). The machine's own limit still applies." />
    {#if a.stopHotWaterAtWeight}
      <div class="grid">
        <Stepper label="Stop early by" unit="s" decimals={2} min={R.hotWaterFlowMultiplier.min} max={R.hotWaterFlowMultiplier.max} step={R.hotWaterFlowMultiplier.step}
          bind:value={() => a?.hotWaterFlowMultiplier, (v) => { if (v !== undefined) setA('hotWaterFlowMultiplier', v); }} />
      </div>
    {/if}
  {/if}
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
  <h2>Steam and machine</h2>
  <p class="small">Steam temperature and flow are on the Steam button in the bottom bar.</p>
  {#if mError}<p class="note">{mError}</p>{/if}
  <Choice label="Steam button" value={String(m?.steamPurgeMode ?? 0)} disabled={!m}
    options={[{ value: '0', label: 'Normal' }, { value: '1', label: 'Two-tap stop' }]}
    notes={{ '0': 'Steam stops with one tap.', '1': 'The steam button needs two taps to stop steaming.' }}
    onchange={(v) => setM('steamPurgeMode', Number(v))} />
  <div class="grid">
    <Stepper label="Fan comes on above" unit="°C" min={R.fan.min} max={R.fan.max} step={R.fan.step}
      bind:value={() => m?.fan, (v) => { if (v !== undefined) setM('fan', v); }} disabled={!m} />
  </div>
  <Switch label="USB charging port" on={m?.usb ?? false} disabled={!m} onchange={(v) => setM('usb', v)}
    note="Powers the tablet from the machine's USB port. Decaid can switch it for you under Tablet → Charging." />
</section>
