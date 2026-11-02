<script lang="ts">
  import { app } from '../../state/app.svelte';
  import type { Bean } from '../../api/types';
  import Modal from '../../components/Modal.svelte';
  import ConfirmDialog from '../../components/ConfirmDialog.svelte';
  import PhotoCrop from '../../components/PhotoCrop.svelte';
  import { colourChoicesOfDataUrl, dataUrlBlob, frameBlob, openFrontCamera, stopStream } from '../../lib/photo';

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

  // Optional photo of the coffee: undefined = unchanged, null = remove, string = new.
  let photo = $state<string | null | undefined>(undefined);
  let cropping = $state<Blob | null>(null);
  let stream = $state<MediaStream | null>(null);
  let video = $state<HTMLVideoElement>();
  let fileInput: HTMLInputElement;
  let cameraInput: HTMLInputElement;
  let photoNote = $state<string | null>(null);
  // svelte-ignore state_referenced_locally
  const shownPhoto = $derived(photo === undefined ? app.beanPhotos[bean.id] : photo);

  $effect(() => { void app.loadBeanPhoto(bean.id); });

  // Colour: picked from the photo's own colours (first = the automatic pick).
  let colour = $state<string | null | undefined>(undefined); // undefined = unchanged / automatic
  let choices = $state<string[]>([]);
  $effect(() => {
    const url = shownPhoto;
    choices = [];
    if (!url) return;
    let live = true;
    void colourChoicesOfDataUrl(url).then((c) => { if (live) choices = c; });
    return () => { live = false; };
  });
  // A new photo starts on its automatic colour; the old photo shows what's saved.
  // svelte-ignore state_referenced_locally
  const currentColour = $derived(colour !== undefined ? colour : photo === undefined ? (app.coffeeColours[bean.id] ?? null) : (choices[0] ?? null));

  /** Crop the photo already on the coffee. */
  async function cropExisting() {
    if (!shownPhoto) return;
    try { cropping = await dataUrlBlob(shownPhoto); } catch { photoNote = "That photo couldn't be read."; }
  }
  $effect(() => {
    if (video && stream) {
      video.srcObject = stream;
      void video.play().catch(() => {});
    }
  });
  $effect(() => () => stopStream(stream));

  async function takePhoto() {
    photoNote = null;
    const s = await openFrontCamera();
    if (s) { stream = s; return; }
    cameraInput.click(); // no live camera here: the system capture picker
  }
  async function snap() {
    if (!video) return;
    try { cropping = await frameBlob(video); } catch { photoNote = "That photo couldn't be taken. Try again."; return; }
    stopStream(stream);
    stream = null;
  }
  function onFile(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { photoNote = "That photo couldn't be read. Try another."; return; }
    cropping = file;
  }

  const canSave = $derived(!saving && !!roaster.trim() && !!name.trim());
  const openBags = $derived(app.batches.filter((b) => b.beanId === bean.id && !b.archived).length);
  // Text fields Decaid accepts null for: an emptied field is cleared, not left as "".
  const orNull = (v: string) => v.trim() || null;

  async function save() {
    saving = true;
    error = null;
    try {
      await app.updateBean(bean.id, { roaster: roaster.trim(), name: name.trim(), country: orNull(country), processing: orNull(processing), notes: orNull(notes), decaf });
      if (photo) await app.saveBeanPhoto(bean.id, photo, colour);
      else if (photo === null) await app.removeBeanPhoto(bean.id);
      else if (colour !== undefined) app.setCoffeeColour(bean.id, colour);
      onClose();
    } catch (e) {
      error = `Couldn't save: ${(e as Error).message}`;
    } finally {
      saving = false;
    }
  }
</script>

<Modal title="Edit coffee" {onClose}>
  <div class="photo">
    {#if stream}
      <!-- svelte-ignore a11y_media_has_caption -->
      <video bind:this={video} playsinline muted></video>
      <button class="small glass solid" onclick={snap}>Take photo</button>
    {:else}
      {#if shownPhoto}<img src={shownPhoto} alt="The coffee" />{/if}
      <button class="small glass" onclick={takePhoto}>Take photo</button>
      <button class="small glass" onclick={() => fileInput.click()}>Choose photo</button>
      {#if shownPhoto}<button class="small glass" onclick={cropExisting}>Crop photo</button>{/if}
      {#if shownPhoto}<button class="small glass danger" onclick={() => (photo = null)}>Remove photo</button>{/if}
    {/if}
    <input bind:this={fileInput} class="sr-only" type="file" accept="image/*" onchange={onFile} tabindex="-1" aria-hidden="true" />
    <input bind:this={cameraInput} class="sr-only" type="file" accept="image/*" capture="user" onchange={onFile} tabindex="-1" aria-hidden="true" />
    {#if photoNote}<p class="error">{photoNote}</p>{/if}
  </div>
  {#if shownPhoto && choices.length > 0}
    <div class="colours" role="radiogroup" aria-label="Coffee colour">
      <span>Colour</span>
      {#each choices as c (c)}
        <button class="swatch" style:--c={c} role="radio" aria-checked={currentColour === c} aria-label="Colour {c}" onclick={() => (colour = c)}></button>
      {/each}
      <button class="small glass" role="radio" aria-checked={currentColour === null} onclick={() => (colour = null)}>None</button>
    </div>
  {/if}
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

{#if cropping}
  <PhotoCrop source={cropping} onDone={(url) => { photo = url; cropping = null; }} onCancel={() => { cropping = null; }} />
{/if}

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
  .colours { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
  .colours > span { color: var(--paper-dim); font-size: var(--t-sm); margin-right: 4px; }
  .swatch { width: 40px; height: 40px; border-radius: 50%; background: var(--c); box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.25); }
  .swatch[aria-checked='true'] { box-shadow: 0 0 0 3px var(--paper), inset 0 0 0 1px rgb(0 0 0 / 0.3); }
  label { display: grid; gap: 4px; color: var(--paper-dim); font-size: var(--t-sm); }
  input:not([type=checkbox]) { min-height: var(--touch); padding: 0 12px; border-radius: var(--radius-control); border: 1px solid rgb(255 255 255 / 0.08); color: var(--paper); font-size: var(--t-md); user-select: text; }
  input:focus { outline: none; border-color: rgb(255 255 255 / 0.45); }
  .two { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .check { display: flex; align-items: center; gap: 8px; min-height: var(--touch); }
  .check input { width: 20px; height: 20px; accent-color: var(--paper); }
  .remove { justify-self: start; min-height: 40px; padding: 0 14px; border-radius: var(--radius-pill); color: #ffb3ab; font-size: var(--t-xs); font-weight: 650; }
  .photo { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
  .photo img { width: 72px; height: 72px; object-fit: cover; border-radius: 14px; }
  .photo video { width: 100%; max-height: 220px; object-fit: cover; border-radius: 16px; transform: scaleX(-1); }
  .small { min-height: 40px; padding: 0 14px; border-radius: var(--radius-pill); color: var(--paper); font-size: var(--t-xs); font-weight: 650; }
  .small.danger { color: #ffb3ab; }
  .error { color: var(--stop); }
  .primary, .secondary { min-height: var(--touch); padding: 0 20px; border-radius: var(--radius-control); font-weight: 650; }
  .secondary { color: var(--paper-dim); }
  .primary:disabled { opacity: 0.4; }
</style>
