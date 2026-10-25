<script lang="ts">
  import { untrack } from 'svelte';
  import { app } from '../../state/app.svelte';
  import { resolveDialIn, type DialIn, type DialInSource } from '../../lib/dialIn';
  import { baseTemperature } from '../../lib/profiles';
  import { doseCheck } from '../../lib/guide';
  import Stepper from '../../components/Stepper.svelte';
  import type { BeanBatch } from '../../api/types';

  let { profileRoot, onClose }: { profileRoot: string; onClose: () => void } = $props();

  const record = $derived(app.profileLineages.get(profileRoot));
  const base = $derived(record ? baseTemperature(record.profile) : null);

  // Open bags, most recently roasted first.
  const bags = $derived(
    app.batches
      .filter((b) => !b.archived)
      .map((b) => ({ batch: b, bean: app.beans.find((x) => x.id === b.beanId) }))
      .sort((a, b) => (b.batch.roastDate ?? b.batch.createdAt).localeCompare(a.batch.roastDate ?? a.batch.createdAt)),
  );

  // Default to the bag currently on the machine, if it's still open.
  let batchId = $state<string | null>(null);
  $effect.pre(() => {
    if (batchId === null) {
      const current = app.workflow.context?.beanBatchId;
      batchId = bags.some((b) => b.batch.id === current) ? current! : (bags[0]?.batch.id ?? null);
    }
  });
  const batch = $derived<BeanBatch | null>(app.batches.find((b) => b.id === batchId) ?? null);

  let grind = $state<number | undefined>();
  let dose = $state<number | undefined>();
  let yieldG = $state<number | undefined>();
  let temp = $state<number | undefined>();
  let source = $state<DialInSource>('profile-default');
  let starting = $state(false);
  let startError = $state<string | null>(null);

  // Whenever the bag changes, load what was dialled in for bag + profile.
  // Only batchId is tracked; saving shouldn't reset what's on screen.
  $effect(() => {
    const id = batchId;
    untrack(() => loadDialIn(id));
  });

  /** The values as loaded for this bag; a change from these is worth saving on the bag. */
  let loadedKey = '';
  /** Whether this bag's dial-in for this profile has been written since it was loaded. */
  let savedOnBag = false;

  function loadDialIn(id: string | null) {
    const b = app.batches.find((x) => x.id === id) ?? null;
    const resolved = b ? resolveDialIn(b, profileRoot, app.batches) : { dialIn: {}, source: 'profile-default' as const };
    const d = resolved.dialIn;
    source = resolved.source;
    const g = d.grind !== undefined ? Number.parseFloat(d.grind) : NaN;
    grind = Number.isFinite(g) ? g : undefined;
    dose = d.dose ?? app.workflow.context?.targetDoseWeight ?? 18;
    yieldG = d.yield ?? record?.profile.target_weight ?? undefined;
    temp = base !== null ? base + (d.tempOffset ?? 0) : undefined;
    loadedKey = JSON.stringify(currentDialIn());
    savedOnBag = resolved.source === 'this-bag';
  }

  function currentDialIn(): DialIn {
    return {
      grind: grind === undefined ? undefined : String(grind),
      dose,
      yield: yieldG,
      tempOffset: temp !== undefined && base !== null ? Math.round((temp - base) * 10) / 10 : 0,
    };
  }

  // ---- Keeping the machine in step -----------------------------------------
  // There's no Load button: whatever is picked here goes onto the machine on
  // its own, a moment after the last change (so holding + doesn't send a
  // request per step; Decaid doesn't debounce). Sends run one after another,
  // identical ones are skipped, and nothing is sent while a shot is pulling.

  const DEBOUNCE_MS = 600;
  let sync = $state<'idle' | 'pending' | 'sending' | 'ok' | 'failed'>('idle');
  let syncError = $state('');
  let timer: ReturnType<typeof setTimeout> | null = null;
  let chain: Promise<void> = Promise.resolve();
  let lastSent = '';

  function schedule() {
    if (timer) clearTimeout(timer);
    sync = 'pending';
    timer = setTimeout(() => void flush(), DEBOUNCE_MS);
  }

  /** Send the current settings now (after any send already under way). */
  function flush(): Promise<void> {
    if (timer) { clearTimeout(timer); timer = null; }
    const dialIn = currentDialIn();
    const forBatch = batch;
    chain = chain.then(() => send(dialIn, forBatch));
    return chain;
  }

  async function send(dialIn: DialIn, forBatch: BeanBatch | null) {
    const key = JSON.stringify({ profileRoot, batch: forBatch?.id ?? null, dialIn });
    if (key === lastSent) { if (sync !== 'failed') sync = 'ok'; return; }
    if (app.shotActive) { sync = 'pending'; return; } // picked up when the shot ends
    sync = 'sending';
    try {
      await app.applySelection(profileRoot, forBatch, dialIn);
      lastSent = key;
      const dialKey = JSON.stringify(dialIn);
      if (forBatch && dialKey !== loadedKey) {
        await app.saveDialIn(forBatch, profileRoot, dialIn);
        loadedKey = dialKey;
        savedOnBag = true;
      }
      sync = 'ok';
    } catch (e) {
      sync = 'failed';
      syncError = (e as Error).message;
    }
  }

  // Any change (and opening the panel) schedules a send.
  $effect(() => {
    void [profileRoot, batchId, grind, dose, yieldG, temp];
    untrack(schedule);
  });
  // A change made mid-shot goes on once the shot is over.
  $effect(() => { if (!app.shotActive && sync === 'pending' && !timer) untrack(schedule); });
  // Closing the panel sends anything still waiting.
  $effect(() => () => { if (timer) void flush(); });

  async function startShot() {
    starting = true;
    startError = null;
    try {
      await flush();
      if (sync === 'failed') throw new Error(syncError);
      // A shot was pulled with these values: keep them on the bag even if unchanged.
      if (batch && !savedOnBag) { await app.saveDialIn(batch, profileRoot, currentDialIn()); savedOnBag = true; }
      await app.startEspresso();
    } catch (e) {
      startError = (e as Error).message;
    } finally {
      starting = false;
    }
  }

  const SOURCE_TEXT: Record<DialInSource, string> = {
    'this-bag': 'Your settings for this bag',
    'previous-bag': 'Carried over from your last bag of this coffee',
    'profile-default': 'First time with this bag and profile',
  };

  function roastAge(b: BeanBatch): string {
    if (!b.roastDate) return 'Roast date not set';
    const days = Math.floor((Date.now() - Date.parse(b.roastDate)) / 86_400_000);
    return days <= 0 ? 'Roasted today' : days === 1 ? 'Roasted yesterday' : `Roasted ${days} days ago`;
  }

  $effect(() => { for (const b of bags) void app.loadPhoto(b.batch.id); });

  // Weighing beans: the scale's reading against the dose (green within 0.1 g).
  const weigh = $derived(app.scaleConnected && !app.shotActive ? doseCheck(app.weight, dose) : null);
  const weighText = $derived(!weigh ? '' : weigh.state === 'ok' ? 'Spot on' : weigh.state === 'under' ? `Add ${weigh.delta.toFixed(1)} g` : `Take out ${Math.abs(weigh.delta).toFixed(1)} g`);

