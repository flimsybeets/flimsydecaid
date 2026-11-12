<script lang="ts">
  import { tick, untrack } from 'svelte';
  import { app } from '../../state/app.svelte';
  import { EDITION } from '../../edition';
  import Modal from '../../components/Modal.svelte';
  import ConfirmDialog from '../../components/ConfirmDialog.svelte';
  import Stepper from '../../components/Stepper.svelte';
  import StepPhotoField from './StepPhotoField.svelte';
  import GuideArt from './GuideArt.svelte';
  import StepIcon from './StepIcon.svelte';
  import { cloneWorkflow, type WorkflowPreset } from '../../lib/workflowPresets';
  import {
    addableTemplates, addStep, canRemove, inspectWorkflow, isSmart, itemsToLines, linesToItems, fillText, timerText, moveStep, normaliseWorkflow, removeStep,
    STEP_LIBRARY, updateStep, workflowEquals, MAX_STEPS, type Workflow,
  } from '../../lib/workflow';

  // Edit the steps Guide me walks through: start from a preset, reorder,
  // remove, change the words, list and timer, give a step its own photo, add
  // steps from the library, and export or import the whole thing as JSON.
  // Everything is a draft until Save; photos are not part of an export.

  let { onClose }: { onClose: () => void } = $props();

  const presets = EDITION.guide.presets;
  const fallback = cloneWorkflow(presets[0]!.workflow);
  let draft = $state<Workflow>(cloneWorkflow(app.guideWorkflow));
  let selectedId = $state<string | null>(null);
  let panel = $state<null | 'presets' | 'add' | 'export' | 'import'>(null);
  let confirmPreset = $state<WorkflowPreset | null>(null);
  let confirmDiscard = $state(false);
  let saving = $state(false);
  let error = $state<string | null>(null);

  // Photo changes wait for Save: undefined = unchanged, null = remove, string = new.
  let photos = $state<Record<string, string | null | undefined>>({});
  const dirty = $derived(!workflowEquals(draft, app.guideWorkflow) || Object.values(photos).some((p) => p !== undefined));

  const sel = $derived(draft.steps.find((s) => s.id === selectedId) ?? null);
  const selIndex = $derived(sel ? draft.steps.indexOf(sel) : -1);
  const shownPhoto = (id: string) => (photos[id] !== undefined ? photos[id]! : (app.stepPhotos[id] ?? null));

  // The list box is plain text while editing, so a trailing newline survives typing.
  let listEl = $state<HTMLElement>();
  let detailEl = $state<HTMLElement>();
  /** Stacked (narrow) layout: the fields are under the list, so bring them into view on a tap. */
  function pick(id: string) {
    selectedId = id;
    if (matchMedia('(max-width: 700px)').matches) void tick().then(() => detailEl?.scrollIntoView({ block: 'start', behavior: 'smooth' }));
  }
  let itemsText = $state('');
  $effect(() => {
    const id = selectedId;
    if (id) {
      // Only when another step is picked: reading the draft here would re-run this on
      // every keystroke and put back the cleaned-up list, eating spaces and new lines.
      itemsText = untrack(() => itemsToLines(draft.steps.find((s) => s.id === id)?.items));
      untrack(() => void app.loadStepPhoto(id));
      void tick().then(() => {
        const row = listEl?.querySelector<HTMLElement>('.row-item.lit');
        if (listEl && row) {
          if (row.offsetTop < listEl.scrollTop) listEl.scrollTop = row.offsetTop;
          else if (row.offsetTop + row.offsetHeight > listEl.scrollTop + listEl.clientHeight) listEl.scrollTop = row.offsetTop + row.offsetHeight - listEl.clientHeight;
        }
      });
    }
  });

  // Sample values for the preview's {tokens}.
  const sample = { dose: '18.0', beans: 'beans of your coffee', coffee: 'Your coffee', grind: '14', source: 'From your last shot with this bag', start: 'start' };
  const previewTitle = $derived(sel ? fillText(sel.title, sample) : '');
  const previewBody = $derived(sel ? fillText(sel.body, sample) : '');

  const patch = (p: Parameters<typeof updateStep>[2]) => { if (sel) draft = updateStep(draft, sel.id, p); };
  const move = (id: string, by: -1 | 1) => { draft = moveStep(draft, id, by); };
  function remove(id: string) {
    draft = removeStep(draft, id);
    if (selectedId === id) selectedId = null;
  }
  function add(t: Parameters<typeof addStep>[1]) {
    const r = addStep(draft, t);
    if (r.id) { draft = r.workflow; selectedId = r.id; panel = null; }
  }
  function usePreset(p: WorkflowPreset) {
    draft = cloneWorkflow(p.workflow);
    selectedId = null;
    panel = null;
  }

  // Sharing: JSON in and out.
  const json = $derived(JSON.stringify(draft, null, 2));
  let copied = $state<'yes' | 'manual' | null>(null);
  let exportBox = $state<HTMLTextAreaElement>();
  async function copy() {
    try {
      await navigator.clipboard.writeText(json);
      copied = 'yes';
    } catch {
      exportBox?.focus();
      exportBox?.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch { /* manual */ }
      copied = ok ? 'yes' : 'manual';
    }
  }
  let pasted = $state('');
  const inspected = $derived.by(() => {
    if (!pasted.trim()) return null;
    try { return inspectWorkflow(JSON.parse(pasted)); } catch (e) { return { workflow: null, notes: [`That is not valid JSON (${(e as Error).message}).`] }; }
  });
  function importIt() {
    if (!inspected?.workflow) return;
    draft = inspected.workflow;
    selectedId = null;
    pasted = '';
    panel = null;
  }

  function close() {
    if (dirty) confirmDiscard = true;
    else onClose();
  }

  async function save() {
    saving = true;
    error = null;
    try {
      const clean = normaliseWorkflow(draft, fallback);
      await app.saveGuideWorkflow(clean);
      const ids = new Set(clean.steps.map((s) => s.id));
      for (const [id, p] of Object.entries(photos)) {
        if (p === undefined || !ids.has(id)) continue;
        if (p) await app.saveStepPhoto(id, p);
        else await app.removeStepPhoto(id);
      }
      onClose();
    } catch (e) {
      error = `Couldn't save: ${(e as Error).message}`;
    } finally {
      saving = false;
    }
  }
