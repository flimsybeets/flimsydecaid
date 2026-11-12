<script lang="ts">
  import { untrack } from 'svelte';
  import { app } from '../../state/app.svelte';
  import GuideArt from './GuideArt.svelte';
  import { ratioText, shotStats } from '../../lib/history';
  import { followProgress, pickBag, planBrew, weighState } from '../../lib/guide';
  import { afterPull, canGoBack, fillText, timerText } from '../../lib/workflow';

  // "Guide me": the whole routine for one profile + coffee, one step at a
  // time, from weighing beans to rinsing the group. The steps are data (the
  // saved workflow, or the edition's first preset): smart ones follow the
  // scale or the machine, plain ones show their words, an optional list and
  // an optional timer. The profile, bag and dial-in are loaded onto the
  // machine as soon as the guide opens, so it heats to the right temperature
  // while you prep. Pulling hands over to the usual shot view; the guide
  // picks up again when the shot ends.

  let { onclose, covered = false }: { onclose: () => void; covered?: boolean } = $props();

  const setup = $derived(app.guide!);
  const record = $derived(app.profileLineages.get(setup.profileRoot) ?? null);
  const bean = $derived(app.beans.find((b) => b.id === setup.beanId) ?? null);
  const batch = $derived(pickBag(setup.beanId, app.batches));
  const plan = $derived(record ? planBrew(record, setup.profileRoot, batch, app.batches, app.workflow.context?.targetDoseWeight ?? 18) : null);

  const steps = $derived(app.guideWorkflow.steps);
  let at = $state(0);
  const index = $derived(Math.min(at, steps.length - 1));
  const cur = $derived(steps[index]!);
  const kind = $derived(cur.template);

  function go(i: number) {
    at = Math.max(0, Math.min(steps.length - 1, i));
    timerEnd = null;
  }
  // Wet hands double-tap: a second tap on Next or Back within 300 ms is ignored, so it can't skip a step.
  let lastNav = 0;
  const steady = () => { const now = performance.now(); if (now - lastNav < 300) return false; lastNav = now; return true; };
  const next = () => { if (steady()) go(index + 1); };
  const back = () => { if (steady() && canGoBack(app.guideWorkflow, index)) go(index - 1); };

  // The app needs to know the current kind of step: on a steam step the guide shows the steam itself.
  $effect(() => { app.guideTemplate = kind; });
  $effect(() => () => { app.guideTemplate = null; });

  // Load onto the machine once, when the guide opens.
  let loaded = $state<'loading' | 'ok' | 'failed'>('loading');
  let loadError = $state('');
  async function load() {
    if (!record || !plan) return;
    loaded = 'loading';
    try {
      await app.applySelection(setup.profileRoot, batch, plan.dialIn);
      loaded = 'ok';
    } catch (e) {
      loaded = 'failed';
      loadError = (e as Error).message;
    }
  }
  $effect(() => { untrack(() => void load()); });

  // Weighing
  const weigh = $derived(plan ? weighState(app.weight, plan.dose) : { state: 'empty' as const, delta: 0 });
  const tone = $derived(kind === 'weigh' && app.scaleConnected ? weigh.state : kind === 'done' ? 'ok' : 'idle');
  const ring = $derived(plan && app.weight !== null ? Math.max(0, Math.min(1.08, app.weight / plan.dose)) : 0);
  const weighText = $derived.by(() => {
    if (!app.scaleConnected) return app.scanning ? 'Looking for the scale…' : 'No scale connected: weigh it by hand';
    switch (weigh.state) {
      case 'empty': return 'Tare with the empty cup, then add beans';
      case 'under': return `Add ${weigh.delta.toFixed(1)} g`;
      case 'over': return `Take out ${Math.abs(weigh.delta).toFixed(1)} g`;
      default: return 'Spot on';
    }
  });

  // The shot: start it (or wait for the group head); when it ends, carry on.
  let starting = $state(false);
  let startError = $state('');
  let shotsAtStart = 0; // not reactive: just remembers the count when Pull was reached
  $effect(() => { if (kind === 'pull') shotsAtStart = untrack(() => app.shotsFinished); });
  $effect(() => { if (kind === 'pull' && app.shotsFinished !== shotsAtStart) untrack(() => go(afterPull(app.guideWorkflow))); });
  async function startShot() {
    starting = true;
    startError = '';
    try { await app.startEspresso(); } catch (e) { startError = (e as Error).message; } finally { starting = false; }
  }

  // Rinse and steam: started with the machine's own buttons; follow the
  // machine into the state and back out.
  let seenFlush = $state(false);
  let seenSteam = $state(false);
  const machineState = $derived(app.machine.state?.state);
  $effect(() => { if (kind === 'rinse' && machineState === 'flush') seenFlush = true; });
  $effect(() => { if (kind === 'steam' && machineState === 'steam') seenSteam = true; });
  const rinse = $derived(followProgress(seenFlush, machineState, 'flush'));
  const steam = $derived(followProgress(seenSteam, machineState, 'steam'));
  const follow = $derived(kind === 'rinse' ? rinse : kind === 'steam' ? steam : 'waiting');
  $effect(() => {
    if ((kind !== 'rinse' && kind !== 'steam') || follow !== 'finished') return;
    const t = setTimeout(() => untrack(() => next()), 900);
    return () => clearTimeout(t);
  });

  // A plain step's timer: counts down from its seconds once started.
  let timerEnd = $state<number | null>(null);
  let now = $state(Date.now());
  const left = $derived(timerEnd === null ? null : Math.max(0, (timerEnd - now) / 1000));
  $effect(() => {
    if (timerEnd === null || Date.now() >= timerEnd) return;
    now = Date.now();
    const t = setInterval(() => { now = Date.now(); if (now >= timerEnd!) clearInterval(t); }, 250);
    return () => clearInterval(t);
  });
  function startTimer() { now = Date.now(); timerEnd = now + (cur.timer ?? 0) * 1000; }

  // Summary
  const stats = $derived(shotStats(app.shot));
  const shotTime = $derived(app.shot.length ? stats.seconds : null);
  const shotOut = $derived(stats.weight);

  const sourceText = $derived(plan?.source === 'this-bag' ? 'Your setting for this bag'
    : plan?.source === 'previous-bag' ? 'Carried over from your last bag of this coffee'
    : 'Nothing saved for this bag yet');

  // Words in titles and bodies: {dose}, {beans}, {coffee}, {grind}, {source}, {start}.
  const vars = $derived({
    dose: plan ? plan.dose.toFixed(1) : '',
    beans: bean ? `beans of ${bean.name}` : 'beans',
    coffee: bean?.name ?? '',
    grind: plan?.grind ?? '',
    source: plan ? `${sourceText}.${plan.grind ? '' : ' Use your usual setting; save it in the brew panel afterwards.'}` : '',
    start: app.ghc ? 'press brew' : 'start',
  });
  const title = $derived(kind === 'grinder' && plan && !plan.grind && cur.title.includes('{grind}') ? 'Set your grind' : fillText(cur.title, vars));
  const bodyText = $derived(fillText(cur.body, vars));
  // The grind scene loops through five beats; the list follows them only when it has five.
  const beats = $derived(kind === 'grind' && cur.items?.length === 5);
