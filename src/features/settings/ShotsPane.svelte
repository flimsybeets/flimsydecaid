<script lang="ts">
  import { app, gateway } from '../../state/app.svelte';
  import Stepper from '../../components/Stepper.svelte';
  import Switch from './Switch.svelte';
  import Choice from './Choice.svelte';
  import SaveStatus from './SaveStatus.svelte';
  import { Saver } from './saving.svelte';
  import { parseAppSettings, RANGES as R, type AppSettings, type ScalePowerMode } from '../../lib/decaidSettings';
  import { landingText, MIN_READS, suggestLookAhead } from '../../lib/stopTuning';

  // Everything about when the pump stops: espresso at weight or volume, hot
  // water at weight, and tuning the espresso look-ahead from real shots.
  const saver = new Saver();
  let a = $state<AppSettings | null>(null);
  let error = $state<string | null>(null);
  let reading = $state(false);
  let base = $state<number | undefined>(undefined);

  function loadSettings() {
    gateway.getAppSettings().then((r) => { a = parseAppSettings(r); }, (e) => { error = `Couldn't read Decaid's settings: ${(e as Error).message}`; });
    app.baseLookAhead().then((v) => { base = v; }, () => {});
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

  // Profiles the skin knows something about: shots that stopped at weight, or their own look-ahead.
  const tuned = $derived(Object.entries(app.tune.profiles)
    .map(([root, t]) => ({ root, t, title: app.profileLineages.get(root)?.profile.title, s: suggestLookAhead(t.reads) }))
    .filter((x) => x.title && (x.t.reads.length > 0 || x.t.lookAhead !== undefined))
    .sort((x, y) => y.t.reads.length - x.t.reads.length));

  let baseTimer: ReturnType<typeof setTimeout> | undefined;
  function setBase(v: number) {
    base = v;
    clearTimeout(baseTimer);
    baseTimer = setTimeout(() => void saver.run(() => app.setBaseLookAhead(v)), 600);
  }
  const setAuto = (on: boolean) => saver.run(() => app.setAutoTune(on));
  const useIt = (root: string) => saver.run(() => app.useSuggestion(root));
  const toDefault = (root: string) => saver.run(() => app.setProfileLookAhead(root, null));
</script>

<div class="pane-head"><SaveStatus {saver} /></div>
{#if error}<p class="error">{error}</p>{/if}

{#if a}
  <section class="card glass frost">
    <h2>Espresso</h2>
    <p>Coffee keeps dripping after the pump stops, so Decaid stops a little early: it looks this many seconds of flow ahead.</p>
    <div class="grid">
      <Stepper label="Stop at weight: look ahead" unit="s" decimals={1} min={R.weightFlowMultiplier.min} max={R.weightFlowMultiplier.max} step={R.weightFlowMultiplier.step}
        bind:value={() => base, (v) => { if (v !== undefined) setBase(v); }} />
      <Stepper label="Stop at volume: look ahead" unit="s" decimals={2} min={R.volumeFlowMultiplier.min} max={R.volumeFlowMultiplier.max} step={R.volumeFlowMultiplier.step}
        bind:value={() => a?.volumeFlowMultiplier, (v) => { if (v !== undefined) set('volumeFlowMultiplier', v); }} />
    </div>
    <p class="small">The weight look-ahead above is the default. Each profile can have its own, which goes on the machine with the profile.</p>
    <div class="tune well">
      <h3>Per profile</h3>
      {#each tuned as x (x.root)}
        {@const own = x.t.lookAhead}
        <div class="prof">
          <div class="what">
            <b>{x.title}</b>
            <span class="small">{x.s ? `${landingText(x.s)} Best: ${x.s.lookAhead.toFixed(1)} s.` : `${x.t.reads.length} of ${MIN_READS} shots needed to tune.`}</span>
          </div>
          <span class="val">{own !== undefined ? `${own.toFixed(1)} s` : 'Default'}</span>
          {#if x.s && (own === undefined || Math.abs(x.s.lookAhead - own) >= 0.1)}
            <button class="button glass solid" onclick={() => useIt(x.root)}>Use {x.s.lookAhead.toFixed(1)} s</button>
          {:else if own !== undefined}
            <button class="button glass" onclick={() => toDefault(x.root)}>Use default</button>
          {/if}
        </div>
      {:else}
        <p class="landing">{reading ? 'Looking at your recent shots…' : 'After three shots with a profile that stop at weight, this works out the best look-ahead for that profile.'}</p>
      {/each}
      <Switch label="Tune it after every shot" on={app.tune.auto} onchange={setAuto}
        note="Each shot that stops at weight shows how much still drips in. With this on, each profile's look-ahead follows its own last few shots." />
    </div>
  </section>

  <section class="card glass frost">
    <h2>Hot water</h2>
{#if a.stopHotWaterAtWeight}
      <div class="grid">
        <Stepper label="Look ahead" unit="s" decimals={2} min={R.hotWaterFlowMultiplier.min} max={R.hotWaterFlowMultiplier.max} step={R.hotWaterFlowMultiplier.step}
          bind:value={() => a?.hotWaterFlowMultiplier, (v) => { if (v !== undefined) set('hotWaterFlowMultiplier', v); }} />
      </div>
      <p class="small">If hot water overfills, raise this; if it stops short, lower it. Decaid keeps no record of hot water pours, so this one can't tune itself.</p>
    {:else}
      <p class="small">Hot water stops at the machine's own measure. Turn on Stop by the scale from the Hot water button in the bottom bar.</p>
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
  .tune h3 { font-size: var(--t-sm); color: var(--paper-dim); font-weight: 650; }
  .prof { display: grid; grid-template-columns: 1fr auto auto; gap: 10px; align-items: center; min-height: 44px; }
  .prof .what { display: grid; gap: 2px; min-width: 0; }
  .prof .what b { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .prof .val { font-variant-numeric: tabular-nums; color: var(--paper-dim); }
  .prof .button { min-height: 40px; padding: 0 14px; border-radius: var(--radius-pill); }
  @media (max-width: 640px) { .prof { grid-template-columns: 1fr auto; } .prof .button { grid-column: 1 / -1; justify-self: start; } }
  .landing { color: var(--paper); }
</style>