</script>

<aside class="panel glass thick" aria-label="Brew settings">
  <div class="head">
    <h2>{record?.profile.title ?? 'Profile'}</h2>
    {#if record}<button class="edit glass" onclick={() => (app.editing = record)}>Edit</button>{/if}
    <button class="close glass" onclick={onClose} aria-label="Close brew settings">✕</button>
  </div>

  <div class="body">
  <section class="bags" aria-label="Bag">
    <h3>Bag</h3>
    {#if bags.length === 0}
      <p class="none">No open bags. Add one in the Beans tab.</p>
    {:else}
      <div class="bag-list" role="radiogroup" aria-label="Bag">
        {#each bags as { batch: b, bean } (b.id)}
          <button class="bag glass" class:lit={b.id === batchId} class:selected={b.id === batchId} role="radio" aria-checked={b.id === batchId} onclick={() => (batchId = b.id)}>
            {#if app.photos[b.id]}
              <img src={app.photos[b.id]} alt="" />
            {:else}
              <span class="swatch" aria-hidden="true">{bean?.name.slice(0, 1) ?? '?'}</span>
            {/if}
            <span class="bag-text">
              <span class="bean">{bean?.name ?? 'Unknown bean'}</span>
              <span class="sub">{bean?.roaster ?? ''}</span>
              <span class="sub">{roastAge(b)}{b.weightRemaining != null ? `, ${Math.round(b.weightRemaining)} g left` : ''}</span>
            </span>
          </button>
        {/each}
      </div>
    {/if}
  </section>

  <section class="dial" aria-label="Dial-in">
    <p class="source">{SOURCE_TEXT[source]}</p>
    <div class="grid">
      <Stepper compact label="Grind" bind:value={grind} min={0} max={100} step={0.5} decimals={1} placeholder="Not set" />
      <Stepper compact label="Temperature" bind:value={temp} min={(base ?? 90) - 10} max={(base ?? 90) + 10} step={0.5} decimals={1} unit="°C" disabled={base === null} />
      <div class="dose {weigh?.state ?? ''}"><Stepper compact label="Dose" bind:value={dose} min={5} max={30} step={0.1} decimals={1} unit="g" /></div>
      <Stepper compact label="Yield" bind:value={yieldG} min={0} max={400} step={0.5} decimals={1} unit="g" placeholder="Off" />
    </div>
    {#if base !== null && temp !== undefined && temp !== base}
      <p class="offset">{temp > base ? '+' : ''}{(temp - base).toFixed(1)}° from the profile's {base}°</p>
    {/if}
  </section>

  </div>

  <div class="go">
    <!-- Pinned here, always in view, while beans are on the scale. -->
    {#if weigh && dose}
      <div class="weigh {weigh.state}" role="status" aria-label="Beans on the scale">
        <div class="bar"><div class="fill" style="width: {Math.min(100, ((app.weight ?? 0) / dose) * 100)}%"></div></div>
        <p><b>{(app.weight ?? 0).toFixed(1)}</b> of {dose.toFixed(1)} g <span>{weighText}</span></p>
      </div>
    {/if}
    <p class="sync {sync}" role="status">
      {#if sync === 'failed'}
        Not on the machine: {syncError} <button onclick={() => { lastSent = ''; void flush(); }}>Try again</button>
      {:else if sync === 'ok'}
        On the machine
      {:else if app.shotActive}
        Goes on after this shot
      {:else}
        Updating the machine…
      {/if}
    </p>
    {#if startError}<p class="msg bad" role="alert">Couldn't start: {startError}</p>{/if}
    {#if app.ghc}
      <p class="ghc">Start the shot on the group head.</p>
    {:else}
      <button class="start glass" disabled={starting || app.machine.state?.state === 'espresso'} onclick={startShot}>
        {starting ? 'Starting…' : 'Start shot'}
      </button>
    {/if}
  </div>
</aside>

<style>
  /* Title and Load / Start stay put; only the middle scrolls. (A glass
     element must not scroll itself: its rim would scroll away too.) */
  .panel {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto;
    gap: 14px;
    min-height: 0;
    overflow: hidden;
    margin: 3px var(--gutter) 3px 0;
    padding: var(--gutter);
    border-radius: 27px;
    animation: slide 200ms cubic-bezier(.2,.8,.2,1);
  }
  @keyframes slide { from { transform: translateX(22px); opacity: 0; } }

  .body { display: grid; gap: 14px; align-content: start; min-height: 0; overflow-y: auto; margin: 0 -8px; padding: 3px 6px; }
  .head { display: flex; align-items: flex-start; justify-content: space-between; gap: 9px; }
  h2 { font-size: var(--t-lg); font-weight: 700; line-height: 1.1; letter-spacing: -0.01em; }
  h3 { font-size: var(--t-sm); font-weight: 500; color: var(--paper-dim); margin-bottom: 6px; }
  .edit { flex: none; height: 42px; padding: 0 14px; margin-left: auto; border-radius: var(--radius-pill); color: var(--paper); font-size: var(--t-xs); font-weight: 650; }
  .close { width: 42px; height: 42px; flex: none; border-radius: 50%; color: var(--paper-dim); font-size: var(--t-md); }

  .bag-list { display: grid; gap: 6px; max-height: 201px; overflow-y: auto; padding: 3px; margin: -4px; }
  .bag {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px;
    border-radius: 16px;
    text-align: left;
  }
  .bag.selected { box-shadow: 0 0 0 3px var(--tile), var(--glass-sheen); }
  .bag img, .swatch {
    width: 44px; height: 44px; flex: none;
    border-radius: 10px;
    object-fit: cover;
    box-shadow: 0 3px 9px rgb(0 0 0 / 0.3);
  }
  .swatch {
    display: grid; place-items: center;
    background: var(--cat-7);
    color: var(--cat-ink);
    font-size: var(--t-lg);
    font-weight: 750;
  }
  .bag-text { display: grid; min-width: 0; }
  .bean { font-weight: 650; font-size: var(--t-sm); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .sub { color: var(--paper-dim); font-size: var(--t-xs); }
  .none { color: var(--paper-dim); }

  .dial { display: grid; gap: 10px; align-content: start; }
  .source { color: var(--paper-dim); font-size: var(--t-xs); }
  .grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 10px; }
  /* Beans on the scale vs the dose: amber under, green spot on, coral over. */
  .weigh { --c: 242 179 61; display: grid; gap: 6px; }
  .weigh.ok { --c: 76 230 140; }
  .weigh.over { --c: 255 111 97; }
  .weigh .bar { height: 10px; border-radius: var(--radius-pill); background: var(--well); box-shadow: var(--well-shadow); overflow: hidden; }
  .weigh .fill { height: 100%; border-radius: inherit; background: rgb(var(--c)); box-shadow: 0 0 12px rgb(var(--c) / 0.7); transition: width 120ms linear, background 250ms ease; }
  .weigh p { display: flex; align-items: baseline; gap: 6px; color: var(--paper-dim); font-size: var(--t-sm); }
  .weigh b { color: rgb(var(--c)); font-size: var(--t-md); }
  .weigh span { margin-left: auto; color: rgb(var(--c)); font-weight: 700; }
  .weigh.ok span::before { content: '✓ '; }
  .dose :global(.row) { transition: box-shadow 250ms ease; }
  .dose.under :global(.row) { box-shadow: 0 0 0 2px rgb(242 179 61 / 0.7), var(--well-shadow); }
  .dose.ok :global(.row) { box-shadow: 0 0 0 2px rgb(76 230 140), 0 0 18px rgb(76 230 140 / 0.55); }
  .dose.over :global(.row) { box-shadow: 0 0 0 2px rgb(255 111 97 / 0.8), var(--well-shadow); }
  .offset { color: var(--paper-dim); font-size: var(--t-xs); }

  .go { display: grid; gap: 9px; }
  .sync { display: flex; align-items: center; gap: 8px; color: var(--paper-faint); font-size: var(--t-xs); min-height: 20px; }
  .sync::before { content: ''; width: 8px; height: 8px; border-radius: 50%; background: var(--paper-faint); flex: none; }
  .sync.ok { color: var(--go); }
  .sync.ok::before { background: var(--go); box-shadow: 0 0 8px var(--go); }
  .sync.pending::before, .sync.sending::before { background: var(--warn); animation: pulse 1s ease-in-out infinite; }
  .sync.failed { color: var(--stop); }
  .sync.failed::before { background: var(--stop); }
  .sync button { color: var(--paper); text-decoration: underline; min-height: 36px; }
  @keyframes pulse { 50% { opacity: 0.3; } }
  .ghc { color: var(--paper-dim); font-size: var(--t-sm); }
  .msg { grid-column: 1 / -1; color: var(--go); font-size: var(--t-sm); }
  .msg.bad { color: var(--stop); }
  .start {
    min-height: 61px;
    border-radius: var(--radius-tile);
    font-size: var(--t-md);
    font-weight: 700;
  }
  .start {
    color: var(--cat-ink);
    background: var(--tile);
    background:
      radial-gradient(120% 80% at 20% 0%, rgb(255 255 255 / 0.5), transparent 60%),
      linear-gradient(165deg, var(--tile), color-mix(in srgb, var(--tile) 78%, black));
    box-shadow: 0 12px 26px -12px color-mix(in srgb, var(--tile) 70%, transparent), inset 0 1px 0 rgb(255 255 255 / 0.7);
  }
  .start:disabled { opacity: 0.5; }
</style>
