<script lang="ts">
  import { gateway } from '../../state/app.svelte';
  import { resolveGateway } from '../../api/config';
  import { EDITION } from '../../edition';
  import Stepper from '../../components/Stepper.svelte';
  import ConfirmDialog from '../../components/ConfirmDialog.svelte';
  import Switch from './Switch.svelte';
  import Choice from './Choice.svelte';
  import SaveStatus from './SaveStatus.svelte';
  import { Saver } from './saving.svelte';
  import {
    parseAdvanced, parseAppSettings, RANGES as R, voltageLabel,
    type AdvancedSettings, type AppSettings, type GatewayMode, type LogLevel,
  } from '../../lib/decaidSettings';

  // Settings most people never touch. Heater and calibration need a connected machine.
  const saver = new Saver();
  let adv = $state<AdvancedSettings | null>(null);
  let flow = $state<number | null>(null);
  let a = $state<AppSettings | null>(null);
  let machineError = $state<string | null>(null);
  let resetting = $state(false);

  function load() {
    gateway.getAdvancedMachineSettings().then((r) => { adv = parseAdvanced(r); machineError = null; }, () => { machineError = 'Connect the machine to change these.'; });
    gateway.getFlowCalibration().then((r) => { const v = (r as { flowMultiplier?: unknown })?.flowMultiplier; flow = typeof v === 'number' ? v : 1; }, () => {});
    gateway.getAppSettings().then((r) => { a = parseAppSettings(r); }, () => {});
  }
  $effect(() => { load(); return () => saver.flushAll(); });

  const advq = saver.queue<AdvancedSettings>((p) => gateway.saveAdvancedMachineSettings(p as Record<string, unknown>));
  const flowq = saver.queue<{ flowMultiplier: number }>((p) => gateway.saveFlowCalibration(p.flowMultiplier!));
  const aq = saver.queue<AppSettings>((p) => gateway.saveAppSettings(p as Record<string, unknown>));
  function setAdv<K extends keyof AdvancedSettings>(k: K, v: AdvancedSettings[K]) {
    if (!adv) return;
    adv = { ...adv, [k]: v };
    advq.set({ [k]: v } as Partial<AdvancedSettings>);
  }
  function setA<K extends keyof AppSettings>(k: K, v: AppSettings[K]) {
    if (!a) return;
    a = { ...a, [k]: v };
    aq.set({ [k]: v } as Partial<AppSettings>);
  }

  const LEVELS: LogLevel[] = ['SEVERE', 'WARNING', 'INFO', 'CONFIG', 'FINE', 'FINER', 'FINEST', 'ALL', 'OFF', 'SHOUT'];
  const decaidSettings = `${resolveGateway().httpBase}/api/v1/plugins/settings.reaplugin/ui?backName=${encodeURIComponent(EDITION.name)}`;
</script>

<div class="pane-head"><SaveStatus {saver} /></div>

