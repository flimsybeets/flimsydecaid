<script lang="ts">
  import { app } from '../../state/app.svelte';
  import type { Bean } from '../../api/types';
  import Modal from '../../components/Modal.svelte';
  import ConfirmDialog from '../../components/ConfirmDialog.svelte';

  // Edit a coffee (Decaid "bean"): roaster, name, origin, notes. Removing it
  // archives the coffee and its bags, so shots and other skins keep them.

  let { bean, onClose }: { bean: Bean; onClose: () => void } = $props();

  // svelte-ignore state_referenced_locally
  let roaster = $state(bean.roaster);
  // svelte-ignore state_referenced_locally
  let name = $state(bean.name);
  // svelte-ignore state_referenced_locally
  let country = $state(bean.country ?? '');
  // svelte-ignore state_referenced_locally
  let processing = $state(bean.processing ?? '');
  // svelte-ignore state_referenced_locally
  let notes = $state(bean.notes ?? '');
  // svelte-ignore state_referenced_locally
  let decaf = $state(bean.decaf);
  let saving = $state(false);
  let error = $state<string | null>(null);
  let confirming = $state(false);

  const canSave = $derived(!saving && !!roaster.trim() && !!name.trim());
  const openBags = $derived(app.batches.filter((b) => b.beanId === bean.id && !b.archived).length);
  // Text fields Decaid accepts null for: an emptied field is cleared, not left as "".
  const orNull = (v: string) => v.trim() || null;

  async function save() {
    saving = true;
    error = null;
    try {
      await app.updateBean(bean.id, { roaster: roaster.trim(), name: name.trim(), country: orNull(country), processing: orNull(processing), notes: orNull(notes), decaf });
      onClose();
    } catch (e) {
      error = `Couldn't save: ${(e as Error).message}`;
    } finally {
      saving = false;
    }
  }
</script>

<Modal title="Edit coffee" {onClose}>
  <div class="two">
    <label><span>Roaster</span><input class="well" bind:value={roaster} /></label>
    <label><span>Coffee name</span><input class="well" bind:value={name} /></label>
  </div>
  <div class="two">
    <label><span>Country</span><input class="well" bind:value={country} placeholder="e.g. Ethiopia" /></label>
    <label><span>Process</span><input class="well" bind:value={processing} placeholder="e.g. washed" /></label>
  </div>
  <label><span>Tasting notes</span><input class="well" bind:value={notes} placeholder="e.g. peach, jasmine" /></label>
  <label class="check"><input type="checkbox" bind:checked={decaf} /> Decaf</label>

  <button class="remove glass" onclick={() => (confirming = true)}>Remove coffee</button>
  {#if error}<p class="error" role="alert">{error}</p>{/if}

  {#snippet actions()}
    <button class="secondary glass" onclick={onClose}>Cancel</button>
    <button class="primary glass solid" disabled={!canSave} onclick={save}>{saving ? 'Saving…' : 'Save'}</button>
  {/snippet}
</Modal>

{#if confirming}
  <ConfirmDialog
    title="Remove {bean.name}?"
    message={`It ${openBags ? `and its ${openBags} open ${openBags === 1 ? 'bag are' : 'bags are'}` : 'is'} archived in Decaid: gone from here, but shot history keeps it. Restore it from Decaid's own bean settings if you change your mind.`}
    action="Remove coffee"
    onConfirm={async () => { await app.removeCoffee(bean.id); onClose(); }}
    onClose={() => (confirming = false)}
  />
{/if}

<style>
  label { display: grid; gap: 6px; color: var(--paper-dim); font-size: var(--t-sm); }
  input:not([type=checkbox]) { min-height: var(--touch); padding: 0 16px; border-radius: var(--radius-control); border: 1px solid rgb(255 255 255 / 0.08); color: var(--paper); font-size: var(--t-md); user-select: text; }
  input:focus { outline: none; border-color: rgb(255 255 255 / 0.45); }
  .two { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .check { display: flex; align-items: center; gap: 10px; min-height: var(--touch); }
  .check input { width: 26px; height: 26px; accent-color: var(--paper); }
  .remove { justify-self: start; min-height: 48px; padding: 0 18px; border-radius: var(--radius-pill); color: #ffb3ab; font-size: var(--t-xs); font-weight: 650; }
  .error { color: var(--stop); }
  .primary, .secondary { min-height: var(--touch); padding: 0 26px; border-radius: var(--radius-control); font-weight: 650; }
  .secondary { color: var(--paper-dim); }
  .primary:disabled { opacity: 0.4; }
</style>
