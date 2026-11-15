<script lang="ts">
  import { flushSync, tick, untrack } from 'svelte';
  import { app } from '../../state/app.svelte';
  import { EDITION } from '../../edition';
  import ConfirmDialog from '../../components/ConfirmDialog.svelte';
  import Stepper from '../../components/Stepper.svelte';
  import StepPhotoField from './StepPhotoField.svelte';
  import GuideArt from './GuideArt.svelte';
  import StepIcon from './StepIcon.svelte';
  import CoffeePic from './CoffeePic.svelte';
  import { cloneWorkflow } from '../../lib/workflowPresets';
  import { pickBag, planBrew } from '../../lib/guide';
  import {
    addableTemplates, addStep, canRemove, isSmart, itemsToLines, linesToItems, fillText, timerText, moveStep, normaliseWorkflow, removeStep,
    STEP_LIBRARY, updateStep, workflowEquals, MAX_STEPS, showsCoffee, type SavedSet, type Workflow,
  } from '../../lib/workflow';

  // Guide me, set up in one full-screen page with two tabs:
  //  - Profile & coffee: what the guide brews (one profile, one coffee; the
  //    coffee's newest open bag and its dial-in are used each time).
  //  - Steps: what the person following it is walked through. Reorder, reword,
  //    add from the library, timers and photos, Save as… / Load named sets.
  // Everything is a draft until Save. Guide me is for the rest of the household,
  // so the copy here talks about "them".

  let { tab: startTab = 'setup', onClose }: { tab?: 'setup' | 'steps'; onClose: () => void } = $props();

  // svelte-ignore state_referenced_locally
  let tab = $state<'setup' | 'steps'>(startTab);
  const wasReady = app.guide !== null;

  // ---- Profile & coffee ---------------------------------------------------------
  let profileRoot = $state<string | null>(app.guide?.profileRoot ?? null);
  let beanId = $state<string | null>(app.guide?.beanId ?? null);
  let query = $state('');
  const profiles = $derived(
    [...app.profileLineages.entries()]
      .map(([root, record]) => ({ root, record }))
      .filter(({ record }) => !query.trim() || record.profile.title.toLowerCase().includes(query.trim().toLowerCase()))
      .sort((a, b) => a.record.profile.title.localeCompare(b.record.profile.title)),
  );
  const coffees = $derived(app.beans.filter((b) => !b.archived && pickBag(b.id, app.batches)));
  const brew = $derived.by(() => {
    if (!profileRoot || !beanId) return null;
    const record = app.profileLineages.get(profileRoot);
    if (!record) return null;
    return planBrew(record, profileRoot, pickBag(beanId, app.batches), app.batches, app.workflow.context?.targetDoseWeight ?? 18);
  });
  const setupReady = $derived(!!profileRoot && !!beanId);
  const setupDirty = $derived(setupReady && (profileRoot !== app.guide?.profileRoot || beanId !== app.guide?.beanId));
  let confirmRemoveSetup = $state(false);
  async function removeSetup() {
    await app.removeGuide();
    profileRoot = null;
    beanId = null;
  }

  // ---- Steps --------------------------------------------------------------------
  const presets = EDITION.guide.presets;
  const fallback = cloneWorkflow(presets[0]!.workflow);
  let draft = $state<Workflow>(cloneWorkflow(app.guideWorkflow));
  let selectedId = $state<string | null>(null);
  let panel = $state<null | 'add' | 'load' | 'save'>(null);
  let confirmLoad = $state<{ name: string; workflow: Workflow } | null>(null);
  let confirmDelete = $state<SavedSet | null>(null);
  let confirmDiscard = $state(false);
  let saving = $state(false);
  let error = $state<string | null>(null);
  void app.loadSavedSets().catch(() => {});

  // Photo changes wait for Save: undefined = unchanged, null = remove, string = new.
  let photos = $state<Record<string, string | null | undefined>>({});
  const stepsDirty = $derived(!workflowEquals(draft, app.guideWorkflow) || Object.values(photos).some((p) => p !== undefined));
  const dirty = $derived(stepsDirty || setupDirty);

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

  // Sample values for the preview's {tokens}: the chosen coffee and dial-in when known.
  const coffeeName = $derived(app.beans.find((b) => b.id === beanId)?.name ?? 'your coffee');
  // The coffee's photo, for the dose and grind steps' "Show a picture of the coffee".
  $effect(() => { if (beanId && sel && showsCoffee(sel.template)) void app.loadBeanPhoto(beanId); });

  // Quick inserts for {tokens}: a button per token, showing what it becomes with the current setup.
  const TOKENS = [
    { key: 'dose', label: 'Dose' },
    { key: 'beans', label: 'Beans' },
    { key: 'coffee', label: 'Coffee' },
    { key: 'grind', label: 'Grind' },
    { key: 'start', label: 'Start word' },
  ] as const;
  /** Insert `{key}` at the caret (or at the end when the field isn't focused) and let its input handler pick it up. */
  function insertToken(el: HTMLInputElement | HTMLTextAreaElement | undefined, key: string) {
    if (!el) return;
    const tok = `{${key}}`;
    const focused = document.activeElement === el;
    const start = focused ? (el.selectionStart ?? el.value.length) : el.value.length;
    const end = focused ? (el.selectionEnd ?? start) : start;
    const before = el.value.slice(0, start), after = el.value.slice(end);
    // a space either side unless there's one already (or it's the start/end)
    const pre = before && !/\s$/.test(before) ? ' ' : '', post = after && !/^[\s.,!?;:]/.test(after) ? ' ' : '';
    if (el.maxLength > 0 && el.value.length - (end - start) + pre.length + tok.length + post.length > el.maxLength) return;
    el.setRangeText(pre + tok + post, start, end, 'end');
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }
  let titleEl = $state<HTMLInputElement>();
  let bodyEl = $state<HTMLTextAreaElement>();

  const sample = $derived({
    dose: (brew?.dose ?? 18).toFixed(1), beans: `beans of ${coffeeName}`, coffee: coffeeName, grind: brew?.grind ?? '14',
    source: 'From your last shot with this bag', start: 'start',
  });
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

  // ---- Save as… / Load ---------------------------------------------------------
  // svelte-ignore state_referenced_locally
  let saveName = $state(draft.name);
  let savedNote = $state<string | null>(null);
  const nameTaken = $derived(app.savedSets.some((s) => s.name.trim().toLowerCase() === saveName.trim().toLowerCase()));
  async function saveAs() {
    const name = saveName.trim();
    if (!name) return;
    try {
      await app.saveSet(normaliseWorkflow(draft, fallback), name);
      draft = { ...draft, name };
      savedNote = `Saved as “${name}”.`;
    } catch (e) {
      savedNote = `Couldn't save: ${(e as Error).message}`;
    }
  }
  function load(w: Workflow) {
    draft = cloneWorkflow(w);
    saveName = draft.name;
    selectedId = null;
    panel = null;
  }
  const when = (iso: string) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }); };

  // ---- Close / save ---------------------------------------------------------------
  function close() {
    if (dirty) confirmDiscard = true;
    else onClose();
  }
  // Escape: only when nothing sits on top (a confirm dialog handles its own).
  let root = $state<HTMLElement>();
  // ---- Typing sheet (touch screens) ----------------------------------------------
  // The tablet's keyboard covers most of the page and leaves only a strip, so on a
  // touch screen a text field opens this sheet in the room above the keyboard
  // (`--kb`): its name, any hint and a big box showing what's typed, with Done.
  // Every keystroke goes straight into the draft, as typing in place would.
  interface Sheet { label: string; hint?: string; tokens?: boolean; multiline: boolean; max: number; value: string; set: (v: string) => void; enter?: () => void }
  const touch = typeof window !== 'undefined' && (navigator.maxTouchPoints > 0 || matchMedia('(pointer: coarse)').matches);
  let sheet = $state<Sheet | null>(null);
  let sheetEl = $state<HTMLInputElement | HTMLTextAreaElement>();
  function openSheet(e: FocusEvent, s: Omit<Sheet, 'value'>) {
    if (!touch || sheet) return;
    const field = e.currentTarget as HTMLInputElement | HTMLTextAreaElement;
    // Mount the sheet and move focus to it inside the same tap, so the keyboard stays up.
    flushSync(() => { sheet = { ...s, value: field.value }; });
    const el = sheetEl;
    if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
  }
  function sheetInput(v: string) {
    if (!sheet) return;
    sheet.value = v;
    sheet.set(v);
  }
  function closeSheet() {
    sheetEl?.blur();
    sheet = null;
  }

  function onEscape(e: KeyboardEvent) {
    if (e.key !== 'Escape' || e.defaultPrevented) return;
    if (sheet) { e.preventDefault(); closeSheet(); return; }
    const open = document.querySelectorAll('[role="dialog"][aria-modal="true"]');
    if (open[open.length - 1] !== root) return;
    e.preventDefault();
    if (panel) panel = null;
    else close();
  }

  async function save() {
    saving = true;
    error = null;
    try {
      if (setupDirty && profileRoot && beanId) await app.saveGuide({ profileRoot, beanId });
      if (stepsDirty) {
        const clean = normaliseWorkflow(draft, fallback);
        await app.saveGuideWorkflow(clean);
        const ids = new Set(clean.steps.map((s) => s.id));
        for (const [id, p] of Object.entries(photos)) {
          if (p === undefined || !ids.has(id)) continue;
          if (p) await app.saveStepPhoto(id, p);
          else await app.removeStepPhoto(id);
        }
      }
      onClose();
      // First time set up from the tile: go straight into the guide.
      if (!wasReady && app.guide) app.guiding = true;
    } catch (e) {
      error = `Couldn't save: ${(e as Error).message}`;
    } finally {
      saving = false;
    }
  }
