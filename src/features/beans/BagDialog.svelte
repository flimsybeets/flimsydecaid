<script lang="ts">
  import { app } from '../../state/app.svelte';
  import type { BeanBatch } from '../../api/types';
  import Modal from '../../components/Modal.svelte';
  import Stepper from '../../components/Stepper.svelte';
  import ConfirmDialog from '../../components/ConfirmDialog.svelte';
  import { toJpegDataUrl } from '../../lib/photo';

  // Edit a bag: roast date, weight and what's left, frozen, photo. Finished
  // bags can be reopened. Delete is permanent (photo too); shots keep the
  // coffee's name but lose the link to the bag.

  let { bag, onClose }: { bag: BeanBatch; onClose: () => void } = $props();

  const dateInput = (iso?: string | null) => (iso ? iso.slice(0, 10) : '');
  // svelte-ignore state_referenced_locally
  let roastDate = $state(dateInput(bag.roastDate));
  // svelte-ignore state_referenced_locally
  let weight = $state<number | undefined>(bag.weight ?? undefined);
  // svelte-ignore state_referenced_locally
  let remaining = $state<number | undefined>(bag.weightRemaining ?? undefined);
  // svelte-ignore state_referenced_locally
  let frozen = $state(bag.frozen);
  let photo = $state<string | null | undefined>(undefined); // undefined = unchanged
  let fileInput: HTMLInputElement;
  let saving = $state(false);
  let error = $state<string | null>(null);
  let confirming = $state(false);

  const bean = $derived(app.beans.find((b) => b.id === bag.beanId));
  const shownPhoto = $derived(photo === undefined ? app.photos[bag.id] : photo);

  async function onFile(e: Event) {
    const file = (e.currentTarget as HTMLInputElement).files?.[0];
    if (!file) return;
    try { photo = await toJpegDataUrl(file); } catch { error = "That photo couldn't be read. Try another."; }
  }

  async function save(patch: Partial<BeanBatch> = {}) {
    saving = true;
    error = null;
    try {
      // Noon local time, so the date doesn't slip a day in either direction.
      const roast = roastDate ? new Date(`${roastDate}T12:00:00`).toISOString() : null;
      const changedRoast = dateInput(bag.roastDate) !== roastDate;
      await app.updateBag(bag.id, {
        ...(changedRoast ? { roastDate: roast } : {}),
        weight: weight ?? null,
        weightRemaining: remaining ?? null,
        frozen,
        ...(frozen !== bag.frozen ? (frozen ? { freezeDate: new Date().toISOString() } : { unfreezeDate: new Date().toISOString() }) : {}),
        ...patch,
      });
      if (photo) await app.savePhoto(bag.id, photo);
      onClose();
    } catch (e) {
      error = `Couldn't save: ${(e as Error).message}`;
    } finally {
      saving = false;
    }
  }
</script>

<Modal title="Edit bag{bean ? ` · ${bean.name}` : ''}" {onClose}>
  <div class="photo">
    {#if shownPhoto}<img src={shownPhoto} alt="The bag" />{/if}
    <button class="small glass" onclick={() => fileInput.click()}>{shownPhoto ? 'Change photo' : 'Add a photo'}</button>
    <input bind:this={fileInput} class="sr-only" type="file" accept="image/*" onchange={onFile} tabindex="-1" aria-hidden="true" />
  </div>

  <div class="two">
    <label><span>Roast date</span><input class="well" type="date" bind:value={roastDate} /></label>
    <label class="check"><input type="checkbox" bind:checked={frozen} /> Frozen</label>
  </div>
  <div class="two">
    <Stepper typeable label="Bag weight" bind:value={weight} min={0} max={5000} step={50} unit="g" placeholder="Not set" />
    <Stepper typeable label="Left" bind:value={remaining} min={0} max={weight ?? 5000} step={10} unit="g" placeholder="Not set" />
  </div>

  <div class="row">
    {#if bag.archived}
      <button class="small glass" disabled={saving} onclick={() => save({ archived: false })}>Reopen this bag</button>
    {/if}
    <button class="small glass danger" disabled={saving} onclick={() => (confirming = true)}>Delete bag</button>
  </div>
  {#if error}<p class="error" role="alert">{error}</p>{/if}

  {#snippet actions()}
    <button class="secondary glass" onclick={onClose}>Cancel</button>
    <button class="primary glass solid" disabled={saving} onclick={() => save()}>{saving ? 'Saving…' : 'Save'}</button>
  {/snippet}
</Modal>

{#if confirming}
  <ConfirmDialog
    title="Delete this bag?"
    message="It's removed from Decaid for good, with its photo and the grind, dose and temperature you saved for it. Shots made with it keep the coffee's name. To just put it away, use Finished instead."
    action="Delete bag"
    onConfirm={async () => { await app.deleteBag(bag.id); onClose(); }}
    onClose={() => (confirming = false)}
  />
{/if}

<style>
  label { display: grid; gap: 4px; color: var(--paper-dim); font-size: var(--t-sm); }
  input[type=date] { min-height: var(--touch); padding: 0 12px; border-radius: var(--radius-control); border: 1px solid rgb(255 255 255 / 0.08); color: var(--paper); font-size: var(--t-md); }
  .two { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; align-items: end; }
  .check { display: flex; align-items: center; gap: 8px; min-height: var(--touch); }
  .check input { width: 20px; height: 20px; accent-color: var(--paper); }
  .photo { display: flex; align-items: center; gap: 10px; }
  .photo img { width: 72px; height: 72px; object-fit: cover; border-radius: 12px; }
  .row { display: flex; flex-wrap: wrap; gap: 6px; }
  .small { min-height: 40px; padding: 0 14px; border-radius: var(--radius-pill); color: var(--paper); font-size: var(--t-xs); font-weight: 650; }
  .small.danger { color: #ffb3ab; }
  .error { color: var(--stop); }
  .primary, .secondary { min-height: var(--touch); padding: 0 20px; border-radius: var(--radius-control); font-weight: 650; }
  .secondary { color: var(--paper-dim); }
</style>
