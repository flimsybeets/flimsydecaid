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
  <div class="bar glass">
    <input class="well" type="search" placeholder="Search {all.length} profiles" bind:value={query} aria-label="Search profiles" />
    <div class="filters" role="radiogroup" aria-label="Show">
      <button class="glass" role="radio" aria-checked={filter === 'all'} class:active={filter === 'all'} onclick={() => (filter = 'all')}>All</button>
      <button class="glass" role="radio" aria-checked={filter === 'uncategorised'} class:active={filter === 'uncategorised'} onclick={() => (filter = 'uncategorised')}>Not in a category</button>
    </div>
    <button class="new glass solid" onclick={() => (app.editing = null)}>New profile</button>
  </div>

  {#if app.categories.categories.length === 0}
    <p class="note">Make a category on the Home screen first, then come back to fill it.</p>
  {/if}

  <ul>
    {#each shown as { root, record } (root)}
      {@const temp = baseTemperature(record.profile)}
      <li class="glass">
        <button class="info" aria-label="Edit {record.profile.title}" onclick={() => (app.editing = record)}>
          <span class="title">{record.profile.title}</span>
          <span class="meta">
            {#if record.profile.author}<span>{record.profile.author}</span>{/if}
            {#if temp !== null}<span>{temp}°C</span>{/if}
            <span>{record.profile.steps.length} steps</span>
          </span>
        </button>
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
        <button class="edit glass" onclick={() => (app.editing = record)}>Edit</button>
      </li>
    {:else}
      <li class="nothing glass">{query ? `No profiles match “${query}”` : 'Every profile is in a category'}</li>
    {/each}
  </ul>
</div>

<style>
  .page { height: 100%; overflow-y: auto; padding: var(--gutter); }
  .bar { display: flex; gap: 12px; align-items: center; margin-bottom: 18px; position: sticky; top: calc(-1 * var(--gutter) + 6px); padding: 8px; border-radius: var(--radius-pill); z-index: 2; }
  input {
    flex: 1;
    min-height: var(--touch);
    padding: 0 20px;
    border-radius: var(--radius-pill);
    border: 1px solid rgb(255 255 255 / 0.08);
    font-size: var(--t-md);
    user-select: text;
  }
  input:focus { border-color: rgb(255 255 255 / 0.5); outline: none; }
  .filters { display: flex; gap: 6px; }
  .filters button { min-height: 56px; padding: 0 20px; border-radius: var(--radius-pill); color: var(--paper-dim); }
  .filters button.active { color: var(--paper); font-weight: 650; }
  .note { color: var(--paper-dim); margin-bottom: 14px; }

  ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
  li {
    display: flex;
    align-items: center;
    gap: 18px;
    padding: 16px 20px;
    border-radius: 26px;
  }
  .info { flex: 1; min-width: 0; display: grid; gap: 4px; text-align: left; min-height: var(--touch); align-content: center; }
  .new { flex: none; min-height: 56px; padding: 0 22px; border-radius: var(--radius-pill); font-weight: 650; }
  .edit { flex: none; min-height: 48px; padding: 0 18px; border-radius: var(--radius-pill); color: var(--paper); font-size: var(--t-xs); font-weight: 650; }
  .title { font-size: var(--t-md); font-weight: 650; }
  .meta { display: flex; flex-wrap: wrap; gap: 4px 14px; color: var(--paper-dim); font-size: var(--t-xs); }
  .chips { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; max-width: 60%; }
  .chip {
    min-height: 48px;
    padding: 0 18px;
    border-radius: var(--radius-pill);
    background: var(--well);
    box-shadow: var(--well-shadow);
    color: var(--paper-dim);
    font-size: var(--t-xs);
    transition: background 160ms ease, box-shadow 160ms ease;
  }
  .chip.on {
    background: linear-gradient(170deg, color-mix(in srgb, var(--tile) 100%, white 20%), var(--tile));
    color: var(--cat-ink);
    font-weight: 650;
    box-shadow: 0 6px 16px -6px color-mix(in srgb, var(--tile) 70%, transparent), inset 0 1px 0 rgb(255 255 255 / 0.6);
  }
  .chip:disabled { opacity: 0.7; }
  .nothing { color: var(--paper-dim); justify-content: center; }
</style>
