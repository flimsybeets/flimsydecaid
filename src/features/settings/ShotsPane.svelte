<script lang="ts">
  import { app, gateway } from '../../state/app.svelte';
  import Stepper from '../../components/Stepper.svelte';
  import Switch from './Switch.svelte';
  import Choice from './Choice.svelte';
  import SaveStatus from './SaveStatus.svelte';
  import { Saver } from './saving.svelte';
  import { parseAppSettings, RANGES as R, type AppSettings, type ScalePowerMode } from '../../lib/decaidSettings';
  import { landingText, suggestLookAhead } from '../../lib/stopTuning';

  // Everything about when the pump stops: espresso at weight or volume, hot
  // water at weight, and tuning the espresso look-ahead from real shots.
  const saver = new Saver();
  let a = $state<AppSettings | null>(null);
  let error = $state<string | null>(null);
  let reading = $state(false);

  function loadSettings() {
    gateway.getAppSettings().then((r) => { a = parseAppSettings(r); }, (e) => { error = `Couldn't read Decaid's settings: ${(e as Error).message}`; });
  }
  $effect(() => {
    loadSettings();
    reading = true;
    void app.readRecentStops().catch(() => {}).finally(() => { reading = false; });
    return () => saver.flushAll();
  });
  const q = saver.queue<AppSettings>((p) => gateway.saveAppSettings(p as Record<string, unknown>));
  function set<K extends keyof AppSettings>(k: K, v: AppSettings[K]) {
    if (!a) return;
    a = { ...a, [k]: v };
    q.set({ [k]: v } as Partial<AppSettings>);
  }

  const suggestion = $derived(suggestLookAhead(app.stopReads));
  async function tuneNow() {
    const v = await saver.run(() => app.applyTuning());
    if (v) loadSettings();
  }
  async function setAuto(on: boolean) {
    await saver.run(() => app.setAutoTune(on));
    loadSettings();
  }
</script>

<div class="pane-head"><SaveStatus {saver} /></div>
{#if error}<p class="error">{error}</p>{/if}

{#if a}
  <section class="card glass frost">
    <h2>Espresso</h2>
    <p>Coffee keeps dripping after the pump stops, so Decaid stops a little early: it looks this many seconds of flow ahead.</p>
    <div class="grid">
      <Stepper label="Stop at weight: look ahead" unit="s" decimals={1} min={R.weightFlowMultiplier.min} max={R.weightFlowMultiplier.max} step={R.weightFlowMultiplier.step}
        bind:value={() => a?.weightFlowMultiplier, (v) => { if (v !== undefined) set('weightFlowMultiplier', v); }} />
      <Stepper label="Stop at volume: look ahead" unit="s" decimals={2} min={R.volumeFlowMultiplier.min} max={R.volumeFlowMultiplier.max} step={R.volumeFlowMultiplier.step}
        bind:value={() => a?.volumeFlowMultiplier, (v) => { if (v !== undefined) set('volumeFlowMultiplier', v); }} />
    </div>
    <div class="tune well">
      {#if suggestion}
        <p class="landing">{landingText(suggestion)} Best look-ahead for them: <b>{suggestion.lookAhead.toFixed(1)} s</b>.</p>
        {#if Math.abs(suggestion.lookAhead - a.weightFlowMultiplier) >= 0.1}
          <button class="button glass solid" onclick={tuneNow}>Use {suggestion.lookAhead.toFixed(1)} s</button>
        {/if}
      {:else}
        <p class="landing">{reading ? 'Looking at your recent shots…' : 'After three shots that stop at weight, this works out the best look-ahead for you.'}</p>
      {/if}
      <Switch label="Tune it after every shot" on={app.autoTune} onchange={setAuto}
        note="Each shot that stops at weight shows how much still drips in. With this on, the look-ahead follows your last few shots by itself." />
    </div>
  </section>

  <section class="card glass frost">
    <h2>Hot water</h2>
    <Switch label="Stop at the amount on the scale" on={a.stopHotWaterAtWeight} onchange={(v) => set('stopHotWaterAtWeight', v)}
      note="With a scale connected, hot water tares it and stops when the cup holds the amount set under Machine → Hot water, in grams." />
    {#if a.stopHotWaterAtWeight}
      <div class="grid">
        <Stepper label="Look ahead" unit="s" decimals={2} min={R.hotWaterFlowMultiplier.min} max={R.hotWaterFlowMultiplier.max} step={R.hotWaterFlowMultiplier.step}
          bind:value={() => a?.hotWaterFlowMultiplier, (v) => { if (v !== undefined) set('hotWaterFlowMultiplier', v); }} />
      </div>
      <p class="small">If hot water overfills, raise this; if it stops short, lower it. Decaid keeps no record of hot water pours, so this one can't tune itself.</p>
    {/if}
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

<style>
  .tune { display: grid; gap: 10px; padding: 14px; border-radius: 18px; }
  .landing { color: var(--paper); }
  .landing b { font-variant-numeric: tabular-nums; }
</style>