<section class="card glass frost">
  <h2>Heater</h2>
  <p class="small">How the machine warms the group before a shot. Leave these alone unless you know you need to change them.</p>
  {#if machineError}<p class="note">{machineError}</p>{/if}
  <div class="grid">
    <Stepper label="Warm-up flow, first phase" unit="ml/s" decimals={1} min={R.heaterPh1Flow.min} max={R.heaterPh1Flow.max} step={R.heaterPh1Flow.step}
      bind:value={() => adv?.heaterPh1Flow, (v) => { if (v !== undefined) setAdv('heaterPh1Flow', v); }} disabled={!adv} />
    <Stepper label="Warm-up flow, second phase" unit="ml/s" decimals={1} min={R.heaterPh2Flow.min} max={R.heaterPh2Flow.max} step={R.heaterPh2Flow.step}
      bind:value={() => adv?.heaterPh2Flow, (v) => { if (v !== undefined) setAdv('heaterPh2Flow', v); }} disabled={!adv} />
    <Stepper label="Second phase, at most" unit="s" min={R.heaterPh2Timeout.min} max={R.heaterPh2Timeout.max} step={R.heaterPh2Timeout.step}
      bind:value={() => adv?.heaterPh2Timeout, (v) => { if (v !== undefined) setAdv('heaterPh2Timeout', v); }} disabled={!adv} />
    <Stepper label="Idle heater temperature" unit="°C" decimals={1} min={R.heaterIdleTemp.min} max={R.heaterIdleTemp.max} step={R.heaterIdleTemp.step}
      bind:value={() => adv?.heaterIdleTemp, (v) => { if (v !== undefined) setAdv('heaterIdleTemp', v); }} disabled={!adv} />
  </div>
  {#if adv}<p class="small">Mains voltage: {voltageLabel(adv.heaterVoltage)}.</p>{/if}
</section>

<section class="card glass frost">
  <h2>Water and flow</h2>
  <Choice label="Refill kit" value={String(adv?.refillKitSetting ?? 2)} disabled={!adv}
    options={[{ value: '2', label: 'Auto' }, { value: '1', label: 'Always on' }, { value: '0', label: 'Always off' }]}
    notes={{ '2': 'The machine finds out whether a refill kit is fitted.', '1': 'Treat the machine as plumbed in with a refill kit.', '0': 'Treat the machine as using its tank only.' }}
    onchange={(v) => setAdv('refillKitSetting', Number(v) as 0 | 1 | 2)} />
  <div class="grid">
    <Stepper label="Flow calibration" hint="1.00 = factory" decimals={2} min={R.flowMultiplier.min} max={R.flowMultiplier.max} step={R.flowMultiplier.step}
      bind:value={() => flow ?? undefined, (v) => { if (v !== undefined) { flow = v; flowq.set({ flowMultiplier: v }); } }} disabled={flow === null || !!machineError} />
  </div>
  <p class="small">If the machine's flow reading is off from what lands in the cup, nudge this. Below 1 reads lower, above 1 higher.</p>
</section>

{#if a}
  <section class="card glass frost">
    <h2>Decaid</h2>
    <Choice label="Who runs the shot" value={a.gatewayMode}
      options={[{ value: 'disabled', label: 'Decaid' }, { value: 'tracking', label: 'Decaid, no graphs' }, { value: 'full', label: 'The skin' }] as { value: GatewayMode; label: string }[]}
      notes={{ disabled: 'Decaid runs shots and stops them at weight (the normal setting for this skin).', tracking: 'Decaid still stops shots at weight but doesn’t draw its own graphs.', full: 'Decaid steps back and a skin controls everything. This skin doesn’t do that, so stop-at-weight would stop working.' }}
      onchange={(v) => setA('gatewayMode', v)} />
    <Switch label="Check for Decaid updates" on={a.automaticUpdateCheck} onchange={(v) => setA('automaticUpdateCheck', v)}
      note="Decaid looks for a new version of itself every 12 hours." />
    <label class="select">
      <span>Log detail</span>
      <select class="well" value={a.logLevel} onchange={(e) => setA('logLevel', e.currentTarget.value as LogLevel)}>
        {#each LEVELS as l (l)}<option value={l}>{l}</option>{/each}
      </select>
    </label>
  </section>
{/if}

<section class="card glass frost">
  <h2>More</h2>
  <p class="small">Connecting devices, firmware, data export and plugins are in Decaid's own settings.</p>
  <div class="row">
    <a class="button glass" href={decaidSettings}>Open Decaid settings</a>
    <button class="button glass danger" disabled={!!machineError} onclick={() => (resetting = true)}>Reset machine settings</button>
  </div>
</section>

{#if resetting}
  <ConfirmDialog title="Reset machine settings?" action="Reset"
    message="Puts the fan, heater, refill kit and steam button settings back to their defaults. Profiles, flow calibration and everything else stay as they are."
    onConfirm={async () => { await gateway.resetMachineSettings(); load(); }} onClose={() => (resetting = false)} />
{/if}

<style>
  .select { display: grid; gap: 6px; justify-items: start; color: var(--paper-dim); font-size: var(--t-sm); }
  select { min-height: var(--touch); padding: 0 14px; border-radius: var(--radius-control); color: var(--paper); font-size: var(--t-md); background: transparent; }
  .danger { color: var(--stop); }
</style>
