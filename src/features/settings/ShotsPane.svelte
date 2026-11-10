<script lang="ts">
  import { gateway } from '../../state/app.svelte';
  import Stepper from '../../components/Stepper.svelte';
  import Switch from './Switch.svelte';
  import Choice from './Choice.svelte';
  import SaveStatus from './SaveStatus.svelte';
  import { Saver } from './saving.svelte';
  import { parseAppSettings, RANGES as R, type AppSettings, type ScalePowerMode } from '../../lib/decaidSettings';

  const saver = new Saver();
  let a = $state<AppSettings | null>(null);
  let error = $state<string | null>(null);
  $effect(() => {
    gateway.getAppSettings().then((r) => { a = parseAppSettings(r); }, (e) => { error = `Couldn't read Decaid's settings: ${(e as Error).message}`; });
    return () => saver.flushAll();
  });
  const q = saver.queue<AppSettings>((p) => gateway.saveAppSettings(p as Record<string, unknown>));
  function set<K extends keyof AppSettings>(k: K, v: AppSettings[K]) {
    if (!a) return;
    a = { ...a, [k]: v };
    q.set({ [k]: v } as Partial<AppSettings>);
  }
</script>

<div class="pane-head"><SaveStatus {saver} /></div>
{#if error}<p class="error">{error}</p>{/if}

{#if a}
  <section class="card glass frost">
    <h2>Stopping on time</h2>
    <p>Coffee keeps dripping after the pump stops, so Decaid stops a little early. If shots land heavy, raise these; if light, lower them.</p>
    <div class="grid">
      <Stepper label="Weight look-ahead" hint="1.0 = normal" decimals={1} min={R.weightFlowMultiplier.min} max={R.weightFlowMultiplier.max} step={R.weightFlowMultiplier.step}
        bind:value={() => a?.weightFlowMultiplier, (v) => { if (v !== undefined) set('weightFlowMultiplier', v); }} />
      <Stepper label="Volume look-ahead" unit="s" decimals={2} min={R.volumeFlowMultiplier.min} max={R.volumeFlowMultiplier.max} step={R.volumeFlowMultiplier.step}
        bind:value={() => a?.volumeFlowMultiplier, (v) => { if (v !== undefined) set('volumeFlowMultiplier', v); }} />
    </div>
  </section>

  <section class="card glass frost">
    <h2>Scale</h2>
    <Switch label="Only start shots with a scale" on={a.blockOnNoScale} onchange={(v) => set('blockOnNoScale', v)}
      note="Shots won't start (and stop if started on the machine) while no scale is connected." />
    <Switch label="Ignore tare while pouring" on={a.blockTareDuringShot} onchange={(v) => set('blockTareDuringShot', v)}
      note="Keeps a stray tare from upsetting stop-at-weight mid-shot. The scale's own button still works." />
    <Choice label="When the machine sleeps" value={a.scalePowerMode}
      options={[{ value: 'disabled', label: 'Leave it' }, { value: 'displayOff', label: 'Screen off' }, { value: 'disconnect', label: 'Disconnect' }] as { value: ScalePowerMode; label: string }[]}
      notes={{ disabled: 'The scale stays as it is.', displayOff: 'Turns the scale’s screen off (scales that can’t are disconnected).', disconnect: 'Disconnects the scale to save its battery.' }}
      onchange={(v) => set('scalePowerMode', v)} />
  </section>
{/if}
