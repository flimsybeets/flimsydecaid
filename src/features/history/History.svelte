<script lang="ts">
  import { app } from '../../state/app.svelte';
  import type { ShotRecord, ShotSummary } from '../../api/types';
  import ShotChart from '../../components/ShotChart.svelte';
  import ConfirmDialog from '../../components/ConfirmDialog.svelte';
  import ShotNotesDialog from './ShotNotesDialog.svelte';
  import BrewPanel from '../home/BrewPanel.svelte';
  import { planBrewAgain, type BrewAgainPlan } from '../../lib/brewAgain';
  import { givebackFor } from '../../lib/bagWeight';
  import { groupByDay, ratioText, shotStats, stopReasonText } from '../../lib/history';
  import { samplesFromMeasurements } from '../../lib/shot';
  import { visualizerIdOf, visualizerUrl } from '../../lib/visualizer';

  // Shots come from Decaid, newest first, a page at a time. The list carries
  // no measurements; the selected shot is fetched whole for its graph.

  const PAGE = 30;

  /** null = every shot; otherwise a bag (batch) id. */
  // Arriving from a bag's "Shots" button on the Beans tab: filtered to that bag, finished or not.
  // svelte-ignore state_referenced_locally
  const arrivedBag = app.historyBag;
  app.historyBag = null;
  // svelte-ignore state_referenced_locally
  let bagFilter = $state<string | null>(arrivedBag);
  let shots = $state<ShotSummary[]>([]);
  let total = $state(0);
  let loading = $state(false);
  let error = $state<string | null>(null);
  let selectedId = $state<string | null>(null);
  let detail = $state<ShotRecord | null>(null);
  let detailError = $state<string | null>(null);
  let annotating = $state(false);
  let confirmDelete = $state(false);

  // Visualizer: the plugin stamps annotations.extras.visualizerId on shots it uploaded.
  let vizBusy = $state(false);
  let vizError = $state<string | null>(null);
  $effect(() => { void app.loadVisualizer(); });
  $effect(() => { void selectedId; vizError = null; });

  async function uploadSelected() {
    const id = selectedId;
    if (!id) return;
    vizBusy = true;
    vizError = null;
    try {
      const vid = await app.uploadToVisualizer(id);
      shots = shots.map((s) => (s.id === id ? { ...s, annotations: { ...(s.annotations ?? {}), extras: { ...(s.annotations?.extras ?? {}), visualizerId: vid } } } : s));
    } catch (e) {
      vizError = `Couldn't upload: ${(e as Error).message}`;
    } finally {
      vizBusy = false;
    }
  }

  function onAnnotated(updated: ShotSummary) {
    shots = shots.map((s) => (s.id === updated.id ? { ...s, annotations: updated.annotations } : s));
  }
  async function deleteSelected(giveBack: boolean) {
    const id = selectedId;
    if (!id) return;
    await app.deleteShot(id, giveBack, shots.find((s) => s.id === id)?.workflow?.context?.beanBatchId);
    const i = shots.findIndex((s) => s.id === id);
    shots = shots.filter((s) => s.id !== id);
    total = Math.max(0, total - 1);
    selectedId = shots[Math.min(i, shots.length - 1)]?.id ?? null;
  }

  // Bags worth filtering by: open ones, newest roast first, plus the finished one you came here for.
  const openBags = $derived(
    app.batches
      .filter((b) => !b.archived || b.id === arrivedBag)
      .sort((a, b) => (b.roastDate ?? b.createdAt).localeCompare(a.roastDate ?? a.createdAt)),
  );

  const beanName = (beanId: string) => app.beans.find((b) => b.id === beanId)?.name ?? 'Unknown coffee';
  const fmtDay = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : null);
  const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

  function bagLabel(shot: ShotSummary): string {
    const ctx = shot.workflow?.context;
    const batch = ctx?.beanBatchId ? app.batches.find((b) => b.id === ctx.beanBatchId) : undefined;
    if (batch) return beanName(batch.beanId);
    return ctx?.coffeeName ?? 'No bag';
  }

  function bagRoast(shot: ShotSummary): string | null {
    const id = shot.workflow?.context?.beanBatchId;
    const roast = id ? app.batches.find((b) => b.id === id)?.roastDate : null;
    return roast ? `roasted ${fmtDay(roast)}` : null;
  }

  const outWeight = (shot: ShotSummary) => shot.annotations?.actualYield ?? null;

  async function load(reset: boolean): Promise<void> {
    loading = true;
    const filter = bagFilter;
    try {
      const page = await app.getShots({ limit: PAGE, offset: reset ? 0 : shots.length, beanBatchId: filter ?? undefined });
      if (filter !== bagFilter) return; // the filter changed while this was in flight
      shots = reset ? page.items : [...shots, ...page.items];
      total = page.total;
      error = null;
      if (reset && !shots.some((s) => s.id === selectedId)) selectedId = shots[0]?.id ?? null;
    } catch (e) {
      error = `Couldn't load shots: ${(e as Error).message}`;
    } finally {
      loading = false;
    }
  }

  // First load, and again whenever the filter changes.
  $effect(() => {
    void bagFilter;
    void load(true);
  });

  // A shot just finished: Decaid saves it as the machine goes idle, so give it a moment.
  let seenFinished = app.shotsFinished;
  $effect(() => {
    if (app.shotsFinished === seenFinished) return;
    seenFinished = app.shotsFinished;
    const t = setTimeout(() => { selectedId = null; void load(true); }, 1500);
    return () => clearTimeout(t);
  });

  $effect(() => {
    const id = selectedId;
    detail = null;
    detailError = null;
    if (!id) return;
    app.getShot(id).then(
      (shot) => { if (selectedId === id) detail = shot; },
      (e) => { if (selectedId === id) detailError = `Couldn't load this shot: ${(e as Error).message}`; },
    );
  });

  const groups = $derived(groupByDay(shots));
  const selected = $derived(shots.find((s) => s.id === selectedId) ?? null);

  // Brew this again: the same BrewPanel as the Profiles tab, started with the shot's bag and numbers.
  let brewing = $state<{ root: string; plan: BrewAgainPlan } | null>(null);
  const again = $derived(selected ? planBrewAgain(selected, app.profileLineages, app.batches, app.beans) : null);
  // What deleting this shot can give back to its bag (null when it was never taken off).
  const giveBack = $derived(
    selected ? givebackFor(app.batches.find((b) => b.id === selected.workflow?.context?.beanBatchId), selected.id) : null,
  );

  const samples = $derived(detail ? samplesFromMeasurements(detail.measurements ?? []) : []);
  const stats = $derived(shotStats(samples));