</script>

<section class="guide tone-{tone}" class:covered inert={covered} aria-label="Guided brew">
  <div class="aurora" aria-hidden="true"></div>

  <header>
    <button class="close glass" aria-label="Close the guide" onclick={onclose}>✕</button>
    <div class="what">
      <h2>{record?.profile.title ?? 'Profile missing'}</h2>
      <p>{bean ? `${bean.roaster} ${bean.name}` : 'Coffee missing'}{batch ? '' : ' · no open bag'}</p>
    </div>
    <span class="loaded {loaded}">
      {loaded === 'ok' ? 'On the machine' : loaded === 'loading' ? 'Loading onto the machine…' : 'Not loaded'}
      {#if loaded === 'failed'}<button onclick={load}>Retry</button>{/if}
    </span>
  </header>

  <ol class="rail" aria-label="Steps">
    {#each steps as s, i (s.id)}
      <li class:done={i < index} class:now={i === index}>
        <span class="bar"></span><span class="lbl">{s.label}</span>
      </li>
    {/each}
  </ol>

  {#if !record || !plan}
    <div class="missing glass thick">
      <p class="big">This guide's profile is gone</p>
      <p>It may have been deleted. Set the guide up again from its tile on Home.</p>
    </div>
  {:else}
    <div class="stage">
      <div class="art glass thick">
        <!-- Not drawn while the shot view covers the guide: nothing to animate or update under it. -->
        {#if !covered}
          {#key cur.id}
            <!-- The Tap to connect button is the real control; tapping the scale in the picture does the same. -->
            <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
            <div class="art-in" class:tappable={kind === 'weigh' && !app.scaleConnected && !app.scanning} onclick={() => { if (kind === 'weigh' && !app.scaleConnected && !app.scanning) app.scanForScale(); }}>
              <GuideArt sceneKey={kind} stepId={cur.id} weight={kind === 'weigh' && app.scaleConnected ? app.weight : null} weighState={kind === 'weigh' ? weigh.state : 'empty'} grind={plan.grind} active={follow === 'rinsing'} />
            </div>
          {/key}
        {/if}
      </div>

      <div class="copy">
        {#key cur.id}
          <div class="copy-in" class:dense={(cur.items?.length ?? 0) > 4}>
            <p class="count">Step {index + 1} of {steps.length}</p>
            <h1>{title}</h1>
            {#if kind === 'grinder' && app.grindControl.name}<p class="grinder">{app.grindControl.name}</p>{/if}
            {#if bodyText}<p class="body">{bodyText}</p>{/if}

            {#if kind === 'weigh'}
              <div class="weigh {weigh.state}" class:noscale={!app.scaleConnected}>
                <svg viewBox="0 0 120 120" class="ring" aria-hidden="true">
                  <circle cx="60" cy="60" r="52" class="track" />
                  <circle cx="60" cy="60" r="52" class="fill" style="stroke-dasharray: {Math.min(1, ring) * 326.7} 326.7" />
                </svg>
                <div class="readout">
                  <span class="num"><b>{app.scaleConnected && app.weight !== null ? app.weight.toFixed(1) : '–'}</b><small>g</small></span>
                  <span class="status">{weighText}</span>
                </div>
              </div>
              {#if app.scaleConnected}
                <button class="tare glass" onclick={() => app.tare()}>Tare</button>
              {:else}
                <button class="tare connect glass" onclick={() => app.scanForScale()} disabled={app.scanning} aria-live="polite">{app.scanning ? 'Looking for the scale…' : 'Tap to connect'}</button>
              {/if}
            {/if}

            {#if cur.items?.length}
              <ol class="steps" class:beats aria-label="List">
                {#each cur.items as g, i (i)}<li style="--i: {i}">{g}</li>{/each}
              </ol>
            {/if}

            {#if kind === 'pull'}
              {#if !app.ghc}
                <button class="go-btn start" disabled={starting || loaded === 'loading' || app.shotActive} onclick={startShot}>
                  {app.shotActive ? 'Pulling…' : starting ? 'Starting…' : 'Start shot'}
                </button>
              {:else}
                <p class="waiting"><span class="dot"></span>{app.shotActive ? 'Pulling…' : 'Waiting for the group head'}</p>
              {/if}
              {#if startError}<p class="error">{startError}</p>{/if}
            {:else if kind === 'rinse'}
              {#if rinse === 'rinsing'}
                <p class="waiting"><span class="dot"></span>Rinsing…</p>
              {:else if rinse === 'finished'}
                <p class="waiting ok">Clean</p>
              {:else}
                <p class="waiting"><span class="dot"></span>Press the flush button on the machine</p>
              {/if}
            {:else if kind === 'steam'}
              {#if machineState === 'steam'}
                <p class="waiting"><span class="dot"></span>Steaming…</p>
              {:else if steam === 'finished'}
                <p class="waiting ok">Steamed</p>
              {:else}
                <p class="waiting"><span class="dot"></span>Press the steam button on the machine</p>
              {/if}
            {:else if kind === 'done'}
              <dl class="summary">
                <div><dt>In</dt><dd>{plan.dose.toFixed(1)}<small>g</small></dd></div>
                <div><dt>Out</dt><dd>{shotOut !== null ? shotOut.toFixed(1) : '–'}<small>g</small></dd></div>
                <div><dt>Ratio</dt><dd>{ratioText(plan.dose, shotOut) ?? '–'}</dd></div>
                <div><dt>Time</dt><dd>{shotTime !== null ? shotTime.toFixed(1) : '–'}<small>s</small></dd></div>
              </dl>
            {/if}

            {#if cur.timer}
              {#if left === null}
                <button class="tare timer glass" onclick={startTimer}>Start timer · {timerText(cur.timer)}</button>
              {:else if left > 0}
                <p class="clock" aria-live="off">{timerText(left)}</p>
              {:else}
                <p class="waiting ok">Time's up</p>
                <button class="tare timer glass" onclick={startTimer}>Restart timer</button>
              {/if}
            {/if}
          </div>
        {/key}
      </div>
    </div>

    <footer>
      {#if canGoBack(app.guideWorkflow, index)}<button class="nav glass" onclick={back}>Back</button>{:else}<span></span>{/if}
      {#if kind === 'done'}
        <button class="nav glass solid primary" onclick={onclose}>Finish</button>
      {:else if kind === 'rinse' || kind === 'steam'}
        <button class="nav glass" onclick={next}>{follow === 'finished' ? 'Next' : 'Skip'}</button>
      {:else if kind === 'pull'}
        <button class="nav glass" onclick={() => go(afterPull(app.guideWorkflow))}>Skip the shot</button>
      {:else}
        <button class="nav glass solid primary" class:ready={kind === 'weigh' && weigh.state === 'ok'} onclick={next}>Next</button>
      {/if}
    </footer>
  {/if}
</section>

<style>
  .guide {
    --accent: 143 211 192;
    position: fixed;
    inset: 0;
    z-index: 27;
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px var(--gutter) 14px;
    /* clip, not hidden: the oversized ambient light must never make this scrollable. */
    overflow: clip;
    background: linear-gradient(165deg, #12313a, #091417 70%);
    animation: enter 260ms ease;
  }
  /* Under a full-screen view: hidden, and nothing animates or transitions. */
  .guide.covered { visibility: hidden; }
  .guide.covered, .guide.covered :global(*) { animation: none !important; transition: none !important; }
  @keyframes enter { from { opacity: 0; transform: scale(1.015); } }
  .guide.tone-under { --accent: 242 179 61; }
  .guide.tone-over { --accent: 255 111 97; }
  .guide.tone-ok { --accent: 76 230 140; }

  /* Ambient light that takes on the state's colour. */
  .aurora {
    position: absolute;
    inset: -20%;
    z-index: -1;
    background:
      radial-gradient(40% 45% at 30% 35%, rgb(var(--accent) / 0.35), transparent 70%),
      radial-gradient(35% 40% at 75% 70%, rgb(var(--accent) / 0.22), transparent 70%),
      radial-gradient(30% 30% at 80% 15%, rgb(201 154 216 / 0.18), transparent 70%);
    filter: blur(8px);
    transition: background 500ms ease;
    animation: drift 18s ease-in-out infinite alternate;
  }
  @keyframes drift { from { transform: translate(-3%, -2%) rotate(0deg); } to { transform: translate(3%, 2%) rotate(6deg); } }

  header { flex: none; display: flex; align-items: center; gap: 12px; }
  .close { width: 42px; height: 42px; flex: none; border-radius: 50%; font-size: var(--t-md); color: var(--paper-dim); }
  .what { flex: 1; min-width: 0; }
  h2 { font-size: var(--t-lg); font-weight: 700; }
  .what p { color: var(--paper-dim); }
  .loaded { flex: none; display: flex; align-items: center; gap: 8px; padding: 8px 14px; border-radius: var(--radius-pill); background: var(--well); color: var(--paper-dim); font-size: var(--t-xs); }
  .loaded.ok { color: var(--go); }
  .loaded.ok::before { content: ''; width: 7px; height: 7px; border-radius: 50%; background: var(--go); box-shadow: 0 0 8px var(--go); }
  .loaded.failed { color: var(--stop); }
  .loaded button { color: var(--paper); text-decoration: underline; }

  .rail { flex: none; display: flex; gap: 4px; margin: 0; padding: 0; list-style: none; }
  .rail li { flex: 1; display: grid; gap: 4px; min-width: 0; }
  .bar { height: 4px; border-radius: 3px; background: rgb(255 255 255 / 0.1); transition: background 300ms ease, box-shadow 300ms ease; }
  .rail li.done .bar { background: rgb(var(--accent) / 0.55); }
  .rail li.now .bar { background: rgb(var(--accent)); box-shadow: 0 0 9px rgb(var(--accent) / 0.8); }
  .lbl { font-size: 11px; color: var(--paper-faint); text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .rail li.now .lbl { color: var(--paper); font-weight: 700; }

  .stage { flex: 1; min-height: 0; display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr); gap: 18px; }
  .art { border-radius: 27px; padding: 16px; display: grid; min-height: 0; overflow: hidden; }
  .art-in { min-height: 0; animation: art-in 420ms cubic-bezier(.2, .8, .2, 1); }
  @keyframes art-in { from { opacity: 0; transform: translateX(30px) scale(0.96); } }
  .copy { min-height: 0; display: flex; align-items: center; }
  .copy-in { display: grid; gap: 10px; align-content: center; animation: copy-in 420ms 60ms cubic-bezier(.2, .8, .2, 1) both; }
  @keyframes copy-in { from { opacity: 0; transform: translateY(12px); } }
  .count { color: rgb(var(--accent)); font-weight: 700; font-size: var(--t-sm); letter-spacing: 0.04em; transition: color 400ms ease; }
  h1 { font-size: clamp(26px, 4.6vw, 44px); font-weight: 800; line-height: 1.02; letter-spacing: -0.02em; }
  .body { color: var(--paper-dim); font-size: var(--t-md); max-width: 30ch; white-space: pre-line; }

  .steps { margin: 2px 0 0; padding: 0; list-style: none; counter-reset: g; display: grid; gap: 7px; max-width: 34ch; }
  .steps li { counter-increment: g; display: flex; gap: 10px; align-items: baseline; color: var(--paper); font-size: var(--t-md); line-height: 1.2; }
  /* A long list (the steam steps) tightens everything so it fits beside the picture. */
  .copy-in.dense { gap: 6px; }
  .copy-in.dense h1 { font-size: clamp(22px, 3.4vw, 32px); }
  .copy-in.dense .body { max-width: none; font-size: var(--t-sm); }
  .copy-in.dense .steps { gap: 6px; max-width: 36ch; }
  .copy-in.dense .steps li { font-size: var(--t-sm); line-height: 1.18; }
  .steps.beats li { animation: beat 10s linear infinite; animation-delay: calc(var(--i) * 2s - 10s); }
  @keyframes beat { 0%, 20% { opacity: 1; } 24%, 96% { opacity: 0.5; } 100% { opacity: 1; } }
  @media (prefers-reduced-motion: reduce) { .steps.beats li { animation: none; } }
  .steps li::before { content: counter(g); flex: none; width: 1.5em; height: 1.5em; display: grid; place-items: center; border-radius: 50%; border: 1.5px solid rgb(var(--accent) / 0.7); color: rgb(var(--accent)); font-size: var(--t-xs); font-weight: 700; }

  .weigh { display: flex; align-items: center; gap: 16px; margin-top: 4px; --c: 238 243 239; }
  .weigh.under { --c: 242 179 61; }
  .weigh.over { --c: 255 111 97; }
  .weigh.ok { --c: 76 230 140; }
  .ring { width: 111px; height: 111px; flex: none; transform: rotate(-90deg); filter: drop-shadow(0 0 14px rgb(var(--c) / 0.45)); }
  .ring circle { fill: none; stroke-width: 10; }
  .ring .track { stroke: rgb(255 255 255 / 0.08); }
  .ring .fill { stroke: rgb(var(--c)); stroke-linecap: round; transition: stroke-dasharray 140ms linear, stroke 300ms ease; }
  .readout { display: grid; }
  .readout b { font-size: 61px; font-weight: 800; line-height: 1; letter-spacing: -0.03em; color: rgb(var(--c)); transition: color 300ms ease; text-shadow: 0 0 26px rgb(var(--c) / 0.35); }
  .readout small { font-size: var(--t-lg); color: var(--paper-dim); margin-left: 3px; }
  .readout .num { white-space: nowrap; }
  .status { font-size: var(--t-md); font-weight: 700; color: rgb(var(--c)); }
  .weigh.ok .status::before { content: '✓ '; }
  .weigh.noscale .ring { opacity: 0.3; }
  .connect:disabled { opacity: 0.75; animation: pulse 1.4s ease-in-out infinite; }
  @keyframes pulse { 50% { opacity: 0.45; } }
  .art-in.tappable { cursor: pointer; }
  .tare { justify-self: start; min-height: var(--touch); padding: 0 22px; border-radius: var(--radius-pill); font-weight: 650; color: var(--paper); }

  .grinder { color: rgb(var(--accent)); font-size: var(--t-sm); font-weight: 650; margin-top: -4px; }
  .clock { font-size: var(--t-xxl); font-weight: 800; letter-spacing: -0.02em; color: rgb(var(--accent)); }

  .go-btn { justify-self: start; min-height: 68px; min-width: 196px; padding: 0 27px; border-radius: 26px; font-size: var(--t-lg); font-weight: 800; color: var(--paper); }
  .go-btn.start {
    color: var(--cat-ink);
    background: linear-gradient(165deg, #b9f0dd, var(--go));
    box-shadow: 0 14px 30px -12px rgb(143 211 192 / 0.8), inset 0 1px 0 rgb(255 255 255 / 0.8);
    animation: breathe 2.2s ease-in-out infinite;
  }
  .go-btn:disabled { opacity: 0.55; animation: none; }
  @keyframes breathe { 50% { transform: scale(1.03); } }
  .waiting { display: flex; align-items: center; gap: 9px; font-size: var(--t-md); font-weight: 700; color: rgb(var(--accent)); }
  .waiting.ok { color: var(--go); }
  .waiting.ok::before { content: '✓'; }
  .dot { width: 10px; height: 10px; border-radius: 50%; background: currentColor; animation: blink 1.1s ease-in-out infinite; }
  @keyframes blink { 50% { opacity: 0.25; transform: scale(0.8); } }
  .error { color: var(--stop); }

  .summary { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px 27px; margin: 4px 0 0; }
  .summary dt { color: var(--paper-faint); font-size: var(--t-sm); }
  .summary dd { margin: 0; font-size: var(--t-xxl); font-weight: 800; letter-spacing: -0.02em; }
  .summary small { font-size: var(--t-md); color: var(--paper-dim); margin-left: 3px; font-weight: 600; }

  footer { flex: none; display: flex; justify-content: space-between; gap: 9px; }
  .nav { min-height: 61px; min-width: 153px; padding: 0 26px; border-radius: 24px; font-size: var(--t-md); font-weight: 750; color: var(--paper); }
  .nav.primary { color: var(--ink); }
  .nav.ready {
    background: linear-gradient(165deg, #c6ffdc, rgb(76 230 140));
    box-shadow: 0 0 0 3px rgb(76 230 140 / 0.25), 0 14px 33px -10px rgb(76 230 140 / 0.9);
    animation: breathe 1.6s ease-in-out infinite;
  }

  .missing { margin: auto; padding: 24px; border-radius: 22px; display: grid; gap: 6px; max-width: 50ch; color: var(--paper-dim); }
  .missing .big { color: var(--paper); font-size: var(--t-lg); font-weight: 700; }

  @media (max-width: 1000px) {
    .stage { grid-template-columns: 1fr 1fr; gap: 12px; }
    .lbl { display: none; }
    .readout b { font-size: 48px; }
    .ring { width: 90px; height: 90px; }
  }
</style>
