<script lang="ts">
  import { app } from '../../state/app.svelte';
  import type { Profile, ProfileRecord, ProfileStep } from '../../api/types';
  import Stepper from '../../components/Stepper.svelte';
  import Modal from '../../components/Modal.svelte';
  import ConfirmDialog from '../../components/ConfirmDialog.svelte';
  import ProfileCurve from './ProfileCurve.svelte';
  import StepInspector from './StepInspector.svelte';
  import { toggleProfile } from '../../lib/categories';
  import { samplesFromMeasurements, type ShotSample } from '../../lib/shot';
  import {
    blankProfile, duplicateStep, EditHistory, exitText, insertStep, moveStep, newStep, normalizeProfile,
    profileCurve, remapCountStart, removeStep, stepTarget, validateProfile,
  } from '../../lib/profileEdit';

  // Full-screen profile editor. Draft-only until Save: nothing reaches the
  // machine or Decaid while editing. Save makes a new version of the profile
  // (categories and dial-ins follow it); "Save as new" makes an independent
  // copy. Undo/redo cover every change, including a held stepper as one step.

  let { record, seed = null, onclose }: { record: ProfileRecord | null; seed?: Profile | null; onclose: () => void } = $props();

  const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
  const key = (p: Profile) => JSON.stringify(normalizeProfile(p));

  // The editor works on its own copy, taken once when it opens.
  // svelte-ignore state_referenced_locally
  const initial: Profile = record ? clone(record.profile) : seed ? clone(seed) : blankProfile();
  // svelte-ignore state_referenced_locally
  let original = $state<ProfileRecord | null>(record);
  let draft = $state<Profile>(clone(initial));
  let baseline = $state(key(initial));
  let history = EditHistory.of(initial);
  let historyTick = $state(0);
  let selected = $state(0);

  const isNew = $derived(original === null);
  const dirty = $derived(key(draft) !== baseline);
  const issues = $derived(validateProfile(draft));
  const errors = $derived(issues.filter((i) => i.level === 'error'));
  const total = $derived(profileCurve(draft.steps).total);
  // history isn't reactive itself; historyTick marks when it changes.
  const canUndo = $derived.by(() => { void historyTick; return history.canUndo; });
  const canRedo = $derived.by(() => { void historyTick; return history.canRedo; });
  const step = $derived(draft.steps[Math.min(selected, draft.steps.length - 1)]!);

  function commit(next: Profile, field: string | null) {
    draft = next;
    history.push($state.snapshot(draft) as Profile, field);
    historyTick++;
    message = null;
  }
  const snap = () => $state.snapshot(draft) as Profile;
  const patch = (p: Partial<Profile>, field: string) => commit({ ...snap(), ...p }, field);
  const setSteps = (steps: ProfileStep[], sel = selected, field: string | null = null) => {
    selected = Math.max(0, Math.min(sel, steps.length - 1));
    commit({ ...snap(), steps, target_volume_count_start: remapCountStart(draft.target_volume_count_start ?? 0, steps.length) }, field);
  };

  function undo() { const v = history.undo(); if (v) { draft = v; selected = Math.min(selected, v.steps.length - 1); historyTick++; } }
  function redo() { const v = history.redo(); if (v) { draft = v; selected = Math.min(selected, v.steps.length - 1); historyTick++; } }

  function onkey(e: KeyboardEvent) {
    const target = e.target as HTMLElement | null;
    if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
    if (!(e.ctrlKey || e.metaKey)) return;
    const k = e.key.toLowerCase();
    if (k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
    else if ((k === 'z' && e.shiftKey) || k === 'y') { e.preventDefault(); redo(); }
    else if (k === 's') { e.preventDefault(); void save(false); }
  }

  // Last real shot with this profile, drawn faintly behind the plan.
  let overlay = $state<ShotSample[]>([]);
  let showOverlay = $state(true);
  $effect(() => {
    const title = original?.profile.title;
    if (!title) { overlay = []; return; }
    let live = true;
    void app.lastShotFor(title).then((shot) => { if (live) overlay = shot ? samplesFromMeasurements(shot.measurements ?? []) : []; });
    return () => { live = false; };
  });

  // Saving
  let saving = $state<'save' | 'copy' | null>(null);
  let message = $state<{ text: string; tone: 'ok' | 'warn' | 'bad' } | null>(null);

  async function save(asCopy: boolean) {
    if (saving || errors.length) return;
    if (!asCopy && !isNew && !dirty) { message = { text: 'Nothing to save', tone: 'ok' }; return; }
    saving = asCopy ? 'copy' : 'save';
    message = null;
    try {
      const res = await app.saveProfile(snap(), original, asCopy);
      if (res.kind === 'same-as') {
        message = { text: `Same steps and targets as “${res.record.profile.title}”, so nothing new was saved.`, tone: 'warn' };
        return;
      }
      original = res.record;
      draft = clone(res.record.profile);
      baseline = key(draft);
      history = EditHistory.of(snap());
      historyTick++;
      message = {
        text: res.kind === 'version' ? 'Saved as a new version. The previous one is kept.'
          : res.kind === 'created' ? (asCopy ? 'Saved as a new profile.' : 'Profile created.')
          : res.kind === 'renamed' ? 'Saved.' : 'Nothing to save',
        tone: 'ok',
      };
    } catch (e) {
      const msg = (e as Error).message;
      message = {
        text: /default/i.test(msg) ? "Decaid's built-in profiles can't be renamed. Use Save as new to make your own." : `Couldn't save: ${msg}`,
        tone: 'bad',
      };
    } finally {
      saving = null;
    }
  }

  // Categories follow the lineage, so they need a saved profile.
  const root = $derived(original ? app.rootOf(original.id) : null);
  let catBusy = $state(false);
  async function toggleCategory(id: string) {
    if (!root) return;
    catBusy = true;
    try { await app.saveCategories(toggleProfile(app.categories, id, root)); } finally { catBusy = false; }
  }

  let confirmClose = $state(false);
  let confirmDelete = $state(false);
  const versionCount = $derived(root ? app.profiles.filter((r) => app.rootOf(r.id) === root).length : 0);
  function close() {
    if (dirty) confirmClose = true;
    else onclose();
  }

  const beverages: Profile['beverage_type'][] = ['espresso', 'pourover', 'manual', 'calibrate', 'cleaning'];
  const unitOf = (s: ProfileStep) => (s.pump === 'pressure' ? 'bar' : 'ml/s');
</script>

<svelte:window onkeydown={onkey} />

<section class="editor" aria-label="Profile editor">
  <header class="top">
    <button class="close glass" aria-label="Close editor" onclick={close}>✕</button>
    <input class="title" aria-label="Profile title" value={draft.title} placeholder="Title"
      oninput={(e) => patch({ title: e.currentTarget.value }, 'title')} />
    <span class="meta">{draft.steps.length} {draft.steps.length === 1 ? 'step' : 'steps'} · up to {Math.round(total)} s{dirty ? ' · edited' : ''}</span>
    <div class="actions">
      <button class="icon glass" aria-label="Undo" title="Undo (Ctrl+Z)" disabled={!canUndo} onclick={undo}>↶</button>
      <button class="icon glass" aria-label="Redo" title="Redo (Ctrl+Shift+Z)" disabled={!canRedo} onclick={redo}>↷</button>
      {#if !isNew}
        <button class="glass" disabled={saving !== null || errors.length > 0} onclick={() => save(true)}>{saving === 'copy' ? 'Saving…' : 'Save as new'}</button>
      {/if}
      <button class="glass solid save" disabled={saving !== null || errors.length > 0 || (!isNew && !dirty)} onclick={() => save(false)}>
        {saving === 'save' ? 'Saving…' : isNew ? 'Create profile' : 'Save'}
      </button>
    </div>
  </header>

  {#if message}<p class="message {message.tone}" role="status">{message.text}</p>{/if}

  <!-- One scrolling page under the title bar: chart, steps, then every setting. -->
  <div class="editor-page">
  <div class="chart glass thick">
    <ProfileCurve steps={draft.steps} {selected} onselect={(i) => (selected = i)} overlay={showOverlay ? overlay : []} />
    <div class="legend">
      <span style="--c: var(--g-pressure)"><i></i>Pressure</span>
      <span style="--c: var(--g-flow)"><i></i>Flow</span>
      <span class="t" style="--c: var(--g-puck)"><i></i>Temp</span>
      <span class="d"><i></i>Exit / limit</span>
      {#if overlay.length}
        <button class="ghost-toggle" class:on={showOverlay} aria-pressed={showOverlay} onclick={() => (showOverlay = !showOverlay)}>Last shot</button>
      {/if}
    </div>
  </div>

  <div class="strip" role="listbox" aria-label="Steps">
    {#each draft.steps as s, i (i)}
      <button class="card glass" class:solid={i === selected} role="option" aria-selected={i === selected} onclick={() => (selected = i)}>
        <span class="row1"><b>{i + 1}</b><span class="nm">{s.name || 'step'}</span></span>
        <span class="row2"><i style="background: {s.pump === 'pressure' ? 'var(--g-pressure)' : 'var(--g-flow)'}"></i>{stepTarget(s).toFixed(1)} {unitOf(s)}{s.transition === 'smooth' ? ' ↗' : ''}</span>
        <span class="row3">{s.seconds} s · {s.temperature}°{#if s.exit && s.exit.value > 0}{` · ${exitText(s.exit)}`}{/if}</span>
      </button>
    {/each}
    <button class="card add glass" onclick={() => setSteps(insertStep(snap().steps, selected + 1, newStep(step)), selected + 1)}>
      <span class="plus">+</span><span>Add step</span>
    </button>
  </div>

  <div class="lower">
    <div class="pane glass thick">
      <div class="scroll">
        <StepInspector {step} index={selected} count={draft.steps.length}
          onchange={(next, field) => { const steps = snap().steps; steps[selected] = next; setSteps(steps, selected, field); }}
          onmove={(to) => setSteps(moveStep(snap().steps, selected, to), to)}
          onduplicate={() => setSteps(duplicateStep(snap().steps, selected), selected + 1)}
          ondelete={() => setSteps(removeStep(snap().steps, selected), selected)} />
      </div>
    </div>

    <aside class="pane side glass thick" aria-label="Profile settings">
      <div class="scroll">
        <h3>Stops the shot</h3>
        <div class="two">
          <Stepper compact typeable label="At weight" hint="0 = off" unit="g" min={0} max={500} step={0.5} decimals={1}
            bind:value={() => draft.target_weight ?? 0, (v) => patch({ target_weight: v ?? 0 }, 'target_weight')} />
          <Stepper compact typeable label="At volume" hint="0 = off" unit="ml" min={0} max={1000} step={1} decimals={0}
            bind:value={() => draft.target_volume ?? 0, (v) => patch({ target_volume: v ?? 0 }, 'target_volume')} />
        </div>
        <div class="two">
          <Stepper compact typeable label="Count volume from step" min={1} max={draft.steps.length} step={1}
            bind:value={() => (draft.target_volume_count_start ?? 0) + 1, (v) => patch({ target_volume_count_start: (v ?? 1) - 1 }, 'count_start')} />
          <Stepper compact typeable label="Tank preheat" hint="0 = off" unit="°C" min={0} max={60} step={1}
            bind:value={() => draft.tank_temperature ?? 0, (v) => patch({ tank_temperature: v ?? 0 }, 'tank')} />
        </div>

        <h3>About</h3>
        <label class="field"><span>Type</span>
          <select class="well" value={draft.beverage_type ?? 'espresso'} onchange={(e) => patch({ beverage_type: e.currentTarget.value as Profile['beverage_type'] }, 'beverage')}>
            {#each beverages as b (b)}<option value={b}>{b}</option>{/each}
          </select>
        </label>
        <label class="field"><span>Author</span>
          <input class="well" value={draft.author ?? ''} oninput={(e) => patch({ author: e.currentTarget.value }, 'author')} />
        </label>
        <label class="field"><span>Notes</span>
          <textarea class="well" rows="3" value={draft.notes ?? ''} oninput={(e) => patch({ notes: e.currentTarget.value }, 'notes')}></textarea>
        </label>

        {#if app.categories.categories.length}
          <h3>Categories</h3>
          {#if !root}<p class="hint">Save the profile first.</p>{/if}
          <div class="chips">
            {#each app.categories.categories as c (c.id)}
              {@const on = !!root && c.profiles.includes(root)}
              <button class="chip" class:on style="--tile: var(--cat-{c.colour ?? 1})" aria-pressed={on} disabled={!root || catBusy} onclick={() => toggleCategory(c.id)}>{c.name}</button>
            {/each}
          </div>
        {/if}

        {#if issues.length}
          <h3>Checks</h3>
          <ul class="issues">
            {#each issues as is, k (k)}
              <li class={is.level}>
                {#if is.step !== undefined}<button onclick={() => (selected = is.step!)}>{is.message}</button>{:else}{is.message}{/if}
              </li>
            {/each}
          </ul>
        {/if}
        {#if original}
          <button class="delete" onclick={() => (confirmDelete = true)}>Delete profile</button>
        {/if}
      </div>
    </aside>
  </div>
  </div>
</section>

{#if confirmDelete && root}
  <ConfirmDialog
    title="Delete “{draft.title}”?"
    message="{versionCount > 1 ? `All ${versionCount} versions are` : 'It is'} hidden in Decaid and taken out of its categories{app.guide?.profileRoot === root ? ' and Guide me' : ''}. Shots pulled with it stay in History, and Decaid can unhide it from its own profile settings."
    action="Delete profile"
    onConfirm={async () => { await app.deleteProfile(root!); onclose(); }}
    onClose={() => (confirmDelete = false)}
  />
{/if}

{#if confirmClose}
  <Modal title="Discard your changes?" onClose={() => (confirmClose = false)}>
    <p class="confirm">The edits to “{draft.title}” haven't been saved.</p>
    {#snippet actions()}
      <button class="glass confirm-btn" onclick={() => (confirmClose = false)}>Keep editing</button>
      <button class="glass solid confirm-btn danger" onclick={() => { confirmClose = false; onclose(); }}>Discard</button>
    {/snippet}
  </Modal>
{/if}

<style>
  .editor {
    position: fixed;
    inset: 0;
    z-index: 25;
    display: flex;
    flex-direction: column;
    gap: 9px;
    padding: 14px var(--gutter) calc(16px + var(--kb));
    background:
      radial-gradient(60vmax 48vmax at 4% -6%, rgb(64 170 160 / 0.45), transparent 62%),
      radial-gradient(52vmax 46vmax at 34% 112%, rgb(201 154 216 / 0.28), transparent 62%),
      radial-gradient(40vmax 34vmax at 100% 10%, rgb(242 179 61 / 0.18), transparent 60%),
      linear-gradient(165deg, #12313a, #0a181c 70%);
    animation: appear 200ms ease;
  }
  @keyframes appear { from { opacity: 0; transform: translateY(6px); } }

  .top { flex: none; display: flex; align-items: center; gap: 10px; }
  .close { width: 42px; height: 42px; flex: none; border-radius: 50%; font-size: var(--t-md); color: var(--paper-dim); }
  .title {
    flex: 1;
    min-width: 0;
    background: none;
    border: 0;
    border-bottom: 2px solid transparent;
    font-size: var(--t-xl);
    font-weight: 700;
    letter-spacing: -0.01em;
    padding: 3px 2px;
    user-select: text;
  }
  .title:focus { outline: none; border-bottom-color: rgb(255 255 255 / 0.35); }
  .meta { flex: none; color: var(--paper-faint); font-size: var(--t-sm); white-space: nowrap; }
  .actions { flex: none; display: flex; gap: 6px; }
  .actions button { min-height: 42px; padding: 0 15px; border-radius: 12px; font-weight: 650; color: var(--paper); }
  .actions .icon { width: 42px; padding: 0; font-size: var(--t-lg); }
  .actions .save { min-width: 98px; color: var(--ink); }
  .actions button:disabled { opacity: 0.4; }

  .message { flex: none; margin-top: -4px; font-size: var(--t-sm); }
  .message.ok { color: var(--go); }
  .message.warn { color: var(--warn); }
  .message.bad { color: var(--stop); }

  /* The page scrolls (a plain div: glass must not be the scroller). */
  .editor-page {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin: 0 calc(-1 * var(--gutter));
    padding: 0 var(--gutter) 16px;
  }
  .chart {
    flex: 0 0 clamp(150px, 30vh, 260px);
    display: grid;
    grid-template-rows: minmax(0, 1fr) auto;
    padding: 8px 12px 6px;
    border-radius: 22px;
  }
  .legend { display: flex; align-items: center; gap: 14px; padding-left: 33px; color: var(--paper-dim); font-size: var(--t-xs); }
  .legend span { display: flex; align-items: center; gap: 5px; }
  .legend i { width: 15px; height: 3px; border-radius: 2px; background: var(--c); }
  .legend .d i { height: 0; border-top: 2px dashed var(--paper-dim); background: none; }
  .ghost-toggle { margin-left: auto; min-height: 36px; padding: 0 10px; border-radius: var(--radius-pill); background: var(--well); color: var(--paper-dim); font-size: var(--t-xs); }
  .ghost-toggle.on { background: rgb(255 255 255 / 0.85); color: var(--ink); font-weight: 650; }

  /* While typing, fold the chart and step strip away so the fields stay visible. */
  :global(html.kb-open) .chart, :global(html.kb-open) .strip { display: none; }

  /* Stays at the top while the settings scroll, so another step is always one tap away. */
  .strip {
    flex: none;
    position: sticky;
    top: 0;
    z-index: 2;
    display: flex;
    gap: 6px;
    overflow-x: auto;
    margin: 0 calc(-1 * var(--gutter));
    padding: 6px var(--gutter) 8px;
    background: linear-gradient(rgb(14 34 39 / 0.96) 80%, rgb(14 34 39 / 0));
  }
  .card {
    flex: none;
    width: 126px;
    min-height: 61px;
    padding: 8px 10px;
    border-radius: 15px;
    display: grid;
    gap: 3px;
    text-align: left;
    color: var(--paper);
  }
  .card.solid { color: var(--ink); }
  .card.solid .row2, .card.solid .row3 { color: #33494d; }
  .row1 { display: flex; gap: 6px; align-items: baseline; min-width: 0; }
  .row1 b { font-size: var(--t-xs); opacity: 0.6; }
  .nm { font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .row2 { display: flex; align-items: center; gap: 5px; font-size: var(--t-sm); font-weight: 600; color: var(--paper-dim); }
  .row2 i { width: 7px; height: 7px; border-radius: 50%; flex: none; }
  .row3 { font-size: var(--t-xs); color: var(--paper-faint); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .card.add { width: 90px; place-items: center; align-content: center; color: var(--paper-dim); }
  .plus { font-size: var(--t-lg); line-height: 1; }

  .lower { flex: none; display: grid; grid-template-columns: minmax(0, 1fr) minmax(250px, 30%); gap: 10px; align-items: start; }
  .pane { border-radius: 22px; }
  .scroll { padding: 14px 15px 16px; display: grid; gap: 9px; align-content: start; }

  .side h3 { font-size: var(--t-xs); font-weight: 650; text-transform: uppercase; letter-spacing: 0.06em; color: var(--paper-faint); margin-top: 3px; }
  .two { display: grid; gap: 8px; }
  .field { display: grid; gap: 4px; color: var(--paper-dim); font-size: var(--t-sm); }
  .field input, .field select, .field textarea {
    min-height: 40px;
    padding: 0 10px;
    border-radius: 10px;
    border: 1px solid rgb(255 255 255 / 0.08);
    color: var(--paper);
    font-size: var(--t-sm);
    font-family: inherit;
    user-select: text;
  }
  .field textarea { padding: 9px 10px; resize: vertical; line-height: 1.4; }
  .field :focus { outline: none; border-color: rgb(255 255 255 / 0.45); }
  .hint { color: var(--paper-faint); font-size: var(--t-xs); }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .chip { min-height: 40px; padding: 0 12px; border-radius: var(--radius-pill); background: var(--well); box-shadow: var(--well-shadow); color: var(--paper-dim); font-size: var(--t-xs); }
  .chip.on { background: var(--tile); color: var(--cat-ink); font-weight: 650; }
  .chip:disabled { opacity: 0.5; }
  .issues { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; font-size: var(--t-xs); }
  .issues li { padding-left: 10px; position: relative; }
  .issues li::before { content: ''; position: absolute; left: 0; top: 0.5em; width: 5px; height: 5px; border-radius: 50%; }
  .issues .warn { color: #f6d58f; }
  .issues .warn::before { background: var(--warn); }
  .issues .error { color: #ffb3ab; }
  .issues .error::before { background: var(--stop); }
  .issues button { text-align: left; text-decoration: underline; text-underline-offset: 3px; text-decoration-color: rgb(255 255 255 / 0.25); }

  .delete { justify-self: start; margin-top: 6px; min-height: 40px; padding: 0 14px; border-radius: var(--radius-pill); background: var(--well); color: #ffb3ab; font-size: var(--t-xs); font-weight: 650; }
  .confirm { color: var(--paper-dim); }
  .confirm-btn { min-height: var(--touch); padding: 0 18px; border-radius: var(--radius-control); font-weight: 650; color: var(--paper); }
  .confirm-btn.solid { color: var(--ink); }

  @media (max-width: 1100px) { .meta { display: none; } }
  /* Narrow screens: profile settings go under the step settings. */
  @media (max-width: 820px) { .lower { grid-template-columns: 1fr; } }
</style>