</script>

{#if brewing}
  {#key brewing.root}
    <div class="brewing">
      <BrewPanel profileRoot={brewing.root} initial={{ batchId: brewing.plan.batchId, dialIn: brewing.plan.dialIn, note: brewing.plan.note }} onClose={() => (brewing = null)} />
    </div>
  {/key}
{:else}
<div class="page">
  <aside class="list glass">
    <div class="filters" role="group" aria-label="Show shots for">
      <button class="chip glass" class:solid={bagFilter === null} class:on={bagFilter === null} onclick={() => (bagFilter = null)}>All shots</button>
      {#each openBags as b (b.id)}
        <button class="chip glass" class:solid={bagFilter === b.id} class:on={bagFilter === b.id} onclick={() => (bagFilter = b.id)}>
          {beanName(b.beanId)}{#if fmtDay(b.roastDate)}<small>{fmtDay(b.roastDate)}</small>{/if}
        </button>
      {/each}
    </div>

    <div class="scroll">
      {#if error}
        <div class="note">
          <p>{error}</p>
          <button class="more glass" onclick={() => load(true)}>Try again</button>
        </div>
      {:else if !loading && shots.length === 0}
        <div class="note">
          <p class="big">{bagFilter ? 'No shots from this bag yet' : 'No shots yet'}</p>
          <p>Every shot you pull is saved by Decaid with its bag, grind and profile, and shows up here.</p>
        </div>
      {/if}

      {#each groups as g (g.label)}
        <h2 class="day">{g.label}</h2>
        <ul>
          {#each g.shots as s (s.id)}
            {@const ctx = s.workflow?.context}
            {@const out = outWeight(s) ?? ctx?.targetYield}
            <li>
              <button class="row glass" class:solid={s.id === selectedId} class:selected={s.id === selectedId} aria-pressed={s.id === selectedId} onclick={() => (selectedId = s.id)}>
                <span class="main">
                  <span class="title">{s.workflow?.profile?.title ?? 'Unknown profile'}</span>
                  <span class="sub">{fmtTime(s.timestamp)} · {bagLabel(s)}</span>
                </span>
                <span class="nums">
                  {#if ratioText(ctx?.targetDoseWeight, out)}<span>{ratioText(ctx?.targetDoseWeight, out)}</span>{/if}
                  {#if ctx?.grinderSetting}<span class="sub">Grind {ctx.grinderSetting}</span>{/if}
                </span>
                {#if visualizerIdOf(s)}<span class="viz" title="On Visualizer" aria-label="Uploaded to Visualizer">↑V</span>{/if}
                {#if s.annotations?.enjoyment != null}<span class="score" aria-label="Rated {s.annotations.enjoyment} out of 10">{s.annotations.enjoyment}</span>{/if}
              </button>
            </li>
          {/each}
        </ul>
      {/each}

      {#if shots.length < total}
        <button class="more glass" disabled={loading} onclick={() => load(false)}>{loading ? 'Loading…' : `Show more (${total - shots.length} older)`}</button>
      {/if}
    </div>
  </aside>

  <section class="detail" aria-label="Selected shot">
    {#if selected}
      {@const ctx = selected.workflow?.context}
      {@const out = outWeight(selected) ?? stats.weight}
      <header>
        <div>
          <h2>{selected.workflow?.profile?.title ?? 'Unknown profile'}</h2>
          <p>
            {[ctx?.coffeeRoaster, bagLabel(selected)].filter(Boolean).join(' ')}{bagRoast(selected) ? `, ${bagRoast(selected)}` : ''}
          </p>
          <p class="when">{new Date(selected.timestamp).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}{stopReasonText(selected.stopReason) ? ` · ${stopReasonText(selected.stopReason)}` : ''}</p>
        </div>
        <div class="shot-actions">
          <button class="glass solid" disabled={!again?.profileRoot} title={again?.profileRoot ? undefined : 'That profile is gone'} onclick={() => { if (again?.profileRoot) brewing = { root: again.profileRoot, plan: again }; }}>Brew this again</button>
          {#if visualizerIdOf(selected)}
            <a class="glass" href={visualizerUrl(visualizerIdOf(selected)!)} target="_blank" rel="noreferrer">On Visualizer ↗</a>
          {:else if app.visualizer === 'on'}
            <button class="glass" disabled={vizBusy} onclick={uploadSelected}>{vizBusy ? 'Uploading…' : 'Upload to Visualizer'}</button>
          {/if}
          <button class="glass" onclick={() => (annotating = true)}>{selected.annotations?.enjoyment != null || selected.annotations?.espressoNotes ? 'Edit notes' : 'Rate and add notes'}</button>
          <button class="glass danger" aria-label="Delete this shot" onclick={() => (confirmDelete = true)}>Delete</button>
        </div>
      </header>

      {#if vizError}<p class="viz-error" role="alert">{vizError}</p>{/if}

      <dl class="stats">
        <div><dt>Time</dt><dd>{detail ? stats.seconds.toFixed(1) : '–'}<small>s</small></dd></div>
        <div><dt>Dose</dt><dd>{ctx?.targetDoseWeight ?? '–'}<small>g</small></dd></div>
        <div><dt>Out</dt><dd>{out != null ? out.toFixed(1) : '–'}<small>g</small></dd></div>
        <div><dt>Ratio</dt><dd>{ratioText(ctx?.targetDoseWeight, out) ?? '–'}</dd></div>
        <div><dt>Grind</dt><dd>{ctx?.grinderSetting ?? '–'}</dd></div>
        {#if selected.annotations?.enjoyment != null}<div><dt>Rating</dt><dd>{selected.annotations.enjoyment}<small>/10</small></dd></div>{/if}
      </dl>

      {#if selected.annotations?.espressoNotes}<p class="notes">{selected.annotations.espressoNotes}</p>{/if}

      <div class="graph glass thick">
        {#if detailError}
          <p class="note">{detailError}</p>
        {:else if !detail}
          <p class="note">Loading graph…</p>
        {:else if samples.length === 0}
          <p class="note">This shot has no graph data.</p>
        {:else}
          <ShotChart scrub {samples} yieldTarget={ctx?.targetYield || null} />
        {/if}
      </div>
    {/if}
  </section>
</div>
{/if}

{#if annotating && selected}
  <ShotNotesDialog shot={selected} onClose={() => (annotating = false)} onSaved={onAnnotated} />
{/if}
{#if confirmDelete && selected}
  <ConfirmDialog
    title="Delete this shot?"
    message="It's removed from Decaid's shot history for good, with its graph and notes."
    action="Delete shot"
    option={giveBack !== null ? `Give back ${Number.isInteger(giveBack) ? giveBack : giveBack.toFixed(1)} g to the bag` : undefined}
    onConfirm={deleteSelected}
    onClose={() => (confirmDelete = false)}
  />
{/if}

<style>
  .brewing { height: 100%; display: grid; grid-template-columns: minmax(0, 1fr); grid-template-rows: minmax(0, 1fr); overflow: hidden; }
  .page {
    height: 100%;
    display: grid;
    grid-template-columns: minmax(270px, 330px) 1fr;
    gap: 4px;
    min-height: 0;
    padding: 3px 0 3px var(--gutter);
  }

  .list { display: grid; grid-template-rows: auto 1fr; min-height: 0; border-radius: 26px; overflow: hidden; }
  .filters { display: flex; gap: 6px; overflow-x: auto; padding: 10px 12px 8px; }
  .chip {
    flex: none;
    min-height: 42px;
    padding: 0 15px;
    border-radius: var(--radius-pill);
    color: var(--paper-dim);
    white-space: nowrap;
  }
  .chip small { margin-left: 6px; font-size: var(--t-xs); color: var(--paper-faint); }
  .chip.on { color: var(--ink); font-weight: 650; }
  .chip.on small { color: var(--ink); opacity: 0.7; }

  .scroll { overflow-y: auto; padding: 0 12px 12px; min-height: 0; }
  ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
  .day { font-size: var(--t-xs); font-weight: 600; color: var(--paper-faint); text-transform: uppercase; letter-spacing: 0.06em; margin: 14px 0 6px; }

  .row {
    width: 100%;
    min-height: 56px;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    border-radius: 16px;
    text-align: left;
  }
  .row.selected .sub { color: var(--ink); opacity: 0.7; }
  .main { flex: 1; min-width: 0; display: grid; }
  .title { font-weight: 650; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .sub { color: var(--paper-dim); font-size: var(--t-xs); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .nums { display: grid; justify-items: end; flex: none; }
  .score {
    flex: none;
    width: 40px; height: 40px;
    display: grid; place-items: center;
    border-radius: 50%;
    background: var(--ink-sunk);
    color: var(--paper);
    font-weight: 700;
  }
  .row.selected .score { background: var(--ink); color: var(--paper); }

  .more {
    width: 100%;
    min-height: var(--touch);
    margin-top: 10px;
    border-radius: var(--radius-pill);
    color: var(--paper-dim);
  }

  .note { color: var(--paper-dim); display: grid; gap: 6px; padding-top: 12px; }
  .note .big { color: var(--paper); font-size: var(--t-lg); font-weight: 650; }

  .detail {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 14px var(--gutter) var(--gutter);
    min-height: 0;
    min-width: 0;
  }
  .detail header { display: flex; align-items: flex-start; gap: 12px; }
  .detail header > div:first-child { flex: 1; min-width: 0; }
  .shot-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 6px; max-width: 62%; }
  .shot-actions a { display: inline-flex; align-items: center; min-height: 40px; padding: 0 12px; border-radius: var(--radius-pill); color: var(--go); font-size: var(--t-xs); font-weight: 650; text-decoration: none; }
  .shot-actions button:disabled { opacity: 0.5; }
  .viz { flex: none; color: var(--go); font-size: var(--t-xs); font-weight: 700; }
  .row.selected .viz { color: var(--ink); }
  .viz-error { color: var(--stop); font-size: var(--t-sm); }
  .shot-actions button { min-height: 40px; padding: 0 12px; border-radius: var(--radius-pill); color: var(--paper); font-size: var(--t-xs); font-weight: 650; }
  .shot-actions .danger { color: #ffb3ab; }
  .detail h2 { font-size: var(--t-xl); font-weight: 700; letter-spacing: -0.01em; }
  .detail header p { color: var(--paper-dim); font-size: var(--t-md); }
  .detail .when { font-size: var(--t-sm); color: var(--paper-faint); }

  .stats { display: flex; flex-wrap: wrap; gap: 8px 27px; margin: 0; }
  .stats div { display: grid; }
  dt { color: var(--paper-faint); font-size: var(--t-xs); }
  dd { margin: 0; font-size: var(--t-lg); font-weight: 650; }
  dd small { font-size: var(--t-sm); color: var(--paper-dim); margin-left: 2px; font-weight: 500; }
  .notes { color: var(--paper-dim); max-width: 70ch; padding-left: 10px; border-left: 3px solid rgb(255 255 255 / 0.25); }

  .graph { flex: 1; min-height: 0; display: flex; padding: 14px 15px 10px; border-radius: 24px; }
  .graph > :global(*) { flex: 1; }

  @media (max-width: 1100px) {
    .page { grid-template-columns: 270px 1fr; }
    .detail h2 { font-size: var(--t-lg); }
    .stats { gap: 4px 18px; }
    dd { font-size: var(--t-md); }
  }
</style>
