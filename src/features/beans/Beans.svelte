<script lang="ts">
  import { app } from '../../state/app.svelte';
  import AddBag from './AddBag.svelte';

  let adding = $state(false);
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

  const fmtDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : null);

</script>

<div class="page">
  <div class="bar">
    <button class="add" onclick={() => (adding = true)}>Add a bag</button>
    <label class="toggle"><input type="checkbox" bind:checked={showFinished} /> Show finished bags</label>
  </div>

  {#if beans.length === 0}
    <div class="empty">
      <p class="big">No open bags</p>
      <p>Add the bag you're brewing now. Your grind and temperature for each profile will be remembered with it.</p>
    </div>
  {/if}

  <ul class="beans">
    {#each beans as { bean, bags } (bean.id)}
      <li class="bean">
        <div class="bean-head">
          <h2>{bean.name}</h2>
          <p>{bean.roaster}{bean.country ? `, ${bean.country}` : ''}{bean.processing ? `, ${bean.processing}` : ''}</p>
          {#if bean.notes}<p class="notes">{bean.notes}</p>{/if}
        </div>
        <ul class="bags">
          {#each bags as b (b.id)}
            <li class="bag" class:finished={b.archived}>
              {#if app.photos[b.id]}<img src={app.photos[b.id]} alt="Photo of the {bean.name} bag" />{/if}
              <div class="bag-info">
                <span>{fmtDate(b.roastDate) ? `Roasted ${fmtDate(b.roastDate)}` : 'Roast date not set'}</span>
                {#if b.weightRemaining != null}<span class="sub">{Math.round(b.weightRemaining)} of {Math.round(b.weight ?? b.weightRemaining)} g left</span>{/if}
                {#if b.frozen}<span class="sub">Frozen</span>{/if}
              </div>
              {#if !b.archived}
                <button class="finish" onclick={() => app.finishBag(b.id)}>Finished</button>
              {/if}
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

<style>
  .page { height: 100%; overflow-y: auto; padding: var(--gutter); }
  .bar { display: flex; align-items: center; gap: 20px; margin-bottom: 20px; }
  .add { min-height: var(--touch); padding: 0 28px; border-radius: var(--radius-control); background: var(--paper); color: var(--ink); font-weight: 650; font-size: var(--t-md); }
  .toggle { display: flex; align-items: center; gap: 10px; color: var(--paper-dim); min-height: var(--touch); }
  .toggle input { width: 26px; height: 26px; accent-color: var(--paper); }

  .empty { max-width: 60ch; display: grid; gap: 8px; color: var(--paper-dim); }
  .empty .big { color: var(--paper); font-size: var(--t-lg); font-weight: 650; }

  ul { list-style: none; margin: 0; padding: 0; }
  .beans { display: grid; grid-template-columns: repeat(auto-fill, minmax(420px, 1fr)); gap: 16px; }
  .bean { background: var(--ink-raised); border-radius: 22px; padding: 20px 22px; display: grid; gap: 14px; align-content: start; }
  .bean-head h2 { font-size: var(--t-lg); font-weight: 700; letter-spacing: -0.01em; }
  .bean-head p { color: var(--paper-dim); }
  .notes { font-size: var(--t-xs); margin-top: 4px; }
  .bags { display: grid; gap: 8px; }
  .bag { display: flex; align-items: center; gap: 14px; padding: 10px; border-radius: var(--radius-control); background: var(--ink-sunk); }
  .bag.finished { opacity: 0.55; }
  .bag img { width: 64px; height: 64px; border-radius: 12px; object-fit: cover; }
  .bag-info { flex: 1; display: grid; }
  .sub { color: var(--paper-dim); font-size: var(--t-xs); }
  .finish { min-height: 52px; padding: 0 18px; border-radius: var(--radius-pill); border: 2px solid var(--line); color: var(--paper-dim); font-size: var(--t-xs); }
</style>
