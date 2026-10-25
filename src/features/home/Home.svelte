<script lang="ts">
  import { app } from '../../state/app.svelte';
  import { newCategoryId, type Category } from '../../lib/categories';
  import { baseTemperature } from '../../lib/profiles';
  import BrewPanel from './BrewPanel.svelte';
  import NameDialog from '../../components/NameDialog.svelte';

  // Wizard: category → profile → brew panel.
  let categoryId = $state<string | null>(null);
  let profileRoot = $state<string | null>(null);
  let naming = $state(false);

  const category = $derived(app.categories.categories.find((c) => c.id === categoryId) ?? null);
  const profilesInCategory = $derived(
    (category?.profiles ?? [])
      .map((root) => ({ root, record: app.profileLineages.get(root) }))
      .filter((p) => p.record !== undefined),
  );

  function open(c: Category) {
    categoryId = c.id;
    profileRoot = null;
  }
  function back() {
    categoryId = null;
    profileRoot = null;
  }

  async function addCategory(name: string) {
    naming = false;
    const used = new Set(app.categories.categories.map((c) => c.colour));
    const colour = [1, 2, 3, 4, 5, 6, 7, 8].find((n) => !used.has(n)) ?? ((app.categories.categories.length % 8) + 1);
    await app.saveCategories({
      ...app.categories,
      categories: [...app.categories.categories, { id: newCategoryId(), name, colour, profiles: [] }],
    });
  }

  const profileCount = (c: Category) => c.profiles.filter((r) => app.profileLineages.has(r)).length;
</script>

