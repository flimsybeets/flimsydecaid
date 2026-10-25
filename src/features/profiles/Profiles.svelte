<script lang="ts">
  import { app } from '../../state/app.svelte';
  import { toggleProfile } from '../../lib/categories';
  import { baseTemperature } from '../../lib/profiles';

  // Every profile, newest version of each. Tap a category chip to add or
  // remove the profile from that category on the Home screen.
  let query = $state('');
  let filter = $state<'all' | 'uncategorised'>('all');

  const all = $derived(
    [...app.profileLineages.entries()]
      .map(([root, record]) => ({ root, record }))
      .sort((a, b) => a.record.profile.title.localeCompare(b.record.profile.title)),
  );
  const inAnyCategory = $derived(new Set(app.categories.categories.flatMap((c) => c.profiles)));
  const shown = $derived.by(() => {
    const q = query.trim().toLowerCase();
    return all.filter(({ root, record }) =>
      (filter === 'all' || !inAnyCategory.has(root)) &&
      (!q || record.profile.title.toLowerCase().includes(q) || (record.profile.author ?? '').toLowerCase().includes(q)));
  });

  let saving = $state<string | null>(null);
  async function toggle(categoryId: string, root: string) {
    saving = `${categoryId}:${root}`;
    try { await app.saveCategories(toggleProfile(app.categories, categoryId, root)); }
    finally { saving = null; }
  }
</script>

<div class="page">
  <div class="bar">
    <input type="search" placeholder="Search {all.length} profiles" bind:value={query} aria-label="Search profiles" />
    <div class="filters" role="radiogroup" aria-label="Show">
      <button role="radio" aria-checked={filter === 'all'} class:active={filter === 'all'} onclick={() => (filter = 'all')}>All</button>
      <button role="radio" aria-checked={filter === 'uncategorised'} class:active={filter === 'uncategorised'} onclick={() => (filter = 'uncategorised')}>Not in a category</button>
    </div>
  </div>

  {#if app.categories.categories.length === 0}
    <p class="note">Make a category on the Home screen first, then come back to fill it.</p>
  {/if}

  <ul>
    {#each shown as { root, record } (root)}
      {@const temp = baseTemperature(record.profile)}
      <li>
        <div class="info">
          <span class="title">{record.profile.title}</span>
          <span class="meta">
            {#if record.profile.author}<span>{record.profile.author}</span>{/if}
            {#if temp !== null}<span>{temp}°C</span>{/if}
            <span>{record.profile.steps.length} steps</span>
          </span>
        </div>
        <div class="chips">
          {#each app.categories.categories as c (c.id)}
            {@const on = c.profiles.includes(root)}
            <button
              class="chip"
              class:on
              style="--tile: var(--cat-{c.colour ?? 1})"
              aria-pressed={on}
              disabled={saving !== null}
              onclick={() => toggle(c.id, root)}
            >{c.name}</button>
          {/each}
        </div>
      </li>
    {:else}
      <li class="nothing">{query ? `No profiles match “${query}”` : 'Every profile is in a category'}</li>
    {/each}
  </ul>
</div>

<style>
  .page { height: 100%; overflow-y: auto; padding: var(--gutter); }
  .bar { display: flex; gap: 14px; align-items: center; margin-bottom: 18px; position: sticky; top: calc(-1 * var(--gutter)); background: var(--ink); padding: 6px 0; z-index: 1; }
  input {
    flex: 1;
    min-height: var(--touch);
    padding: 0 20px;
    border-radius: var(--radius-pill);
    border: 2px solid var(--line);
    background: var(--ink-sunk);
    font-size: var(--t-md);
    user-select: text;
  }
  input:focus { border-color: var(--paper); outline: none; }
  .filters { display: flex; gap: 6px; }
  .filters button { min-height: 56px; padding: 0 20px; border-radius: var(--radius-pill); color: var(--paper-dim); }
  .filters button.active { background: var(--ink-raised); color: var(--paper); font-weight: 600; }
  .note { color: var(--paper-dim); margin-bottom: 14px; }

  ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
  li {
    display: flex;
    align-items: center;
    gap: 18px;
    padding: 16px 20px;
    border-radius: 20px;
    background: var(--ink-raised);
  }
  .info { flex: 1; min-width: 0; display: grid; gap: 4px; }
  .title { font-size: var(--t-md); font-weight: 650; }
  .meta { display: flex; flex-wrap: wrap; gap: 4px 14px; color: var(--paper-dim); font-size: var(--t-xs); }
  .chips { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; max-width: 60%; }
  .chip {
    min-height: 48px;
    padding: 0 18px;
    border-radius: var(--radius-pill);
    border: 2px solid var(--line);
    color: var(--paper-dim);
    font-size: var(--t-xs);
  }
  .chip.on { background: var(--tile); border-color: var(--tile); color: var(--cat-ink); font-weight: 650; }
  .chip:disabled { opacity: 0.7; }
  .nothing { color: var(--paper-dim); justify-content: center; }
</style>
