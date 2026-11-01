<script lang="ts">
  import { app } from '../../state/app.svelte';
  import type { ShotRecord } from '../../api/types';
  import Modal from '../../components/Modal.svelte';
  import ShotChart from '../../components/ShotChart.svelte';
  import { samplesFromMeasurements } from '../../lib/shot';
  import { ratioText, shotStats, stopReasonText } from '../../lib/history';
  import { baseTemperature } from '../../lib/profiles';
  import type { DialIn } from '../../lib/dialIn';

  // The newest shot with this profile and bag: its graph and the settings that
  // made it, with an option to put those settings back in the brew panel.

  let { profileTitle, batchId, bagName, onClose, onUse }: {
    profileTitle: string;
    batchId: string;
    bagName: string;
    onClose: () => void;
    onUse: (d: DialIn) => void;
  } = $props();

  let shot = $state<ShotRecord | null>(null);
  let phase = $state<'loading' | 'none' | 'ok' | 'error'>('loading');
  $effect(() => {
    let live = true;
    phase = 'loading';
    app.lastShotWith(profileTitle, batchId).then(
      (s) => { if (live) { shot = s; phase = s ? 'ok' : 'none'; } },
      () => { if (live) phase = 'error'; },
    );
    return () => { live = false; };
  });

  const ctx = $derived(shot?.workflow?.context);
  const samples = $derived(shot ? samplesFromMeasurements(shot.measurements ?? []) : []);
  const stats = $derived(shotStats(samples));
  const out = $derived(shot?.annotations?.actualYield ?? samples.at(-1)?.weight ?? null);
  const temp = $derived(shot?.workflow?.profile ? baseTemperature(shot.workflow.profile) : null);
  const when = $derived(shot ? new Date(shot.timestamp).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '');
  function use() {
    const d: DialIn = {};
    if (ctx?.grinderSetting) d.grind = ctx.grinderSetting;
    if (ctx?.targetDoseWeight) d.dose = ctx.targetDoseWeight;
    if (ctx?.targetYield) d.yield = ctx.targetYield;
    if (temp !== null) d.tempOffset = temp; // absolute here; the panel turns it into an offset
    onUse(d);
    onClose();
  }
</script>

<Modal wide title="Last shot" {onClose}>
  {#if phase === 'loading'}
    <p class="note">Finding the last shot…</p>
  {:else if phase === 'error'}
    <p class="note">Couldn't load the last shot. Try again in a moment.</p>
  {:else if phase === 'none' || !shot}
    <p class="note">No shots yet with {profileTitle} and {bagName}.</p>
  {:else}
    <p class="when">{profileTitle} · {bagName} · {when}{stopReasonText(shot.stopReason) ? ` · ${stopReasonText(shot.stopReason)}` : ''}</p>
    <dl class="stats">
      <div><dt>Grind</dt><dd>{ctx?.grinderSetting || '–'}</dd></div>
      <div><dt>Dose</dt><dd>{ctx?.targetDoseWeight ?? '–'}<small>g</small></dd></div>
      <div><dt>Out</dt><dd>{out != null ? out.toFixed(1) : '–'}<small>g</small></dd></div>
      <div><dt>Ratio</dt><dd>{ratioText(ctx?.targetDoseWeight, out) ?? '–'}</dd></div>
      <div><dt>Time</dt><dd>{stats.seconds.toFixed(1)}<small>s</small></dd></div>
      {#if temp !== null}<div><dt>Temp</dt><dd>{temp}<small>°C</small></dd></div>{/if}
      {#if shot.annotations?.enjoyment != null}<div><dt>Rating</dt><dd>{shot.annotations.enjoyment}<small>/10</small></dd></div>{/if}
    </dl>
    {#if shot.annotations?.espressoNotes}<p class="notes">{shot.annotations.espressoNotes}</p>{/if}
    <div class="graph glass thick">
      {#if samples.length}
        <ShotChart scrub {samples} yieldTarget={ctx?.targetYield || null} />
      {:else}
        <p class="note">This shot has no graph data.</p>
      {/if}
    </div>
  {/if}

  {#snippet actions()}
    <button class="secondary glass" onclick={onClose}>Close</button>
    {#if phase === 'ok'}<button class="primary glass solid" onclick={use}>Use these settings</button>{/if}
  {/snippet}
</Modal>

<style>
  .note { color: var(--paper-dim); }
  .when { color: var(--paper-dim); font-size: var(--t-sm); }
  .stats { display: flex; flex-wrap: wrap; gap: 6px 24px; margin: 0; }
  .stats div { display: grid; }
  dt { color: var(--paper-faint); font-size: var(--t-xs); }
  dd { margin: 0; font-size: var(--t-lg); font-weight: 700; font-variant-numeric: tabular-nums; }
  dd small { font-size: var(--t-xs); color: var(--paper-dim); margin-left: 2px; font-weight: 500; }
  .notes { color: var(--paper-dim); font-size: var(--t-sm); }
  .graph { height: min(300px, 42vh); padding: 8px; border-radius: 18px; }
  .primary, .secondary { min-height: var(--touch); padding: 0 20px; border-radius: var(--radius-control); font-weight: 650; }
  .secondary { color: var(--paper-dim); }
</style>
