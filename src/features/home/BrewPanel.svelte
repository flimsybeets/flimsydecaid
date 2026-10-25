<script lang="ts">
  import { untrack } from 'svelte';
  import { app } from '../../state/app.svelte';
  import { resolveDialIn, type DialInSource } from '../../lib/dialIn';
  import { baseTemperature } from '../../lib/profiles';
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
  let busy = $state<'load' | 'start' | null>(null);
  let message = $state<{ text: string; bad?: boolean } | null>(null);

  // Whenever the bag changes, load what was dialled in for bag + profile.
  // Only batchId is tracked; saving shouldn't reset what's on screen.
  $effect(() => {
    const id = batchId;
    untrack(() => loadDialIn(id));
  });

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
    message = null;
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

  async function apply(andStart: boolean) {
    busy = andStart ? 'start' : 'load';
    message = null;
    const dialIn = {
      grind: grind === undefined ? undefined : String(grind),
      dose,
      yield: yieldG,
      tempOffset: temp !== undefined && base !== null ? Math.round((temp - base) * 10) / 10 : 0,
    };
    try {
      await app.applySelection(profileRoot, batch, dialIn);
      if (batch) await app.saveDialIn(batch, profileRoot, dialIn);
      if (andStart) await app.startEspresso();
      else message = { text: 'Loaded onto the machine' };
    } catch (e) {
      message = { text: `Couldn't load: ${(e as Error).message}`, bad: true };
    } finally {
      busy = null;
    }
  }
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
      <Stepper compact label="Dose" bind:value={dose} min={5} max={30} step={0.1} decimals={1} unit="g" />
      <Stepper compact label="Yield" bind:value={yieldG} min={0} max={400} step={0.5} decimals={1} unit="g" placeholder="Off" />
    </div>
    {#if base !== null && temp !== undefined && temp !== base}
      <p class="offset">{temp > base ? '+' : ''}{(temp - base).toFixed(1)}° from the profile's {base}°</p>
    {/if}
  </section>

  </div>

  <div class="go">
    {#if message}<p class="msg" class:bad={message.bad} role="status">{message.text}</p>{/if}
    <button class="load glass" disabled={busy !== null} onclick={() => apply(false)}>{busy === 'load' ? 'Loading…' : 'Load'}</button>
    {#if app.ghc}
      <p class="ghc">Then start the shot on the group head.</p>
    {:else}
      <button class="start glass" disabled={busy !== null || app.machine.state?.state === 'espresso'} onclick={() => apply(true)}>
        {busy === 'start' ? 'Starting…' : 'Start shot'}
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
    gap: 18px;
    min-height: 0;
    overflow: hidden;
    margin: 4px var(--gutter) 4px 0;
    padding: var(--gutter);
    border-radius: 36px;
    animation: slide 200ms cubic-bezier(.2,.8,.2,1);
  }
  @keyframes slide { from { transform: translateX(30px); opacity: 0; } }

  .body { display: grid; gap: 18px; align-content: start; min-height: 0; overflow-y: auto; margin: 0 -8px; padding: 4px 8px; }
  .head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
  h2 { font-size: var(--t-lg); font-weight: 700; line-height: 1.1; letter-spacing: -0.01em; }
  h3 { font-size: var(--t-sm); font-weight: 500; color: var(--paper-dim); margin-bottom: 8px; }
  .edit { flex: none; height: 56px; padding: 0 18px; margin-left: auto; border-radius: var(--radius-pill); color: var(--paper); font-size: var(--t-xs); font-weight: 650; }
  .close { width: 56px; height: 56px; flex: none; border-radius: 50%; color: var(--paper-dim); font-size: var(--t-md); }

  .bag-list { display: grid; gap: 8px; max-height: 268px; overflow-y: auto; padding: 4px; margin: -4px; }
  .bag {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 10px;
    border-radius: 22px;
    text-align: left;
  }
  .bag.selected { box-shadow: 0 0 0 3px var(--tile), var(--glass-sheen); }
  .bag img, .swatch {
    width: 58px; height: 58px; flex: none;
    border-radius: 14px;
    object-fit: cover;
    box-shadow: 0 4px 12px rgb(0 0 0 / 0.3);
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

  .dial { display: grid; gap: 14px; align-content: start; }
  .source { color: var(--paper-dim); font-size: var(--t-xs); }
  .grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 14px; }
  .offset { color: var(--paper-dim); font-size: var(--t-xs); }

  .go { display: grid; grid-template-columns: 1fr 1.6fr; gap: 12px; align-items: center; }
  .ghc { color: var(--paper-dim); font-size: var(--t-sm); }
  .msg { grid-column: 1 / -1; color: var(--go); font-size: var(--t-sm); }
  .msg.bad { color: var(--stop); }
  .load, .start {
    min-height: 84px;
    border-radius: var(--radius-tile);
    font-size: var(--t-md);
    font-weight: 700;
  }
  .load { color: var(--paper); }
  .start {
    color: var(--cat-ink);
    background: var(--tile);
    background:
      radial-gradient(120% 80% at 20% 0%, rgb(255 255 255 / 0.5), transparent 60%),
      linear-gradient(165deg, var(--tile), color-mix(in srgb, var(--tile) 78%, black));
    box-shadow: 0 16px 34px -12px color-mix(in srgb, var(--tile) 70%, transparent), inset 0 1px 0 rgb(255 255 255 / 0.7);
  }
  .load:disabled, .start:disabled { opacity: 0.5; }
</style>