</script>

{#snippet tokenChips(target: () => HTMLInputElement | HTMLTextAreaElement | undefined, where: string)}
  <div class="tokens" role="group" aria-label="Insert into the {where}">
    <span class="tk-lab">Insert</span>
    {#each TOKENS as t (t.key)}
      <!-- mousedown is prevented so the field keeps its focus and caret -->
      <button class="tk glass" title={`Adds {${t.key}}: ${sample[t.key]}`} onmousedown={(e) => e.preventDefault()} onclick={() => insertToken(target(), t.key)}>
        <b>{t.label}</b><small>{sample[t.key]}</small>
      </button>
    {/each}
  </div>
{/snippet}

<svelte:window onkeydown={onEscape} />

<div class="editor" role="dialog" aria-modal="true" aria-label="Guide me" tabindex="-1" bind:this={root}>
  <header class="top">
    <button class="close glass" aria-label="Close" onclick={close}>✕</button>
    <h1>Guide me</h1>
    <span class="spacer"></span>
    <span class="meta">{dirty ? 'Edited' : ''}</span>
    <div class="actions">
      <button class="glass" onclick={close}>Cancel</button>
      <button class="glass solid save" disabled={saving || !dirty} onclick={save}>{saving ? 'Saving…' : 'Save'}</button>
    </div>
  </header>
  <div class="tabs" role="tablist" aria-label="Guide me">
    <button class="tab-btn" role="tab" aria-selected={tab === 'setup'} onclick={() => (tab = 'setup')}>Profile & coffee</button>
    <button class="tab-btn" role="tab" aria-selected={tab === 'steps'} onclick={() => (tab = 'steps')}>Steps <small>{draft.steps.length}</small></button>
  </div>
  {#if error}<p class="error" role="alert">{error}</p>{/if}

  {#if tab === 'setup'}
    <p class="intro">Set it up once, so anyone at home can make your coffee the way you do. The guide puts this profile and coffee on the machine, with your dial-in, and walks them through the steps.</p>
    <div class="setup">
      <section class="pane glass thick">
        <h3>Profile</h3>
        <input class="search well" type="search" placeholder="Search {app.profileLineages.size} profiles" bind:value={query} aria-label="Search profiles" />
        <ul class="opts-list" role="radiogroup" aria-label="Profile">
          {#each profiles as { root, record } (root)}
            <li><button class="opt glass" class:lit={root === profileRoot} role="radio" aria-checked={root === profileRoot} onclick={() => (profileRoot = root)}>{record.profile.title}</button></li>
          {:else}
            <li class="none">No profiles match</li>
          {/each}
        </ul>
      </section>
      <section class="pane glass thick">
        <h3>Coffee</h3>
        <ul class="opts-list" role="radiogroup" aria-label="Coffee">
          {#each coffees as b (b.id)}
            <li><button class="opt glass" class:lit={b.id === beanId} role="radio" aria-checked={b.id === beanId} onclick={() => (beanId = b.id)}>
              <span>{b.name}</span><small>{b.roaster}</small>
            </button></li>
          {:else}
            <li class="none">No coffee with an open bag. Add a bag in Beans.</li>
          {/each}
        </ul>
        <div class="brew">
          {#if brew}
            <b>{brew.dose.toFixed(1)} g in{brew.yield ? ` · ${brew.yield} g out` : ''} · {brew.grind ? `grind ${brew.grind}` : 'no grind saved yet'}</b>
            <span>{brew.source === 'this-bag' ? 'From this bag' : brew.source === 'previous-bag' ? 'From your last bag of this coffee' : 'The profile’s own settings'}. The guide uses whatever the bag remembers at the time.</span>
          {:else}
            <span>Pick a profile and a coffee.</span>
          {/if}
        </div>
        <div class="setup-foot">
          <button class="chip glass" onclick={() => (tab = 'steps')}>Next: the steps ›</button>
          {#if app.guide}<button class="chip glass danger" onclick={() => (confirmRemoveSetup = true)}>Remove Guide me</button>{/if}
        </div>
      </section>
    </div>
  {:else}
    <div class="tools" role="group" aria-label="Tools">
      <label class="setname"><span class="sr-only">Name of these steps</span><input class="well" bind:value={draft.name} maxlength="60" placeholder="Name"
        onfocus={(e) => openSheet(e, { label: 'Name of these steps', multiline: false, max: 60, set: (v) => (draft.name = v) })} /></label>
      <button class="chip glass" aria-pressed={panel === 'add'} disabled={draft.steps.length >= MAX_STEPS} onclick={() => (panel = panel === 'add' ? null : 'add')}>＋ Add a step</button>
      <button class="chip glass" aria-pressed={panel === 'load'} onclick={() => (panel = panel === 'load' ? null : 'load')}>Load…</button>
      <button class="chip glass" aria-pressed={panel === 'save'} onclick={() => { saveName = draft.name; savedNote = null; panel = panel === 'save' ? null : 'save'; }}>Save as…</button>
    </div>

  {#if panel === 'add'}
    <div class="sheet glass thick">
      <div class="sheet-head"><b>Add a step</b><button class="chip glass" onclick={() => (panel = null)}>Done</button></div>
      <div class="adds">
        {#each addableTemplates(draft) as t (t)}
          <button class="card glass" onclick={() => add(t)}>
            <span class="thumb"><GuideArt sceneKey={t} stepId="thumb-{t}" photoUrl={null} still /></span>
            <span class="cname">{STEP_LIBRARY[t].kind}</span>
          </button>
        {/each}
      </div>
    </div>
  {:else if panel === 'load'}
    <div class="sheet glass thick">
      <div class="sheet-head"><b>Load steps</b><button class="chip glass" onclick={() => (panel = null)}>Done</button></div>
      <div class="sheet-body">
        <p class="hint">Loading replaces the steps in the list. Nothing changes for the guide until you press Save.</p>
        {#if app.savedSets.length}
          <h3>Saved</h3>
          <ul class="opts">
            {#each app.savedSets as s (s.id)}
              <li class="saved">
                <button class="opt glass" onclick={() => (confirmLoad = { name: s.name, workflow: s.workflow })}><b>{s.name}</b><small>{s.workflow.steps.length} steps{when(s.savedAt) ? ` · ${when(s.savedAt)}` : ''}</small></button>
                <button class="mini glass danger" aria-label="Delete {s.name}" onclick={() => (confirmDelete = s)}>✕</button>
              </li>
            {/each}
          </ul>
        {/if}
        <h3>Presets</h3>
        <ul class="opts">
          {#each presets as p (p.id)}
            <li><button class="opt glass" onclick={() => (confirmLoad = { name: p.name, workflow: p.workflow })}><b>{p.name}</b><small>{p.description}</small></button></li>
          {/each}
        </ul>
      </div>
    </div>
  {:else}
    {#if panel === 'save'}
      <div class="panel glass thick">
        <p class="hint">Keep a copy of these steps to load later, say one for weekdays and one for guests. Words, lists and timers are kept; photos stay with the steps in use.</p>
        <div class="row">
          <input class="well saveas" bind:value={saveName} maxlength="60" placeholder="Name" aria-label="Save as" onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void saveAs(); } }}
            onfocus={(e) => openSheet(e, { label: 'Save as', multiline: false, max: 60, set: (v) => (saveName = v), enter: () => void saveAs() })} />
          <button class="chip glass solid" disabled={!saveName.trim()} onclick={saveAs}>{nameTaken ? 'Replace' : 'Save'}</button>
        </div>
        {#if savedNote}<p class="ok">{savedNote}</p>{:else if nameTaken}<p class="hint">A saved set has this name; saving replaces it.</p>{/if}
      </div>
    {/if}

    <div class="cols">
      <!-- Plain divs scroll (glass must not be the scroller). -->
      <div class="list-wrap glass thick">
        <ol class="list" aria-label="Steps" bind:this={listEl}>
          {#each draft.steps as s, i (s.id)}
            <li class="row-item" class:lit={s.id === selectedId}>
              <button class="pick" onclick={() => pick(s.id)} aria-current={s.id === selectedId}>
                <span class="n">{i + 1}</span>
                <span class="ico"><StepIcon kind={s.template} /></span>
                <span class="t"><b>{fillText(s.title, sample)}</b><small>{STEP_LIBRARY[s.template].kind}{s.timer ? ` · ${s.timer} s timer` : ''}{shownPhoto(s.id) ? ' · photo' : ''}</small></span>
              </button>
              <button class="mini glass" aria-label="Move up" disabled={i === 0 || s.template === 'done'} onclick={() => move(s.id, -1)}>▲</button>
              <button class="mini glass" aria-label="Move down" disabled={s.template === 'done' || i >= draft.steps.length - 2} onclick={() => move(s.id, 1)}>▼</button>
              <button class="mini glass danger" aria-label="Remove {s.title}" disabled={!canRemove(s)} onclick={() => remove(s.id)}>✕</button>
            </li>
          {/each}
        </ol>
      </div>

      <div class="detail" bind:this={detailEl}>
        {#if sel}
          <p class="kind">Step {selIndex + 1} · {STEP_LIBRARY[sel.template].kind}{isSmart(sel.template) ? ' · follows the scale or machine' : ''}</p>
          <div class="preview glass thick" aria-label="Preview of this step in the guide">
            <div class="pic">{#key sel.template}<GuideArt sceneKey={sel.template} stepId={sel.id} photoUrl={shownPhoto(sel.id)} weight={18} weighState="ok" grind="14" active />{/key}{#if sel.showCoffee && showsCoffee(sel.template)}<CoffeePic beanId={beanId} small />{/if}</div>
            <div class="pcopy">
              <b>{previewTitle}</b>
              {#if previewBody}<p>{previewBody}</p>{/if}
              {#if sel.items?.length}
                <ol>{#each sel.items.slice(0, 5) as g, i (i)}<li>{g}</li>{/each}</ol>
                {#if sel.items.length > 5}<span class="tm">+ {sel.items.length - 5} more</span>{/if}
              {/if}
              {#if sel.timer}<span class="tm">Timer · {timerText(sel.timer)}</span>{/if}
            </div>
          </div>
          <div class="two">
            <label><span>Title</span><input class="well" bind:this={titleEl} value={sel.title} maxlength="80" oninput={(e) => patch({ title: e.currentTarget.value })}
              onfocus={(e) => openSheet(e, { label: 'Title', tokens: true, multiline: false, max: 80, set: (v) => patch({ title: v }) })} /></label>
            <label><span>Progress bar name</span><input class="well" value={sel.label} maxlength="16" oninput={(e) => patch({ label: e.currentTarget.value })}
              onfocus={(e) => openSheet(e, { label: 'Progress bar name', hint: 'A word or two, under the progress bar', multiline: false, max: 16, set: (v) => patch({ label: v }) })} /></label>
          </div>
          {@render tokenChips(() => titleEl, 'title')}
          <label><span>Words</span>
            <textarea class="well" rows="3" maxlength="400" bind:this={bodyEl} value={sel.body} oninput={(e) => patch({ body: e.currentTarget.value })}
              onfocus={(e) => openSheet(e, { label: 'Words', tokens: true, multiline: true, max: 400, set: (v) => patch({ body: v }) })}></textarea>
          </label>
          {@render tokenChips(() => bodyEl, 'words')}
          <label><span>List, one line each</span>
            <textarea class="well" rows={Math.min(12, Math.max(3, itemsText.split("\n").length + 1))} bind:value={itemsText} oninput={() => patch({ items: linesToItems(itemsText) })}
              onfocus={(e) => openSheet(e, { label: 'List, one line each', hint: 'Each line is one item in the checklist', multiline: true, max: 2000, set: (v) => { itemsText = v; patch({ items: linesToItems(v) }); } })}></textarea>
          </label>
          {#if showsCoffee(sel.template)}
            <label class="check" class:on={sel.showCoffee}>
              <input type="checkbox" checked={!!sel.showCoffee} onchange={(e) => patch({ showCoffee: e.currentTarget.checked || undefined })} />
              <span class="box" aria-hidden="true">{sel.showCoffee ? '✓' : ''}</span>
              <span class="ctext"><b>Show a picture of the coffee</b>
                <small>{!beanId ? 'Pick a coffee on the Profile & coffee tab.' : app.beanPhotos[beanId] === null ? 'This coffee has no photo yet: add one from Beans, Edit.' : 'Its photo from Beans, beside the picture, so they use the right bag.'}</small></span>
            </label>
          {/if}
          <div class="extras">
            {#if !isSmart(sel.template)}
              <Stepper compact label="Timer" hint="0 = none" unit=" s" min={0} max={3600} step={5} bind:value={() => sel.timer ?? 0, (v) => patch({ timer: v && v > 0 ? v : undefined })} />
            {/if}
            <div class="field">
              <span>Picture</span>
              {#key sel.id}<StepPhotoField shown={shownPhoto(sel.id)} onChange={(url) => (photos[sel.id] = url)} />{/key}
            </div>
          </div>
        {:else}
          <div class="empty">
            <p>Tap a step on the left to change its words, list, timer or picture.</p>
            <p class="hint">Write each step for someone at home who hasn't made your coffee before: what to do, in what order, and anything that's easy to get wrong. A photo of your own kit helps.</p>
          </div>
        {/if}
      </div>
    </div>
  {/if}
  {/if}

  {#if sheet}
    <div class="type-sheet" role="dialog" aria-modal="true" aria-label={sheet.label}>
      <div class="ts-head">
        <div class="ts-title"><b>{sheet.label}</b>{#if sheet.hint}<small>{sheet.hint}</small>{/if}</div>
        <button class="ts-done glass solid" onmousedown={(e) => e.preventDefault()} onclick={() => { const go = sheet?.enter; closeSheet(); go?.(); }}>Done</button>
      </div>
      {#if sheet.tokens}{@render tokenChips(() => sheetEl, 'sheet')}{/if}
      {#if sheet.multiline}
        <textarea class="ts-field well" bind:this={sheetEl} value={sheet.value} maxlength={sheet.max} oninput={(e) => sheetInput(e.currentTarget.value)}></textarea>
      {:else}
        <input class="ts-field well" bind:this={sheetEl} value={sheet.value} maxlength={sheet.max} enterkeyhint="done"
          oninput={(e) => sheetInput(e.currentTarget.value)}
          onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); const go = sheet?.enter; closeSheet(); go?.(); } }} />
      {/if}
    </div>
  {/if}
</div>

{#if confirmLoad}
  {@const c = confirmLoad}
  <ConfirmDialog
    title="Load {c.name}?"
    message="This replaces the steps in the list. Nothing is saved until you press Save, and Cancel keeps what you had."
    action="Load {c.name}"
    onConfirm={() => load(c.workflow)}
    onClose={() => (confirmLoad = null)}
  />
{/if}

{#if confirmDelete}
  {@const d = confirmDelete}
  <ConfirmDialog
    title="Delete {d.name}?"
    message="The saved copy is deleted. The steps the guide uses now are not changed."
    action="Delete"
    onConfirm={() => void app.deleteSet(d.id)}
    onClose={() => (confirmDelete = null)}
  />
{/if}

{#if confirmRemoveSetup}
  <ConfirmDialog
    title="Remove Guide me?"
    message="The tile on Home goes back to asking for a profile and coffee. The steps are kept."
    action="Remove"
    onConfirm={() => void removeSetup()}
    onClose={() => (confirmRemoveSetup = false)}
  />
{/if}

{#if confirmDiscard}
  <ConfirmDialog
    title="Discard your changes?"
    message="What you changed here hasn't been saved."
    action="Discard changes"
    onConfirm={onClose}
    onClose={() => (confirmDiscard = false)}
  />
{/if}

<style>
  .editor {
    position: fixed;
    inset: 0;
    z-index: 26;
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 14px var(--gutter) calc(14px + var(--kb));
    background:
      radial-gradient(60vmax 48vmax at 4% -6%, rgb(64 170 160 / 0.45), transparent 62%),
      radial-gradient(52vmax 46vmax at 34% 112%, rgb(201 154 216 / 0.28), transparent 62%),
      radial-gradient(40vmax 34vmax at 100% 10%, rgb(242 179 61 / 0.18), transparent 60%),
      linear-gradient(165deg, #12313a, #0a181c 70%);
    overflow: clip;
    animation: appear 200ms ease;
  }
  @keyframes appear { from { opacity: 0; transform: translateY(6px); } }

  .top { flex: none; display: flex; align-items: center; gap: 10px; }
  .close { width: 42px; height: 42px; flex: none; border-radius: 50%; font-size: var(--t-md); color: var(--paper-dim); }
  h1 { font-size: var(--t-xl); font-weight: 700; letter-spacing: -0.01em; }
  .spacer { flex: 1; }
  .pic { position: relative; }
  .check { display: flex; align-items: center; gap: 12px; min-height: 56px; padding: 6px 12px; border-radius: 14px; background: rgb(255 255 255 / 0.04); cursor: pointer; }
  .check input { position: absolute; opacity: 0; width: 1px; height: 1px; }
  .check .box { flex: none; width: 30px; height: 30px; border-radius: 9px; display: grid; place-items: center; border: 2px solid rgb(255 255 255 / 0.35); color: var(--cat-ink); font-weight: 800; }
  .check.on .box { background: var(--go); border-color: var(--go); }
  .check input:focus-visible + .box { outline: 2px solid var(--go); outline-offset: 2px; }
  .ctext { display: grid; gap: 2px; }
  .ctext b { color: var(--paper); font-size: var(--t-sm); }
  .ctext small { color: var(--paper-faint); font-size: var(--t-xs); }
  .tokens { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: -4px; }
  .tk-lab { color: var(--paper-faint); font-size: var(--t-xs); margin-right: 2px; }
  .tk { min-height: 40px; padding: 0 12px; border-radius: var(--radius-pill); display: inline-flex; align-items: center; gap: 6px; line-height: 1; color: var(--paper); font-size: var(--t-xs); }
  .tk b { font-weight: 650; }
  .tk small { color: var(--paper-faint); max-width: 16ch; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .type-sheet .tokens { margin-top: 0; }
  /* Typing sheet: fills the room above the on-screen keyboard (--kb is 0 when the page shrinks instead). */
  .type-sheet {
    position: fixed; left: 0; right: 0; top: 0; bottom: var(--kb, 0px); z-index: 5;
    display: flex; flex-direction: column; gap: 10px; padding: 12px var(--gutter);
    background: linear-gradient(165deg, #12313a, #0a181c 80%);
  }
  .ts-head { flex: none; display: flex; align-items: center; gap: 12px; }
  .ts-title { flex: 1; min-width: 0; display: grid; }
  .ts-title b { font-size: var(--t-lg); }
  .ts-title small { color: var(--paper-faint); font-size: var(--t-xs); }
  .ts-done { min-height: 48px; padding: 0 26px; border-radius: 14px; font-weight: 700; color: var(--ink); }
  .ts-field { flex: 1; min-height: 56px; font-size: var(--t-lg); line-height: 1.35; padding: 10px 14px; }
  input.ts-field { flex: none; }
  /* Real tabs: plain labels on a shared rule, the chosen one underlined and joined to the page. */
  .tabs { flex: none; display: flex; gap: 4px; border-bottom: 1px solid rgb(255 255 255 / 0.14); margin-top: -2px; }
  .tab-btn {
    position: relative; min-height: 48px; padding: 0 20px; margin-bottom: -1px;
    background: none; border: 0; border-radius: 12px 12px 0 0;
    color: var(--paper-faint); font-weight: 650; font-size: var(--t-md); white-space: nowrap;
  }
  .tab-btn[aria-selected='true'] { color: var(--paper); background: rgb(255 255 255 / 0.06); }
  .tab-btn[aria-selected='true']::after {
    content: ''; position: absolute; left: 12px; right: 12px; bottom: 0; height: 3px; border-radius: 3px 3px 0 0; background: var(--go);
  }
  .tab-btn small { color: var(--paper-faint); font-weight: 600; margin-left: 4px; font-size: var(--t-xs); }
  .intro { flex: none; color: var(--paper-dim); font-size: var(--t-sm); max-width: 80ch; }
  .setup { flex: 1; min-height: 0; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 14px; }
  .pane { min-height: 0; display: flex; flex-direction: column; gap: 10px; padding: 12px; border-radius: 18px; }
  .pane h3, .sheet h3 { flex: none; font-size: var(--t-xs); font-weight: 650; text-transform: uppercase; letter-spacing: 0.06em; color: var(--paper-faint); }
  .search { flex: none; min-height: 44px; }
  .opts-list { flex: 1; min-height: 0; overflow-y: auto; list-style: none; margin: 0; padding: 3px; display: grid; gap: 5px; align-content: start; }
  .opts-list .opt { min-height: 48px; font-weight: 600; align-content: center; }
  .opts-list .opt.lit { box-shadow: 0 0 0 3px var(--go), var(--glass-sheen); }
  .none { color: var(--paper-faint); padding: 6px 3px; }
  .brew { flex: none; display: grid; gap: 3px; padding: 10px 4px 0; border-top: 1px solid rgb(255 255 255 / 0.08); }
  .brew b { font-size: var(--t-md); }
  .brew span { color: var(--paper-faint); font-size: var(--t-xs); }
  .setup-foot { flex: none; display: flex; gap: 8px; justify-content: space-between; flex-wrap: wrap; }
  .chip.danger { color: #ffb3ab; }
  .setname { flex: 0 1 260px; min-width: 140px; }
  .setname input { min-height: 40px; font-size: var(--t-sm); }
  .saved { display: flex; gap: 6px; align-items: center; }
  .saved .opt { flex: 1; }
  .saveas { flex: 1; min-height: 44px; }
  .meta { flex: none; color: var(--paper-faint); font-size: var(--t-sm); white-space: nowrap; }
  .actions { flex: none; display: flex; gap: 6px; }
  .actions button { min-height: 44px; padding: 0 18px; border-radius: 12px; font-weight: 650; color: var(--paper); }
  .actions .save { min-width: 98px; color: var(--ink); }
  .actions button:disabled { opacity: 0.4; }

  .tools { flex: none; display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
  .chip { min-height: 40px; padding: 0 14px; border-radius: var(--radius-pill); color: var(--paper); font-size: var(--t-xs); font-weight: 650; }
  .chip:disabled { opacity: 0.4; }
  .chip.solid { color: var(--ink); }
  .sheet-body { flex: 1; min-height: 0; overflow-y: auto; display: grid; gap: 10px; align-content: start; padding: 2px; }

  .panel { flex: none; display: grid; gap: 8px; padding: 12px; border-radius: 16px; }
  .sheet { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 10px; padding: 12px; border-radius: 18px; }
  .sheet-head { display: flex; justify-content: space-between; align-items: center; font-size: var(--t-md); }
  .adds { flex: 1; min-height: 0; overflow-y: auto; display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px; align-content: start; padding: 2px; }
  .card { padding: 8px 8px 10px; border-radius: 14px; display: grid; gap: 6px; color: var(--paper); text-align: center; justify-items: center; }
  .thumb { display: block; width: 100%; height: 96px; overflow: hidden; border-radius: 10px; }
  .thumb :global(svg), .thumb :global(img) { width: 100%; height: 100%; }
  .cname { font-size: var(--t-sm); font-weight: 650; line-height: 1.15; }

  .cols { flex: 1; min-height: 0; display: grid; grid-template-columns: minmax(0, 5fr) minmax(0, 7fr); gap: 14px; }
  .list-wrap { min-height: 0; display: flex; border-radius: 18px; padding: 6px; }
  .list { flex: 1; min-height: 0; list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; overflow-y: auto; align-content: start; }
  .row-item { display: flex; align-items: center; gap: 4px; padding: 2px; border-radius: 12px; }
  .row-item.lit { background: rgb(255 255 255 / 0.1); box-shadow: inset 0 0 0 2px var(--go); }
  .pick { flex: 1; min-width: 0; min-height: 48px; display: flex; align-items: center; gap: 10px; padding: 0 8px; text-align: left; color: var(--paper); }
  .n { flex: none; width: 1.7em; height: 1.7em; display: grid; place-items: center; border-radius: 50%; border: 1.5px solid rgb(255 255 255 / 0.3); font-size: var(--t-xs); font-weight: 700; color: var(--paper-dim); }
  .ico { flex: none; width: 28px; height: 28px; display: grid; }
  .t { display: grid; min-width: 0; }
  .t b { font-weight: 650; font-size: var(--t-sm); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .t small { color: var(--paper-faint); font-size: var(--t-xs); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .mini { flex: none; width: 40px; height: 40px; border-radius: 10px; color: var(--paper-dim); font-size: var(--t-xs); }
  .mini.danger { color: #ffb3ab; }
  .mini:disabled { opacity: 0.25; }

  .detail { min-height: 0; overflow-y: auto; overflow-x: hidden; display: grid; gap: 10px; align-content: start; padding: 2px 4px 2px 2px; }
  .kind { color: rgb(var(--accent, 143 211 192)); font-size: var(--t-xs); font-weight: 650; text-transform: uppercase; letter-spacing: 0.06em; }
  .preview { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr); gap: 14px; align-items: center; padding: 10px; border-radius: 18px; }
  .pic { aspect-ratio: 1.12; min-width: 0; display: grid; overflow: hidden; border-radius: 12px; }
  .pic :global(svg), .pic :global(img) { width: 100%; height: 100%; }
  .pcopy { display: grid; gap: 5px; min-width: 0; align-content: center; }
  .pcopy b { font-size: var(--t-lg); line-height: 1.15; overflow-wrap: anywhere; }
  .pcopy p { color: var(--paper-dim); font-size: var(--t-sm); line-height: 1.3; margin: 0; white-space: pre-line; }
  .pcopy ol { margin: 0; padding-left: 1.2em; font-size: var(--t-sm); line-height: 1.3; color: var(--paper); }
  .tm { color: var(--paper-faint); font-size: var(--t-xs); }
  .two { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); gap: 10px; }
  .extras { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 10px; align-items: start; }
  label, .field { display: grid; gap: 4px; color: var(--paper-dim); font-size: var(--t-sm); min-width: 0; }
  input, textarea { min-width: 0; width: 100%; box-sizing: border-box; min-height: var(--touch); padding: 0 12px; border-radius: var(--radius-control); border: 1px solid rgb(255 255 255 / 0.08); color: var(--paper); font-size: var(--t-md); user-select: text; font-family: inherit; }
  textarea { padding: 8px 12px; resize: none; line-height: 1.3; min-height: 0; }
  input:focus, textarea:focus { outline: none; border-color: rgb(255 255 255 / 0.45); }
  .hint { color: var(--paper-faint); font-size: var(--t-xs); }
  .ok { color: var(--go); font-weight: 650; font-size: var(--t-sm); }
  .error { color: var(--stop); font-size: var(--t-sm); }
  .row { display: flex; align-items: center; gap: 10px; }
  .opts { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 8px; }
  .opt { width: 100%; min-height: 56px; padding: 6px 12px; border-radius: 12px; text-align: left; display: grid; color: var(--paper); }
  .opt small { color: var(--paper-faint); font-weight: 500; font-size: var(--t-xs); }
  .empty { color: var(--paper-faint); padding: 18px 6px; font-size: var(--t-md); display: grid; gap: 10px; max-width: 46ch; }
  .empty .hint { font-size: var(--t-sm); line-height: 1.4; }

  /* Narrow: one column that scrolls as a whole; the fields follow the list. */
  @media (max-width: 700px) {
    .meta, h1 { display: none; }
    .setup { grid-template-columns: 1fr; overflow-y: auto; }
    .pane { min-height: 320px; }
    .cols { display: block; overflow-y: auto; }
    .list-wrap { margin-bottom: 14px; }
    .list { overflow: visible; }
    .detail { overflow: visible; }
    .preview, .extras { grid-template-columns: 1fr; }
    .pic { aspect-ratio: auto; height: 200px; }
  }
  /* While typing, the keyboard takes the room: no preview, a short list, the form gets the rest. */
  :global(html.kb-open) .preview, :global(html.kb-open) .meta, :global(html.kb-open) .intro { display: none; }
  :global(html.kb-open) .cols { grid-template-columns: minmax(0, 4fr) minmax(0, 8fr); }
</style>