</script>

<Modal title="Guide me steps" wide onClose={close}>
  <div class="bar">
    <label class="name"><span class="sr-only">Name of this set of steps</span><input class="well" bind:value={draft.name} maxlength="60" placeholder="Name" /></label>
    <div class="tools" role="group" aria-label="Tools">
      <button class="chip glass" aria-pressed={panel === 'presets'} onclick={() => (panel = panel === 'presets' ? null : 'presets')}>Start from…</button>
      <button class="chip glass" aria-pressed={panel === 'add'} disabled={draft.steps.length >= MAX_STEPS} onclick={() => (panel = panel === 'add' ? null : 'add')}>Add a step</button>
      <button class="chip glass" aria-pressed={panel === 'export'} onclick={() => { copied = null; panel = panel === 'export' ? null : 'export'; }}>Export</button>
      <button class="chip glass" aria-pressed={panel === 'import'} onclick={() => (panel = panel === 'import' ? null : 'import')}>Import</button>
    </div>
  </div>

  {#if panel === 'presets'}
    <div class="panel">
      <p class="hint">Replaces the steps below (nothing is saved until you press Save).</p>
      <ul class="opts">
        {#each presets as p (p.id)}
          <li><button class="opt glass" onclick={() => (confirmPreset = p)}><b>{p.name}</b><small>{p.description}</small></button></li>
        {/each}
      </ul>
    </div>
  {:else if panel === 'add'}
    <div class="panel">
      <div class="adds">
        {#each addableTemplates(draft) as t (t)}
          <button class="card glass" onclick={() => add(t)}>
            <span class="thumb"><GuideArt sceneKey={t} stepId="thumb-{t}" photoUrl={null} still /></span>
            <span class="cname">{STEP_LIBRARY[t].kind}</span>
          </button>
        {/each}
      </div>
    </div>
  {:else if panel === 'export'}
    <div class="panel">
      <p class="hint">Your steps as text, to keep or send. Photos are not included.</p>
      <textarea class="well code" readonly rows="6" bind:this={exportBox} value={json} onfocus={(e) => e.currentTarget.select()}></textarea>
      <div class="row">
        <button class="chip glass solid" onclick={copy}>Copy</button>
        {#if copied === 'yes'}<span class="ok">Copied</span>{:else if copied === 'manual'}<span class="hint">Select the text above and copy it.</span>{/if}
      </div>
    </div>
  {:else if panel === 'import'}
    <div class="panel">
      <p class="hint">Paste steps exported from here. They replace the steps below.</p>
      <textarea class="well code" rows="5" placeholder={'{ "version": 1, "name": "…", "steps": [ … ] }'} bind:value={pasted}></textarea>
      {#if inspected}
        {#if !inspected.workflow}
          <p class="error">{inspected.notes[0]}</p>
        {:else}
          <p class="ok">{inspected.workflow.steps.length} steps · {inspected.workflow.name}</p>
          {#each inspected.notes as n (n)}<p class="hint">{n}</p>{/each}
        {/if}
      {/if}
      <div class="row"><button class="chip glass solid" disabled={!inspected?.workflow} onclick={importIt}>Use these steps</button></div>
    </div>
  {/if}

  <div class="cols" class:hide={panel === 'add'}>
    <ol class="list" aria-label="Steps" bind:this={listEl}>
      {#each draft.steps as s, i (s.id)}
        <li class="row-item" class:lit={s.id === selectedId}>
          <button class="pick" onclick={() => pick(s.id)} aria-current={s.id === selectedId}>
            <span class="n">{i + 1}</span>
            <span class="ico"><StepIcon kind={s.template} /></span>
            <span class="t"><b>{s.title}</b><small>{STEP_LIBRARY[s.template].kind}{s.timer ? ` · ${s.timer} s timer` : ''}{shownPhoto(s.id) ? ' · photo' : ''}</small></span>
          </button>
          <button class="mini glass" aria-label="Move up" disabled={i === 0 || s.template === 'done'} onclick={() => move(s.id, -1)}>▲</button>
          <button class="mini glass" aria-label="Move down" disabled={s.template === 'done' || i >= draft.steps.length - 2} onclick={() => move(s.id, 1)}>▼</button>
          <button class="mini glass danger" aria-label="Remove {s.title}" disabled={!canRemove(s)} onclick={() => remove(s.id)}>✕</button>
        </li>
      {/each}
    </ol>

    <div class="detail" bind:this={detailEl}>
      {#if sel}
        <p class="kind">{STEP_LIBRARY[sel.template].kind}{isSmart(sel.template) ? ' · follows the scale or machine' : ''}</p>
        <div class="preview glass" aria-label="Preview of this step in the guide">
          <div class="pic">{#key sel.template}<GuideArt sceneKey={sel.template} stepId={sel.id} photoUrl={shownPhoto(sel.id)} still />{/key}</div>
          <div class="pcopy">
            <b>{previewTitle}</b>
            {#if previewBody}<p>{previewBody}</p>{/if}
            {#if sel.items?.length}
              <ol>{#each sel.items.slice(0, 3) as g, i (i)}<li>{g}</li>{/each}</ol>
              {#if sel.items.length > 3}<span class="tm">+ {sel.items.length - 3} more</span>{/if}
            {/if}
            {#if sel.timer}<span class="tm">Timer · {timerText(sel.timer)}</span>{/if}
          </div>
        </div>
        <div class="two">
          <label><span>Title</span><input class="well" value={sel.title} maxlength="80" oninput={(e) => patch({ title: e.currentTarget.value })} /></label>
          <label><span>Progress bar name</span><input class="well" value={sel.label} maxlength="16" oninput={(e) => patch({ label: e.currentTarget.value })} /></label>
        </div>
        <label><span>Words <small class="hint">can use {'{dose}'} {'{beans}'} {'{coffee}'} {'{grind}'}</small></span>
          <textarea class="well" rows="2" maxlength="400" value={sel.body} oninput={(e) => patch({ body: e.currentTarget.value })}></textarea>
        </label>
        <label><span>List, one line each</span>
          <textarea class="well" rows={Math.min(8, Math.max(3, itemsText.split("\n").length))} bind:value={itemsText} oninput={() => patch({ items: linesToItems(itemsText) })}></textarea>
        </label>
        {#if !isSmart(sel.template)}
          <Stepper compact label="Timer" hint="0 = none" unit=" s" min={0} max={3600} step={5} bind:value={() => sel.timer ?? 0, (v) => patch({ timer: v && v > 0 ? v : undefined })} />
        {/if}
        <div class="field">
          <span>Picture</span>
          {#key sel.id}<StepPhotoField shown={shownPhoto(sel.id)} onChange={(url) => (photos[sel.id] = url)} />{/key}
        </div>
        {#if selIndex >= 0}<span class="sr-only">Step {selIndex + 1}</span>{/if}
      {:else}
        <p class="empty">Tap a step to change its words, list, timer or picture.</p>
      {/if}
    </div>
  </div>

  {#if error}<p class="error" role="alert">{error}</p>{/if}

  {#snippet actions()}
    <button class="secondary glass" onclick={close}>Cancel</button>
    <button class="primary glass solid" disabled={saving || !dirty} onclick={save}>{saving ? 'Saving…' : 'Save'}</button>
  {/snippet}
</Modal>

{#if confirmPreset}
  {@const p = confirmPreset}
  <ConfirmDialog
    title="Start from {p.name}?"
    message="This replaces the steps in the list. Nothing is saved until you press Save, and Cancel keeps what you had."
    action="Use {p.name}"
    onConfirm={() => usePreset(p)}
    onClose={() => (confirmPreset = null)}
  />
{/if}

{#if confirmDiscard}
  <ConfirmDialog
    title="Discard your changes?"
    message="The steps and pictures you changed here haven't been saved."
    action="Discard changes"
    onConfirm={onClose}
    onClose={() => (confirmDiscard = false)}
  />
{/if}

<style>
  .bar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  .two { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); gap: 10px; }
  .name { flex: 1; min-width: 180px; }
  .tools { display: flex; gap: 8px; flex-wrap: wrap; }
  label, .field { display: grid; gap: 4px; color: var(--paper-dim); font-size: var(--t-sm); min-width: 0; }
  input, textarea { min-width: 0; width: 100%; box-sizing: border-box; min-height: var(--touch); padding: 0 12px; border-radius: var(--radius-control); border: 1px solid rgb(255 255 255 / 0.08); color: var(--paper); font-size: var(--t-md); user-select: text; font-family: inherit; }
  textarea { padding: 8px 12px; resize: none; line-height: 1.3; min-height: 0; }
  textarea.code { font-family: ui-monospace, monospace; font-size: var(--t-xs); }
  input:focus, textarea:focus { outline: none; border-color: rgb(255 255 255 / 0.45); }
  .chip { min-height: 40px; padding: 0 14px; border-radius: var(--radius-pill); color: var(--paper); font-size: var(--t-xs); font-weight: 650; }
  .chip:disabled { opacity: 0.4; }
  .panel { display: grid; gap: 8px; padding: 10px; border-radius: 14px; background: rgb(255 255 255 / 0.04); }
  .hint { color: var(--paper-faint); font-size: var(--t-xs); }
  .ok { color: var(--go); font-weight: 650; font-size: var(--t-sm); }
  .error { color: var(--stop); }
  .row { display: flex; align-items: center; gap: 10px; }
  .opts { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 8px; }
  .opt { width: 100%; min-height: 52px; padding: 6px 12px; border-radius: 12px; text-align: left; display: grid; color: var(--paper); }
  .opt small { color: var(--paper-faint); font-weight: 500; font-size: var(--t-xs); }
  .adds { display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 8px; max-height: 275px; overflow-y: auto; padding: 2px; }
  .card { min-height: 0; padding: 6px 6px 8px; border-radius: 12px; display: grid; gap: 4px; color: var(--paper); text-align: center; justify-items: center; }
  .thumb { display: block; width: 100%; height: 64px; overflow: hidden; border-radius: 8px; }
  .thumb :global(svg), .thumb :global(img) { width: 100%; height: 100%; }
  .cname { font-size: var(--t-xs); font-weight: 650; line-height: 1.15; }
  .ico { flex: none; width: 28px; height: 28px; display: grid; }
  .preview { display: grid; grid-template-columns: 140px minmax(0, 1fr); gap: 10px; align-items: center; padding: 8px; border-radius: 14px; }
  .pic { height: 110px; min-width: 0; display: grid; overflow: hidden; border-radius: 10px; }
  .pic :global(svg), .pic :global(img) { width: 100%; height: 100%; }
  .pcopy { display: grid; gap: 3px; min-width: 0; align-content: center; max-height: 110px; overflow: hidden; }
  .pcopy b { font-size: var(--t-md); line-height: 1.15; overflow-wrap: anywhere; }
  .pcopy p { color: var(--paper-dim); font-size: var(--t-xs); line-height: 1.25; margin: 0; white-space: pre-line; }
  .pcopy ol { margin: 0; padding-left: 1.2em; font-size: var(--t-xs); line-height: 1.25; color: var(--paper); }
  .tm { color: var(--paper-faint); font-size: var(--t-xs); }

  .cols.hide { display: none; }
  .cols { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 14px; align-items: start; }
  .list { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; max-height: 275px; overflow-y: auto; align-content: start; }
  .row-item { display: flex; align-items: center; gap: 4px; padding: 2px; border-radius: 12px; }
  .row-item.lit { background: rgb(255 255 255 / 0.1); box-shadow: inset 0 0 0 2px var(--go); }
  .pick { flex: 1; min-width: 0; min-height: 44px; display: flex; align-items: center; gap: 10px; padding: 0 8px; text-align: left; color: var(--paper); }
  .n { flex: none; width: 1.7em; height: 1.7em; display: grid; place-items: center; border-radius: 50%; border: 1.5px solid rgb(255 255 255 / 0.3); font-size: var(--t-xs); font-weight: 700; color: var(--paper-dim); }
  .t { display: grid; min-width: 0; }
  .t b { font-weight: 650; font-size: var(--t-sm); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .t small { color: var(--paper-faint); font-size: var(--t-xs); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .mini { flex: none; width: 40px; height: 40px; border-radius: 10px; color: var(--paper-dim); font-size: var(--t-xs); }
  .mini.danger { color: #ffb3ab; }
  .mini:disabled { opacity: 0.25; }
  .detail { display: grid; gap: 8px; max-height: 275px; overflow-y: auto; overflow-x: hidden; align-content: start; padding: 2px; }
  .kind { color: rgb(var(--accent, 143 211 192)); font-size: var(--t-xs); font-weight: 650; text-transform: uppercase; letter-spacing: 0.06em; }
  .field > span, label > span { color: var(--paper-dim); }
  .empty { color: var(--paper-faint); padding: 8px 4px; }
  .primary, .secondary { min-height: var(--touch); padding: 0 21px; border-radius: var(--radius-control); font-weight: 650; }
  .secondary { color: var(--paper-dim); }
  .primary:disabled { opacity: 0.4; }

  @media (max-width: 700px) { .cols { grid-template-columns: 1fr; } .preview { grid-template-columns: 1fr; } .list, .detail { max-height: none; } }
  /* While typing, the keyboard takes the room: a short list, the form on top. */
  :global(html.kb-open) .list { max-height: 120px; }
  :global(html.kb-open) .detail { max-height: none; }
  :global(html.kb-open) .preview, :global(html.kb-open) .adds { display: none; }
</style>
