<script lang="ts">
  import { app, gateway } from '../../state/app.svelte';
  import Stepper from '../../components/Stepper.svelte';
  import Choice from './Choice.svelte';
  import Switch from './Switch.svelte';
  import SaveStatus from './SaveStatus.svelte';
  import { Saver } from './saving.svelte';
  import { REFILL_MAX_MM, REFILL_MIN_MM } from '../../lib/water';
  import { machinePatch, parseMachineSettings, RANGES as R, type MachineSettings } from '../../lib/decaidSettings';

  // Machine settings need a connected machine. Flush, steam and hot water
  // have their own buttons (and settings) in the bottom bar.
  const saver = new Saver();
  let m = $state<MachineSettings | null>(null);
  let mError = $state<string | null>(null);

  $effect(() => {
    gateway.getMachineSettings().then((r) => { m = parseMachineSettings(r); }, () => { mError = 'Connect the machine to change these.'; });
    return () => saver.flushAll();
  });

  const mq = saver.queue<MachineSettings>((p) => gateway.saveMachineSettings(machinePatch(p)));
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
  <h2>Steam and fan</h2>
  <p class="small">Flush, hot water and steam have their own buttons in the bottom bar, with their settings.</p>
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

<section class="card glass frost">
  <h2>Group head controller</h2>
  <Switch label="Act as if there's no group head controller" on={app.imitateNoGhc} onchange={(v) => app.setImitateNoGhc(v)}
    note={app.imitateNoGhc
      ? 'The skin shows Start shot, and Start on flush, hot water and steam, as on a machine without one. If your machine ignores a start from the tablet, use the group head as usual.'
      : app.machineGhc
        ? 'This machine has a group head controller, so the skin leaves starting to the group head. Turn this on to get the Start buttons on the tablet too.'
        : 'This machine has no group head controller, so the Start buttons already show.'} />
</section>

