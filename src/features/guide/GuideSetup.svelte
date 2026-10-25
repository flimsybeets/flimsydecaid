<script lang="ts">
  import { app } from '../../state/app.svelte';
  import Modal from '../../components/Modal.svelte';
  import { pickBag, planBrew } from '../../lib/guide';

  // Choose what "Guide me" brews: one profile and one coffee. The coffee's
  // newest open bag is used each time, with that bag's dial-in.

  let { onClose, onSaved }: { onClose: () => void; onSaved?: () => void } = $props();

  // svelte-ignore state_referenced_locally
  let profileRoot = $state<string | null>(app.guide?.profileRoot ?? null);
  // svelte-ignore state_referenced_locally
  let beanId = $state<string | null>(app.guide?.beanId ?? null);
  let query = $state('');
  let saving = $state(false);
  let error = $state<string | null>(null);

  const profiles = $derived(
    [...app.profileLineages.entries()]
      .map(([root, record]) => ({ root, record }))
      .filter(({ record }) => !query.trim() || record.profile.title.toLowerCase().includes(query.trim().toLowerCase()))
      .sort((a, b) => a.record.profile.title.localeCompare(b.record.profile.title)),
  );
  const coffees = $derived(app.beans.filter((b) => !b.archived && pickBag(b.id, app.batches)));
  const preview = $derived.by(() => {
    if (!profileRoot || !beanId) return null;
    const record = app.profileLineages.get(profileRoot);
    if (!record) return null;
    return planBrew(record, profileRoot, pickBag(beanId, app.batches), app.batches, app.workflow.context?.targetDoseWeight ?? 18);
  });

  async function save() {
    if (!profileRoot || !beanId) return;
    saving = true;
    error = null;
    try {
      await app.saveGuide({ profileRoot, beanId });
      onSaved?.();
      onClose();
    } catch (e) {
      error = `Couldn't save: ${(e as Error).message}`;
    } finally {
      saving = false;
    }
  }
</script>

<Modal title="Set up Guide me" {onClose}>
  <div class="cols">
    <section>
      <h3>Profile</h3>
      <input class="search well" type="search" placeholder="Search {app.profileLineages.size} profiles" bind:value={query} aria-label="Search profiles" />
      <ul class="list" role="radiogroup" aria-label="Profile">
        {#each profiles as { root, record } (root)}
          <li><button class="opt glass" class:lit={root === profileRoot} role="radio" aria-checked={root === profileRoot} onclick={() => (profileRoot = root)}>{record.profile.title}</button></li>
        {:else}
          <li class="none">No profiles match</li>
        {/each}
      </ul>
    </section>
    <section>
      <h3>Coffee</h3>
      <ul class="list" role="radiogroup" aria-label="Coffee">
        {#each coffees as b (b.id)}
          <li><button class="opt glass" class:lit={b.id === beanId} role="radio" aria-checked={b.id === beanId} onclick={() => (beanId = b.id)}>
            <span>{b.name}</span><small>{b.roaster}</small>
          </button></li>
        {:else}
          <li class="none">No coffee with an open bag. Add a bag in Beans.</li>
        {/each}
      </ul>
    </section>
  </div>

  {#if preview}
    <p class="preview">
      {preview.dose.toFixed(1)} g in{preview.yield ? ` · ${preview.yield} g out` : ''} · {preview.grind ? `grind ${preview.grind}` : 'no grind saved yet'}
      <span>{preview.source === 'this-bag' ? 'from this bag' : preview.source === 'previous-bag' ? 'from your last bag' : 'profile defaults'}</span>
    </p>
  {/if}
  {#if error}<p class="error">{error}</p>{/if}

  {#snippet actions()}
    <button class="secondary glass" onclick={onClose}>Cancel</button>
    <button class="primary glass solid" disabled={!profileRoot || !beanId || saving} onclick={save}>{saving ? 'Saving…' : 'Save'}</button>
  {/snippet}
</Modal>

<style>
  .cols { display: grid; grid-template-columns: 1.3fr 1fr; gap: 18px; }
  section { display: grid; gap: 10px; align-content: start; min-width: 0; }
  h3 { font-size: var(--t-xs); font-weight: 650; text-transform: uppercase; letter-spacing: 0.06em; color: var(--paper-faint); }
  .search { min-height: 52px; padding: 0 16px; border-radius: 14px; border: 1px solid rgb(255 255 255 / 0.08); font-size: var(--t-sm); user-select: text; }
  .search:focus { outline: none; border-color: rgb(255 255 255 / 0.45); }
  .list { list-style: none; margin: 0; padding: 4px; display: grid; gap: 6px; max-height: 300px; overflow-y: auto; margin: -4px; }
  .opt { width: 100%; min-height: 56px; padding: 8px 16px; border-radius: 16px; text-align: left; display: grid; color: var(--paper); font-weight: 600; }
  .opt small { color: var(--paper-faint); font-weight: 500; font-size: var(--t-xs); }
  .opt.lit { box-shadow: 0 0 0 3px var(--go), var(--glass-sheen); }
  .none { color: var(--paper-faint); padding: 8px 4px; }
  .preview { font-size: var(--t-md); font-weight: 700; }
  .preview span { display: block; font-size: var(--t-xs); color: var(--paper-faint); font-weight: 500; }
  .error { color: var(--stop); }
  .primary, .secondary { min-height: var(--touch); padding: 0 28px; border-radius: var(--radius-control); font-weight: 650; }
  .secondary { color: var(--paper-dim); }
  .primary:disabled { opacity: 0.4; }
  @media (max-width: 700px) { .cols { grid-template-columns: 1fr; } }
</style>
