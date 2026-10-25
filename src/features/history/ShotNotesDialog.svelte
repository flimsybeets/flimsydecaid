<script lang="ts">
  import { app } from '../../state/app.svelte';
  import type { ShotSummary } from '../../api/types';
  import Modal from '../../components/Modal.svelte';
  import Stepper from '../../components/Stepper.svelte';

  // Rating (Decaid's 0–10) and tasting notes for one shot. Only these two
  // annotation fields are sent; Decaid merges, so anything else on the shot
  // (TDS, extras from other skins) is kept.

  let { shot, onClose, onSaved }: { shot: ShotSummary; onClose: () => void; onSaved: (updated: ShotSummary) => void } = $props();

  // svelte-ignore state_referenced_locally
  let rating = $state<number | undefined>(shot.annotations?.enjoyment ?? undefined);
  // svelte-ignore state_referenced_locally
  let notes = $state(shot.annotations?.espressoNotes ?? '');
  let saving = $state(false);
  let error = $state<string | null>(null);

  async function save() {
    saving = true;
    error = null;
    try {
      const updated = await app.annotateShot(shot.id, { enjoyment: rating ?? null, espressoNotes: notes.trim() || null });
      onSaved(updated);
      onClose();
    } catch (e) {
      error = `Couldn't save: ${(e as Error).message}`;
    } finally {
      saving = false;
    }
  }
</script>

<Modal title="Rate and add notes" {onClose}>
  <div class="rate">
    <Stepper typeable label="Rating" hint="out of 10" bind:value={rating} min={0} max={10} step={0.5} decimals={1} placeholder="Not rated" />
    {#if rating !== undefined}<button class="clear glass" onclick={() => (rating = undefined)}>Clear rating</button>{/if}
  </div>
  <label>
    <span>Notes</span>
    <textarea class="well" rows="4" bind:value={notes} placeholder="How it tasted, what to change next time"></textarea>
  </label>
  {#if error}<p class="error" role="alert">{error}</p>{/if}

  {#snippet actions()}
    <button class="secondary glass" onclick={onClose}>Cancel</button>
    <button class="primary glass solid" disabled={saving} onclick={save}>{saving ? 'Saving…' : 'Save'}</button>
  {/snippet}
</Modal>

<style>
  .rate { display: grid; grid-template-columns: minmax(0, 240px) auto; gap: 9px; align-items: end; }
  .clear { min-height: 40px; padding: 0 12px; border-radius: var(--radius-pill); color: var(--paper-dim); font-size: var(--t-xs); }
  label { display: grid; gap: 4px; color: var(--paper-dim); font-size: var(--t-sm); }
  textarea { padding: 9px 12px; border-radius: var(--radius-control); border: 1px solid rgb(255 255 255 / 0.08); color: var(--paper); font: inherit; font-size: var(--t-sm); line-height: 1.4; resize: vertical; user-select: text; }
  textarea:focus { outline: none; border-color: rgb(255 255 255 / 0.45); }
  .error { color: var(--stop); }
  .primary, .secondary { min-height: var(--touch); padding: 0 20px; border-radius: var(--radius-control); font-weight: 650; }
  .secondary { color: var(--paper-dim); }
</style>
