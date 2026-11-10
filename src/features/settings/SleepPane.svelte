<script lang="ts">
  import { gateway } from '../../state/app.svelte';
  import Stepper from '../../components/Stepper.svelte';
  import Switch from './Switch.svelte';
  import SaveStatus from './SaveStatus.svelte';
  import { Saver } from './saving.svelte';
  import { DAY_SHORT, daysLabel, parsePresence, parseSchedule, RANGES as R, sleepLabel, toggleDay, type Presence, type WakeSchedule } from '../../lib/decaidSettings';

  // Decaid puts the machine to sleep after a while with nobody around, and
  // can wake it on a schedule (optionally keeping it awake for a while).
  const saver = new Saver();
  let p = $state<Presence | null>(null);
  let error = $state<string | null>(null);
  $effect(() => {
    gateway.getPresence().then((r) => { p = parsePresence(r); }, (e) => { error = `Couldn't read Decaid's settings: ${(e as Error).message}`; });
    return () => saver.flushAll();
  });
  const q = saver.queue<{ userPresenceEnabled: boolean; sleepTimeoutMinutes: number }>((patch) => gateway.savePresence(patch));
  // Each schedule gets its own debounced writer, so steppers held down don't flood Decaid.
  const sq = new Map<string, { set: (patch: Record<string, unknown>) => void }>();
  function schedQueue(id: string) {
    let w = sq.get(id);
    if (!w) { w = saver.queue<Record<string, unknown>>((patch) => gateway.updateWakeSchedule(id, patch)); sq.set(id, w); }
    return w;
  }

  function setEnabled(v: boolean) { if (!p) return; p = { ...p, enabled: v }; q.set({ userPresenceEnabled: v }); }
  function setTimeout_(v: number) { if (!p) return; p = { ...p, sleepTimeoutMinutes: v }; q.set({ sleepTimeoutMinutes: v }); }

  function setSched(s: WakeSchedule, patch: Partial<WakeSchedule>) {
    if (!p) return;
    p = { ...p, schedules: p.schedules.map((x) => (x.id === s.id ? { ...x, ...patch } : x)) };
    const out: Record<string, unknown> = { ...patch };
    if ('keepAwakeFor' in patch) out.keepAwakeFor = patch.keepAwakeFor ? patch.keepAwakeFor : null;
    schedQueue(s.id).set(out);
  }
  async function add() {
    if (!p) return;
    const draft = { time: '07:00', daysOfWeek: [] as number[], enabled: true, keepAwakeFor: null };
    let made: WakeSchedule | null = null;
    const ok = await saver.run(async () => { made = parseSchedule(await gateway.addWakeSchedule(draft)); });
    if (ok && p) p = { ...p, schedules: [...p.schedules, made ?? { id: `local-${Date.now()}`, ...draft }] };
  }
  async function remove(s: WakeSchedule) {
    if (!p) return;
    if (await saver.run(() => gateway.deleteWakeSchedule(s.id)) && p) p = { ...p, schedules: p.schedules.filter((x) => x.id !== s.id) };
  }
</script>

<div class="pane-head"><SaveStatus {saver} /></div>
{#if error}<p class="error">{error}</p>{/if}

{#if p}
  <section class="card glass frost">
    <h2>Going to sleep</h2>
    <Switch label="Put the machine to sleep when nobody's around" on={p.enabled} onchange={setEnabled}
      note="Touching the tablet, the machine or the scale counts as someone being around." />
    {#if p.enabled}
      <div class="grid">
        <Stepper label="Sleep after" hint="0 = never" unit="min" min={R.sleepTimeoutMinutes.min} max={R.sleepTimeoutMinutes.max} step={R.sleepTimeoutMinutes.step}
          bind:value={() => p?.sleepTimeoutMinutes, (v) => { if (v !== undefined) setTimeout_(v); }} />
      </div>
      <p class="small">Now: {sleepLabel(p.sleepTimeoutMinutes)} without anyone around.</p>
    {/if}
  </section>

  <section class="card glass frost">
    <h2>Waking up</h2>
    <p>Have the machine warm and ready when you get up.</p>
    {#each p.schedules as s (s.id)}
      <div class="wake well" class:off={!s.enabled}>
        <div class="wake-top">
          <input class="time glass" type="time" value={s.time} aria-label="Wake time"
            onchange={(e) => { const t = e.currentTarget.value; if (/^\d{2}:\d{2}$/.test(t)) setSched(s, { time: t }); }} />
          <span class="when">{daysLabel(s.daysOfWeek)}</span>
          <button class="mini glass" class:lit={s.enabled} role="switch" aria-checked={s.enabled} onclick={() => setSched(s, { enabled: !s.enabled })}>{s.enabled ? 'On' : 'Off'}</button>
          <button class="mini glass danger" onclick={() => remove(s)} aria-label="Delete the {s.time} wake time">Delete</button>
        </div>
        <div class="days" role="group" aria-label="Days">
          {#each DAY_SHORT as d, i (d)}
            {@const on = s.daysOfWeek.length === 0 || s.daysOfWeek.includes(i + 1)}
            <button class="day glass" class:lit={on} aria-pressed={on} onclick={() => setSched(s, { daysOfWeek: toggleDay(s.daysOfWeek, i + 1) })}>{d}</button>
          {/each}
        </div>
        <div class="grid">
          <Stepper label="Stay awake for" hint="0 = no" unit="min" min={R.keepAwakeFor.min} max={R.keepAwakeFor.max} step={R.keepAwakeFor.step}
            bind:value={() => s.keepAwakeFor ?? 0, (v) => { if (v !== undefined) setSched(s, { keepAwakeFor: v || null }); }} />
        </div>
      </div>
    {/each}
    <button class="button glass solid" onclick={add}>Add a wake time</button>
  </section>
{/if}

<style>
  .wake { display: grid; gap: 10px; padding: 12px; border-radius: 18px; }
  .wake.off { opacity: 0.6; }
  .wake-top { display: flex; flex-wrap: wrap; align-items: center; gap: 9px; }
  .time { min-height: var(--touch); padding: 0 12px; border-radius: var(--radius-control); font-size: var(--t-lg); font-weight: 700; color: var(--paper); color-scheme: dark; }
  .when { flex: 1; color: var(--paper-dim); min-width: 90px; }
  .mini { min-height: 40px; padding: 0 14px; border-radius: var(--radius-control); font-weight: 650; color: var(--paper); }
  .mini.lit { background: var(--paper); color: var(--ink); }
  .danger { color: var(--stop); }
  .days { display: flex; flex-wrap: wrap; gap: 6px; }
  .day { min-width: 48px; min-height: 40px; border-radius: 999px; font-weight: 650; color: var(--paper-dim); }
  .day.lit { background: var(--paper); color: var(--ink); }
</style>