{#if !category}
  <div class="pick">
    <h1 class="sr-only">Choose a category</h1>
    {#if app.loaded && app.categories.categories.length === 0}
      <div class="empty">
        <p class="big">Group your profiles into categories</p>
        <p>Make a category for each way you brew, like “Light roasts” or “Milk drinks”, then add profiles to it from the Profiles tab.</p>
      </div>
    {/if}
    <div class="tiles">
      {#each app.categories.categories as c (c.id)}
        <button class="tile glass" style="--tile: var(--cat-{c.colour ?? 1})" onclick={() => open(c)}>
          {#if c.icon}<span class="icon" aria-hidden="true">{c.icon}</span>{/if}
          <span class="name">{c.name}</span>
          <span class="count">{profileCount(c)} {profileCount(c) === 1 ? 'profile' : 'profiles'}</span>
        </button>
      {/each}
      <button class="tile add glass" onclick={() => (naming = true)}>
        <span class="plus" aria-hidden="true">+</span>
        <span class="name">New category</span>
      </button>
    </div>
  </div>
{:else}
  <div class="chosen" class:with-panel={profileRoot !== null} style="--tile: var(--cat-{category.colour ?? 1})">
    <div class="list">
      <div class="crumb">
        <button class="back glass" onclick={back}>‹ Categories</button>
        <h1>{category.name}</h1>
      </div>

      {#if profilesInCategory.length === 0}
        <div class="empty">
          <p class="big">No profiles in {category.name} yet</p>
          <p>Open the Profiles tab and tap {category.name} on any profile to add it here.</p>
          <button class="go-profiles glass solid" onclick={() => (app.tab = 'profiles')}>Go to Profiles</button>
        </div>
      {:else}
        <ul class="profiles">
          {#each profilesInCategory as p (p.root)}
            {@const temp = baseTemperature(p.record!.profile)}
            <li>
              <button class="profile glass" class:lit={profileRoot === p.root} class:selected={profileRoot === p.root} aria-pressed={profileRoot === p.root} onclick={() => (profileRoot = p.root)}>
                <span class="title">{p.record!.profile.title}</span>
                <span class="meta">
                  {#if temp !== null}<span>{temp}°C</span>{/if}
                  <span>{p.record!.profile.steps.length} steps</span>
                  {#if p.record!.profile.target_weight}<span>{p.record!.profile.target_weight} g out</span>{/if}
                </span>
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    </div>

    {#if profileRoot}
      {#key profileRoot}
        <BrewPanel {profileRoot} onClose={() => (profileRoot = null)} />
      {/key}
    {/if}
  </div>
{/if}

{#if naming}
  <NameDialog title="New category" label="Name" action="Add category" onSave={addCategory} onClose={() => (naming = false)} />
{/if}

<style>
  .pick, .chosen { height: 100%; overflow-y: auto; padding: var(--gutter); }

  .tiles {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 18px;
  }

  /* The one loud thing in the skin: big riso-label tiles. */
  .tile {
    position: relative;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    gap: 6px;
    min-height: 210px;
    padding: 26px 28px;
    border-radius: 34px;
    color: var(--cat-ink);
    text-align: left;
    overflow: hidden;
    /* Tinted glass: the riso colour, a little see-through, with a light
       sheen across the top. Falls back to the solid colour. */
    background: var(--tile);
    background:
      radial-gradient(120% 70% at 18% 0%, rgb(255 255 255 / 0.45), transparent 55%),
      linear-gradient(160deg, color-mix(in srgb, var(--tile) 92%, transparent), color-mix(in srgb, var(--tile) 70%, transparent));
    box-shadow: 0 22px 44px -16px color-mix(in srgb, var(--tile) 55%, transparent), var(--glass-shadow), inset 0 1px 0 rgb(255 255 255 / 0.6);
  }
  .tile .icon {
    position: absolute;
    top: 18px;
    right: 22px;
    font-size: 56px;
    line-height: 1;
    filter: drop-shadow(0 6px 10px rgb(0 0 0 / 0.25));
  }
  .tile .name {
    font-size: var(--t-xl);
    font-weight: 750;
    font-variation-settings: 'opsz' 96;
    letter-spacing: -0.02em;
    line-height: 1.02;
  }
  .tile .count { font-size: var(--t-sm); font-weight: 500; opacity: 0.75; }

  .tile.add {
    background: var(--glass-fill);
    box-shadow: var(--glass-shadow), var(--glass-sheen);
    color: var(--paper-dim);
    justify-content: center;
    align-items: center;
    text-align: center;
  }
  .tile.add .name { font-size: var(--t-md); font-weight: 600; letter-spacing: 0; }
  .plus { font-size: 54px; line-height: 1; font-weight: 300; }

  .empty { max-width: 60ch; display: grid; gap: 10px; margin-bottom: 24px; color: var(--paper-dim); }
  .empty .big { color: var(--paper); font-size: var(--t-lg); font-weight: 650; }
  .go-profiles {
    justify-self: start;
    margin-top: 6px;
    min-height: var(--touch);
    padding: 0 26px;
    border-radius: var(--radius-control);
    font-weight: 650;
  }

  .chosen {
    display: grid;
    grid-template-columns: 1fr;
    gap: var(--gutter);
    padding: 0;
    overflow: hidden;
  }
  .chosen.with-panel { grid-template-columns: minmax(0, 1fr) clamp(400px, 38vw, 520px); }
  .list { overflow-y: auto; padding: var(--gutter); }

  .crumb {
    display: flex;
    align-items: center;
    gap: 18px;
    margin-bottom: 20px;
  }
  .back {
    min-height: 56px;
    padding: 0 20px 0 14px;
    border-radius: var(--radius-pill);
    color: var(--paper-dim);
    font-size: var(--t-sm);
  }
  .crumb h1 {
    font-size: var(--t-xl);
    font-weight: 750;
    letter-spacing: -0.02em;
    color: var(--tile);
    text-shadow: 0 0 28px color-mix(in srgb, var(--tile) 45%, transparent);
  }

  .profiles {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 14px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .profile {
    width: 100%;
    min-height: 120px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 14px;
    padding: 20px 22px;
    border-radius: 26px;
    text-align: left;
  }
  .profile.selected { box-shadow: 0 0 0 3px var(--tile), 0 18px 40px -12px color-mix(in srgb, var(--tile) 45%, transparent), var(--glass-sheen); }
  .title { font-size: var(--t-md); font-weight: 650; line-height: 1.15; }
  .meta { display: flex; flex-wrap: wrap; gap: 6px 14px; color: var(--paper-dim); font-size: var(--t-xs); }

  @media (max-width: 960px) {
    .chosen.with-panel { grid-template-columns: 1fr; }
    .chosen.with-panel .list { display: none; }
  }
</style>
