<script lang="ts">
  import { app } from '../../state/app.svelte';
  import Modal from '../../components/Modal.svelte';
  import ConfirmDialog from '../../components/ConfirmDialog.svelte';
  import { moveCategory, newCategoryId, removeCategory, updateCategory, type Category } from '../../lib/categories';

  // Create or edit a category: name, tile colour, icon, position on Home,
  // and delete. Deleting never touches the profiles in it.

  let { category = null, onClose, onDeleted }: { category?: Category | null; onClose: () => void; onDeleted?: () => void } = $props();

  const ICONS = ['☕', '🌸', '🔥', '🍫', '🍋', '🍒', '🫖', '🥛', '🔧', '⚡', '🌙', '⭐'];

  // svelte-ignore state_referenced_locally
  let name = $state(category?.name ?? '');
  // svelte-ignore state_referenced_locally
  let colour = $state(category?.colour ?? firstFreeColour());
  // svelte-ignore state_referenced_locally
  let icon = $state(category?.icon ?? '');
  let saving = $state(false);
  let error = $state<string | null>(null);
  let confirming = $state(false);

  const index = $derived(category ? app.categories.categories.findIndex((c) => c.id === category!.id) : -1);
  const count = $derived(app.categories.categories.length);
  const trimmed = $derived(name.trim());

  function firstFreeColour(): number {
    const used = new Set(app.categories.categories.map((c) => c.colour));
    return [1, 2, 3, 4, 5, 6, 7, 8].find((n) => !used.has(n)) ?? ((app.categories.categories.length % 8) + 1);
  }

  async function run(fn: () => Promise<void>) {
    saving = true;
    error = null;
    try { await fn(); } catch (e) { error = (e as Error).message; } finally { saving = false; }
  }

  const save = () => run(async () => {
    if (category) {
      await app.saveCategories(updateCategory(app.categories, category.id, { name: trimmed, colour, icon: icon.trim() }));
    } else {
      const c: Category = { id: newCategoryId(), name: trimmed, colour, profiles: [], ...(icon.trim() ? { icon: icon.trim() } : {}) };
      await app.saveCategories({ ...app.categories, categories: [...app.categories.categories, c] });
    }
    onClose();
  });

  // Moving saves straight away (it's its own small change), like the chips on Profiles.
  const move = (to: number) => run(() => app.saveCategories(moveCategory(app.categories, category!.id, to)));
</script>

<Modal title={category ? 'Edit category' : 'New category'} {onClose}>
  <label class="field">
    <span>Name</span>
    <input class="well" bind:value={name} placeholder="e.g. Light roasts" maxlength="40" onkeydown={(e) => { if (e.key === 'Enter' && trimmed && !saving) save(); }} />
  </label>

  <div class="field">
    <span>Colour</span>
    <div class="swatches" role="radiogroup" aria-label="Tile colour">
      {#each [1, 2, 3, 4, 5, 6, 7, 8] as n (n)}
        <button class="swatch" class:on={colour === n} style="--c: var(--cat-{n})" role="radio" aria-checked={colour === n} aria-label="Colour {n}" onclick={() => (colour = n)}></button>
      {/each}
    </div>
  </div>

  <div class="field">
    <span>Icon</span>
    <div class="icons" role="radiogroup" aria-label="Icon">
      <button class="ico glass" class:lit={!icon} role="radio" aria-checked={!icon} onclick={() => (icon = '')}>None</button>
      {#each ICONS as i (i)}
        <button class="ico glass" class:lit={icon === i} role="radio" aria-checked={icon === i} onclick={() => (icon = i)}>{i}</button>
      {/each}
      <input class="own well" aria-label="Your own icon" placeholder="Own" maxlength="4" value={ICONS.includes(icon) ? '' : icon} oninput={(e) => (icon = e.currentTarget.value)} />
    </div>
  </div>

  <div class="preview" style="--tile: var(--cat-{colour})">
    {#if icon}<span class="pi">{icon}</span>{/if}
    <b>{trimmed || 'Category'}</b>
  </div>

  {#if category}
    <div class="row">
      <span class="pos">Position {index + 1} of {count}</span>
      <button class="glass small" disabled={saving || index <= 0} onclick={() => move(index - 1)}>Move earlier</button>
      <button class="glass small" disabled={saving || index >= count - 1} onclick={() => move(index + 1)}>Move later</button>
      <button class="glass small danger" disabled={saving} onclick={() => (confirming = true)}>Delete</button>
    </div>
  {/if}

  {#if error}<p class="error" role="alert">{error}</p>{/if}

  {#snippet actions()}
    <button class="secondary glass" onclick={onClose}>Cancel</button>
    <button class="primary glass solid" disabled={!trimmed || saving} onclick={save}>{saving ? 'Saving…' : category ? 'Save' : 'Add category'}</button>
  {/snippet}
</Modal>

{#if confirming && category}
  <ConfirmDialog
    title="Delete “{category.name}”?"
    message="The category goes from Home. Its {category.profiles.length} {category.profiles.length === 1 ? 'profile stays' : 'profiles stay'} in Profiles, along with all your dial-ins."
    action="Delete category"
    onConfirm={async () => { await app.saveCategories(removeCategory(app.categories, category!.id)); onDeleted?.(); onClose(); }}
    onClose={() => (confirming = false)}
  />
{/if}

<style>
  .field { display: grid; gap: 6px; color: var(--paper-dim); font-size: var(--t-sm); }
  input { min-height: var(--touch); padding: 0 12px; border-radius: var(--radius-control); border: 1px solid rgb(255 255 255 / 0.08); color: var(--paper); font-size: var(--t-md); user-select: text; }
  input:focus { outline: none; border-color: rgb(255 255 255 / 0.45); }
  .swatches, .icons { display: flex; flex-wrap: wrap; gap: 6px; }
  .swatch { width: 40px; height: 40px; border-radius: 50%; background: var(--c); box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.5); }
  .swatch.on { box-shadow: 0 0 0 3px var(--ink), 0 0 0 4px var(--paper); }
  .ico { min-width: 40px; height: 40px; padding: 0 8px; border-radius: 10px; font-size: 16px; color: var(--paper-dim); }
  .ico:first-child { font-size: var(--t-xs); }
  .ico.lit { box-shadow: 0 0 0 2px var(--paper), var(--glass-sheen); color: var(--paper); }
  .own { width: 57px; min-height: 40px; padding: 0 8px; font-size: 15px; text-align: center; }
  .preview {
    position: relative;
    min-height: 82px;
    padding: 12px 15px;
    border-radius: 18px;
    display: flex;
    align-items: flex-end;
    background: radial-gradient(120% 70% at 18% 0%, rgb(255 255 255 / 0.45), transparent 55%), var(--tile);
    color: var(--cat-ink);
  }
  .preview b { font-size: var(--t-lg); font-weight: 750; }
  .pi { position: absolute; top: 9px; right: 12px; font-size: 26px; }
  .row { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
  .pos { color: var(--paper-faint); font-size: var(--t-xs); margin-right: auto; }
  .small { min-height: 40px; padding: 0 12px; border-radius: var(--radius-pill); color: var(--paper); font-size: var(--t-xs); font-weight: 650; }
  .small.danger { color: #ffb3ab; }
  .small:disabled { opacity: 0.4; }
  .error { color: var(--stop); }
  .primary, .secondary { min-height: var(--touch); padding: 0 20px; border-radius: var(--radius-control); font-weight: 650; }
  .secondary { color: var(--paper-dim); }
  .primary:disabled { opacity: 0.4; }
</style>
