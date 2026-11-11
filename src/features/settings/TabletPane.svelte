<script lang="ts">
  import { gateway } from '../../state/app.svelte';
  import Switch from './Switch.svelte';
  import Choice from './Choice.svelte';
  import SaveStatus from './SaveStatus.svelte';
  import { Saver } from './saving.svelte';
  import { clockToMinutes, machinePatch, minutesToClock, parseAppSettings, parseMachineSettings, type AppSettings, type ChargingMode, type MachineSettings } from '../../lib/decaidSettings';

  const saver = new Saver();
  let a = $state<AppSettings | null>(null);
  let error = $state<string | null>(null);
  // The machine's USB port is what charges the tablet.
  let m = $state<MachineSettings | null>(null);
  const mq = saver.queue<MachineSettings>((p) => gateway.saveMachineSettings(machinePatch(p)));
  function setUsb(on: boolean) { if (!m) return; m = { ...m, usb: on }; mq.set({ usb: on }); }
  $effect(() => {
    gateway.getMachineSettings().then((r) => { m = parseMachineSettings(r); }, () => {});
    gateway.getAppSettings().then((r) => { a = parseAppSettings(r); }, (e) => { error = `Couldn't read Decaid's settings: ${(e as Error).message}`; });
    return () => saver.flushAll();
  });
  const q = saver.queue<AppSettings>((p) => gateway.saveAppSettings(p as Record<string, unknown>));
  function set<K extends keyof AppSettings>(k: K, v: AppSettings[K]) {
    if (!a) return;
    a = { ...a, [k]: v };
    q.set({ [k]: v } as Partial<AppSettings>);
  }
  function setTime(k: 'nightModeSleepTime' | 'nightModeMorningTime', s: string) {
    const v = clockToMinutes(s);
    if (v !== null) set(k, v);
  }
  const MODES: { value: ChargingMode; label: string }[] = [
    { value: 'disabled', label: 'Off' }, { value: 'longevity', label: 'Longevity' }, { value: 'balanced', label: 'Balanced' }, { value: 'highAvailability', label: 'Always ready' },
  ];
  const PHASE: Record<string, string> = { inactive: '', normal: 'Normal charging', hovering: 'Holding its level', chargingToMax: 'Charging up for the morning', sleeping: 'Night mode' };
</script>

<div class="pane-head"><SaveStatus {saver} /></div>
{#if error}<p class="error">{error}</p>{/if}

{#if a}
  <section class="card glass frost">
    <h2>Screen</h2>
    <Switch label="Keep the screen on" on={a.keepAwake} onchange={(v) => set('keepAwake', v)}
      note="On: the tablet screen never turns off while Decaid runs. Off: it may turn off while the machine sleeps (the screensaver keeps it on while it shows)." />
    <Switch label="Dim when the battery is low" on={a.lowBatteryBrightnessLimit} onchange={(v) => set('lowBatteryBrightnessLimit', v)}
      note="Below 30% battery, brightness is held at 20%." />
  </section>

  <section class="card glass frost">
    <h2>Charging</h2>
    {#if a.battery}
      <p>Battery {a.battery.percent}%{PHASE[a.battery.phase] ? ` · ${PHASE[a.battery.phase]}` : ''}{a.battery.usbChargerOn ? ' · charging from the machine' : ''}.</p>
    {/if}
    <p class="small">Decaid switches the machine's USB port on and off to keep the tablet's battery in a healthy range.</p>
    <Switch label="Machine's USB port" on={m?.usb ?? false} disabled={!m} onchange={setUsb}
      note={m ? (a.chargingMode === 'disabled' ? 'Powers the tablet from the machine.' : 'Decaid switches this for you to keep the battery in range below.') : 'Connect the machine to change this.'} />
    <Choice label="Battery range" value={a.chargingMode} options={MODES}
      notes={{ disabled: 'Decaid leaves charging alone.', longevity: 'Holds 45–55%: kindest to the battery.', balanced: 'Holds 40–80%.', highAvailability: 'Holds 80–95%: most time off the charger.' }}
      onchange={(v) => set('chargingMode', v)} />
    <Switch label="Night mode" on={a.nightModeEnabled} onchange={(v) => set('nightModeEnabled', v)}
      note="Lets the battery run lower overnight, then tops it up before morning." />
    {#if a.nightModeEnabled}
      <div class="times">
        <label>Night starts<input class="well" type="time" value={minutesToClock(a.nightModeSleepTime)} onchange={(e) => setTime('nightModeSleepTime', e.currentTarget.value)} /></label>
        <label>Morning<input class="well" type="time" value={minutesToClock(a.nightModeMorningTime)} onchange={(e) => setTime('nightModeMorningTime', e.currentTarget.value)} /></label>
      </div>
    {/if}
  </section>
{/if}
