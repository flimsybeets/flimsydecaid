<script lang="ts">
  import { app } from '../../state/app.svelte';
  import AddBag from './AddBag.svelte';
  import CoffeeDialog from './CoffeeDialog.svelte';
  import BagDialog from './BagDialog.svelte';
  import type { Bean, BeanBatch } from '../../api/types';

  let adding = $state(false);
  let editingBean = $state<Bean | null>(null);
  let editingBag = $state<BeanBatch | null>(null);
  let showFinished = $state(false);

  const beans = $derived(
    app.beans
      .filter((b) => !b.archived)
      .map((bean) => ({
        bean,
        bags: app.batches
          .filter((x) => x.beanId === bean.id && (showFinished || !x.archived))
          .sort((a, b) => (b.roastDate ?? b.createdAt).localeCompare(a.roastDate ?? a.createdAt)),
      }))
      .filter((x) => showFinished || x.bags.length > 0),
  );

  $effect(() => { for (const { bags } of beans) for (const b of bags) void app.loadPhoto(b.id); });

  // Shots per bag, asked one bag at a time (Decaid doesn't like a burst) and again after each pull.
  let shotCounts = $state<Record<string, number>>({});
  $effect(() => {
    void app.shotsFinished;
    const ids = beans.flatMap(({ bags }) => bags.map((b) => b.id));
    let stop = false;
    void (async () => {
      for (const id of ids) {
        if (stop) return;
        try { shotCounts[id] = (await app.getShots({ beanBatchId: id, limit: 1 })).total; } catch { /* the button just shows no count */ }
      }
    })();
    return () => { stop = true; };
  });
  function showShots(id: string) {
    app.historyBag = id;
    app.tab = 'history';
  }

  const fmtDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : null);

</script>

<div class="page">
  <div class="bar">
    <button class="add glass solid" onclick={() => (adding = true)}>Add a bag</button>
    <label class="toggle glass"><input type="checkbox" bind:checked={showFinished} /> Show finished bags</label>
  </div>

  {#if beans.length === 0}
    <div class="empty">
      <p class="big">No open bags</p>
      <p>Add the bag you're brewing now. Your grind and temperature for each profile will be remembered with it.</p>
    </div>
  {/if}

  <ul class="beans">
    {#each beans as { bean, bags } (bean.id)}
      <li class="bean glass">
        <div class="bean-head">
          <button class="edit glass" onclick={() => (editingBean = bean)}>Edit</button>
          <h2>{bean.name}</h2>
          <p>{bean.roaster}{bean.country ? `, ${bean.country}` : ''}{bean.processing ? `, ${bean.processing}` : ''}</p>
          {#if bean.notes}<p class="notes">{bean.notes}</p>{/if}
        </div>
        <ul class="bags">
          {#each bags as b (b.id)}
            <li class="bag well" class:finished={b.archived}>
              {#if app.photos[b.id]}<img src={app.photos[b.id]} alt="Photo of the {bean.name} bag" />{/if}
              <div class="bag-info">
                <span>{fmtDate(b.roastDate) ? `Roasted ${fmtDate(b.roastDate)}` : 'Roast date not set'}</span>
                {#if b.weightRemaining != null}<span class="sub">{Math.round(b.weightRemaining)} of {Math.round(b.weight ?? b.weightRemaining)} g left</span>{/if}
                {#if b.frozen}<span class="sub">Frozen</span>{/if}
              </div>
              <div class="bag-actions">
              <button class="finish glass" aria-label="Shots from this bag" onclick={() => showShots(b.id)}>Shots{shotCounts[b.id] !== undefined ? ` (${shotCounts[b.id]})` : ''}</button>
              <button class="finish glass" onclick={() => (editingBag = b)}>Edit</button>
              {#if !b.archived}
                <button class="finish glass" onclick={() => app.finishBag(b.id)}>Finished</button>
              {/if}
              </div>
            </li>
          {/each}
        </ul>
      </li>
    {/each}
  </ul>
</div>

{#if adding}
  <AddBag onClose={() => (adding = false)} />
{/if}
{#if editingBean}
  <CoffeeDialog bean={editingBean} onClose={() => (editingBean = null)} />
{/if}
{#if editingBag}
  <BagDialog bag={editingBag} onClose={() => (editingBag = null)} />
{/if}

<style>
  .page { height: 100%; overflow-y: auto; padding: var(--gutter); }
  .bar { display: flex; align-items: center; gap: 15px; margin-bottom: 15px; }
  .add { min-height: var(--touch); padding: 0 21px; border-radius: var(--radius-pill); font-weight: 650; font-size: var(--t-md); }
  .toggle { display: flex; align-items: center; gap: 8px; color: var(--paper-dim); min-height: var(--touch); padding: 0 16px; border-radius: var(--radius-pill); }
  .toggle input { width: 20px; height: 20px; accent-color: var(--paper); }

  .empty { max-width: 60ch; display: grid; gap: 6px; color: var(--paper-dim); }
  .empty .big { color: var(--paper); font-size: var(--t-lg); font-weight: 650; }

  ul { list-style: none; margin: 0; padding: 0; }
  .beans { display: grid; grid-template-columns: repeat(auto-fill, minmax(315px, 1fr)); gap: 12px; }
  .bean { border-radius: 24px; padding: 16px 18px; display: grid; gap: 10px; align-content: start; }
  .bean-head { position: relative; }
  .edit { float: right; min-height: 40px; padding: 0 14px; border-radius: var(--radius-pill); color: var(--paper); font-size: var(--t-xs); font-weight: 650; }
  .bean-head h2 { font-size: var(--t-lg); font-weight: 700; letter-spacing: -0.01em; }
  .bean-head p { color: var(--paper-dim); }
  .notes { font-size: var(--t-xs); margin-top: 3px; }
  .bags { display: grid; gap: 6px; }
  .bag { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; padding: 8px; border-radius: 16px; }
  .bag.finished { opacity: 0.55; }
  .bag img { width: 48px; height: 48px; border-radius: 10px; object-fit: cover; box-shadow: 0 3px 9px rgb(0 0 0 / 0.3); }
  .bag-info { flex: 1 1 120px; min-width: 0; display: grid; }
  /* On a narrow card the buttons drop to their own row instead of spilling out. */
  .bag-actions { display: flex; flex-wrap: wrap; gap: 6px; margin-left: auto; justify-content: flex-end; }
  .sub { color: var(--paper-dim); font-size: var(--t-xs); }
  .finish { min-height: 40px; padding: 0 14px; border-radius: var(--radius-pill); color: var(--paper-dim); font-size: var(--t-xs); }
</style>
