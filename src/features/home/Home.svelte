<script lang="ts">
  import { app } from '../../state/app.svelte';
  import type { Category } from '../../lib/categories';
  import { baseTemperature } from '../../lib/profiles';
  import { longpress } from '../../actions/longpress';
  import BrewPanel from './BrewPanel.svelte';
  import CategoryDialog from './CategoryDialog.svelte';
  import GuideSetup from '../guide/GuideSetup.svelte';

  // Wizard: category → profile → brew panel.
  let categoryId = $state<string | null>(null);
  let profileRoot = $state<string | null>(null);
  /** Category dialog: 'new', the category being edited, or closed. */
  let editingCategory = $state<Category | 'new' | null>(null);
  let settingUpGuide = $state(false);

  // "Guide me" tile: what it's set to, and whether that still exists.
  const guideProfile = $derived(app.guide ? app.profileLineages.get(app.guide.profileRoot) : undefined);
  const guideBean = $derived(app.guide ? app.beans.find((b) => b.id === app.guide!.beanId && !b.archived) : undefined);
  const guideReady = $derived(!!guideProfile && !!guideBean);
  function openGuide() {
    if (guideReady) app.guiding = true;
    else settingUpGuide = true;
  }

  const category = $derived(app.categories.categories.find((c) => c.id === categoryId) ?? null);
  // A profile deleted from its editor closes its brew panel.
  $effect(() => { if (profileRoot && !app.profileLineages.has(profileRoot)) profileRoot = null; });
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
      <div class="guide-wrap">
        <button class="tile guide" onclick={openGuide}>
          <span class="aurora" aria-hidden="true"></span>
          <svg class="icon compass" viewBox="0 0 48 48" aria-hidden="true">
            <circle cx="24" cy="24" r="20" fill="none" stroke="currentColor" stroke-width="3" />
            <path d="M31,17 L26.5,26.5 L17,31 L21.5,21.5 Z" fill="currentColor" />
          </svg>
          <span class="name">Guide me</span>
          <span class="count">{guideReady ? `${guideProfile!.profile.title} · ${guideBean!.name}` : 'Tap to choose a profile and coffee'}</span>
        </button>
        {#if guideReady}<button class="change" onclick={() => (settingUpGuide = true)}>Change</button>{/if}
      </div>
      <button class="tile add glass" onclick={() => (editingCategory = 'new')}>
        <svg class="plus" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v16M4 12h16" /></svg>
        <span class="name">New category</span>
      </button>
    </div>
  </div>
{:else}
  <div class="chosen" class:with-panel={profileRoot !== null} style="--tile: var(--cat-{category.colour ?? 1})">
    {#if !profileRoot}
    <div class="list">
      <div class="crumb">
        <button class="back glass" onclick={back}>‹ Categories</button>
        <h1>{category.name}</h1>
        <button class="edit-cat glass" onclick={() => (editingCategory = category)}>Edit</button>
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
              <button class="profile glass" class:lit={profileRoot === p.root} class:selected={profileRoot === p.root} aria-pressed={profileRoot === p.root} title="Hold to edit"
                use:longpress={{ onhold: () => (app.editing = p.record!) }} onclick={() => (profileRoot = p.root)}>
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
    {:else}
      {#key profileRoot}
        <BrewPanel {profileRoot} onClose={() => (profileRoot = null)} />
      {/key}
    {/if}
  </div>
{/if}

{#if settingUpGuide}
  <GuideSetup onClose={() => (settingUpGuide = false)} onSaved={() => (app.guiding = true)} />
{/if}

{#if editingCategory}
  <CategoryDialog category={editingCategory === 'new' ? null : editingCategory} onClose={() => (editingCategory = null)} onDeleted={back} />
{/if}

<style>
  .pick, .chosen { height: 100%; overflow-y: auto; padding: var(--gutter); }

  .tiles {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(222px, 1fr));
    gap: 14px;
  }

  /* The one loud thing in the skin: big riso-label tiles. */
  .tile {
    position: relative;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    gap: 4px;
    min-height: 150px;
    padding: 19px 20px;
    border-radius: 26px;
    color: var(--cat-ink);
    text-align: left;
    overflow: hidden;
    /* Tinted glass: the riso colour, a little see-through, with a light
       sheen across the top. Falls back to the solid colour. */
    background: var(--tile);
    background:
      radial-gradient(120% 70% at 18% 0%, rgb(255 255 255 / 0.45), transparent 55%),
      linear-gradient(160deg, color-mix(in srgb, var(--tile) 92%, transparent), color-mix(in srgb, var(--tile) 70%, transparent));
    box-shadow: 0 16px 33px -16px color-mix(in srgb, var(--tile) 55%, transparent), var(--glass-shadow), inset 0 1px 0 rgb(255 255 255 / 0.6);
  }
  .tile .icon {
    position: absolute;
    top: 14px;
    right: 16px;
    font-size: 39px;
    line-height: 1;
    filter: drop-shadow(0 4px 8px rgb(0 0 0 / 0.25));
  }
  .tile .name {
    font-size: var(--t-xl);
    font-weight: 750;
    letter-spacing: -0.02em;
    line-height: 1.02;
  }
  .tile .count { font-size: var(--t-sm); font-weight: 500; opacity: 0.75; }

  /* Guide me: a slowly turning aurora of all the tile inks under dark glass. */
  .guide-wrap { position: relative; display: grid; }
  .tile.guide {
    color: var(--paper);
    background: #0d2228;
    isolation: isolate;
    box-shadow: 0 16px 33px -16px rgb(134 166 238 / 0.55), var(--glass-shadow), inset 0 1px 0 rgb(255 255 255 / 0.35);
  }
  .tile.guide .aurora {
    position: absolute;
    inset: -40%;
    z-index: -1;
    background: conic-gradient(from var(--spin, 0deg), var(--cat-2), var(--cat-4), var(--cat-3), var(--cat-6), var(--cat-1), var(--cat-2));
    filter: blur(21px) saturate(130%);
    opacity: 0.85;
    animation: aurora 9s linear infinite;
  }
  .tile.guide::after {
    content: '';
    position: absolute;
    inset: 0;
    z-index: -1;
    border-radius: inherit;
    background: linear-gradient(160deg, rgb(255 255 255 / 0.22), rgb(8 22 26 / 0.45) 55%, rgb(8 22 26 / 0.6));
  }
  @property --spin { syntax: '<angle>'; inherits: false; initial-value: 0deg; }
  @keyframes aurora { to { --spin: 360deg; } }
  .tile.guide .compass { width: 42px; height: 42px; color: var(--paper); filter: drop-shadow(0 3px 9px rgb(0 0 0 / 0.35)); }
  .tile.guide .count { opacity: 0.9; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
  .change {
    position: absolute;
    top: 12px;
    left: 14px;
    min-height: 40px;
    padding: 0 12px;
    border-radius: var(--radius-pill);
    background: rgb(8 22 26 / 0.45);
    color: var(--paper);
    font-size: var(--t-xs);
    font-weight: 650;
    -webkit-backdrop-filter: blur(8px);
    backdrop-filter: blur(8px);
  }

  .tile.add {
    background: var(--glass-fill);
    box-shadow: var(--glass-shadow), var(--glass-sheen);
    color: var(--paper-dim);
    justify-content: center;
    align-items: center;
    text-align: center;
  }
  .tile.add .name { font-size: var(--t-md); font-weight: 600; letter-spacing: 0; }
  .plus { width: 40px; height: 40px; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; }

  .empty { max-width: 60ch; display: grid; gap: 8px; margin-bottom: 18px; color: var(--paper-dim); }
  .empty .big { color: var(--paper); font-size: var(--t-lg); font-weight: 650; }
  .go-profiles {
    justify-self: start;
    margin-top: 4px;
    min-height: var(--touch);
    padding: 0 20px;
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
  /* With a profile chosen, the brew panel takes the whole area. */
  .chosen.with-panel { grid-template-columns: minmax(0, 1fr); grid-template-rows: minmax(0, 1fr); }
  .list { overflow-y: auto; padding: var(--gutter); }

  .crumb {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 15px;
  }
  .back {
    min-height: 42px;
    padding: 0 15px 0 10px;
    border-radius: var(--radius-pill);
    color: var(--paper-dim);
    font-size: var(--t-sm);
  }
  .edit-cat { margin-left: auto; min-height: 40px; padding: 0 14px; border-radius: var(--radius-pill); color: var(--paper); font-size: var(--t-xs); font-weight: 650; }
  .crumb h1 {
    font-size: var(--t-xl);
    font-weight: 750;
    letter-spacing: -0.02em;
    color: var(--tile);
    text-shadow: 0 0 21px color-mix(in srgb, var(--tile) 45%, transparent);
  }

  .profiles {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(222px, 1fr));
    gap: 10px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .profile {
    width: 100%;
    min-height: 90px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 10px;
    padding: 15px 16px;
    border-radius: 20px;
    text-align: left;
    transition: transform 500ms ease;
    -webkit-touch-callout: none;
  }
  /* Hold to edit: the tile sinks a little while the finger stays down. */
  .profile:global(.holding) { transform: scale(0.96); }
  .profile.selected { box-shadow: 0 0 0 3px var(--tile), 0 14px 30px -12px color-mix(in srgb, var(--tile) 45%, transparent), var(--glass-sheen); }
  .title { font-size: var(--t-md); font-weight: 650; line-height: 1.15; }
  .meta { display: flex; flex-wrap: wrap; gap: 4px 10px; color: var(--paper-dim); font-size: var(--t-xs); }

</style>
