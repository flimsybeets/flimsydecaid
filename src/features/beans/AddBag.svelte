<script lang="ts">
  import { app } from '../../state/app.svelte';
  import Modal from '../../components/Modal.svelte';
  import Stepper from '../../components/Stepper.svelte';
  import { openRearCamera, stopStream, toJpegDataUrl } from '../../lib/photo';

  let { onClose }: { onClose: () => void } = $props();

  // Bean: an existing one, or a new roaster + name.
  let beanId = $state<string | 'new'>(app.beans.find((b) => !b.archived)?.id ?? 'new');
  let roaster = $state('');
  let name = $state('');
  let roastDate = $state(new Date().toISOString().slice(0, 10));
  let weight = $state<number | undefined>(250);

  // Photo
  let photo = $state<string | null>(null);
  let stream = $state<MediaStream | null>(null);
  let video = $state<HTMLVideoElement>();
  let fileInput: HTMLInputElement;
  let cameraNote = $state<string | null>(null);

  let saving = $state(false);
  let error = $state<string | null>(null);

  const canSave = $derived(!saving && (beanId !== 'new' || (roaster.trim() && name.trim())));

  $effect(() => {
    if (video && stream) {
      video.srcObject = stream;
      void video.play().catch(() => {});
    }
  });
  $effect(() => () => stopStream(stream));

  async function takePhoto() {
    cameraNote = null;
    const s = await openRearCamera();
    if (s) { stream = s; return; }
    // Live camera unavailable (dev server, consent denied, iOS picker).
    // Fall back to the system capture/file picker.
    fileInput.click();
  }

  async function snap() {
    if (!video) return;
    photo = await toJpegDataUrl(video);
    stopStream(stream);
    stream = null;
  }

  async function onFile(e: Event) {
    const file = (e.currentTarget as HTMLInputElement).files?.[0];
    if (!file) return;
    try { photo = await toJpegDataUrl(file); }
    catch { cameraNote = "That photo couldn't be read. Try another."; }
  }

  async function save() {
    saving = true;
    error = null;
    try {
      const bag = await app.addBag(
        beanId === 'new' ? { roaster: roaster.trim(), name: name.trim() } : beanId,
        {
          roastDate: roastDate ? new Date(`${roastDate}T12:00:00`).toISOString() : null,
          weight: weight ?? null,
          openDate: new Date().toISOString(),
        },
      );
      if (photo) await app.savePhoto(bag.id, photo);
      onClose();
    } catch (e) {
      error = `The bag wasn't added: ${(e as Error).message}`;
    } finally {
      saving = false;
    }
  }
</script>

<Modal title="Add a bag" {onClose}>
  <div class="photo">
    {#if stream}
      <!-- svelte-ignore a11y_media_has_caption -->
      <video bind:this={video} playsinline muted></video>
      <button class="snap glass solid" onclick={snap}>Take photo</button>
    {:else if photo}
      <img src={photo} alt="The bag" />
      <button class="retake glass" onclick={takePhoto}>Retake</button>
    {:else}
      <button class="camera glass" onclick={takePhoto}>
        <span class="lens" aria-hidden="true"></span>
        Photograph the bag
      </button>
    {/if}
    <input bind:this={fileInput} class="sr-only" type="file" accept="image/*" capture="environment" onchange={onFile} tabindex="-1" aria-hidden="true" />
    {#if cameraNote}<p class="note">{cameraNote}</p>{/if}
  </div>

  <label>
    <span>Coffee</span>
    <select bind:value={beanId}>
      {#each app.beans.filter((b) => !b.archived) as b (b.id)}
        <option value={b.id}>{b.roaster} {b.name}</option>
      {/each}
      <option value="new">A new coffee…</option>
    </select>
  </label>

  {#if beanId === 'new'}
    <div class="two">
      <label><span>Roaster</span><input bind:value={roaster} placeholder="e.g. Proud Mary" /></label>
      <label><span>Coffee name</span><input bind:value={name} placeholder="e.g. Ethiopia Hambela" /></label>
    </div>
  {/if}

  <div class="two">
    <label><span>Roast date</span><input type="date" bind:value={roastDate} /></label>
    <Stepper label="Bag weight" bind:value={weight} min={50} max={5000} step={50} unit="g" />
  </div>

  {#if error}<p class="error" role="alert">{error}</p>{/if}

  {#snippet actions()}
    <button class="secondary glass" onclick={onClose}>Cancel</button>
    <button class="primary glass solid" disabled={!canSave} onclick={save}>{saving ? 'Adding…' : 'Add bag'}</button>
  {/snippet}
</Modal>

<style>
  .photo { display: grid; gap: 10px; justify-items: start; }
  .camera {
    display: flex; align-items: center; gap: 16px;
    width: 100%;
    min-height: 120px;
    padding: 0 24px;
    border-radius: 24px;
    color: var(--paper-dim);
    font-size: var(--t-md);
  }
  .lens { width: 44px; height: 34px; border: 3px solid currentColor; border-radius: 9px; position: relative; }
  .lens::after { content: ''; position: absolute; inset: 7px 12px; border: 3px solid currentColor; border-radius: 50%; }
  video, img { width: 100%; max-height: 320px; object-fit: cover; border-radius: 22px; background: var(--well); box-shadow: var(--glass-shadow); }
  .snap, .retake { min-height: var(--touch); padding: 0 26px; border-radius: var(--radius-pill); font-weight: 650; }
  .note { color: var(--warn); font-size: var(--t-xs); }

  label { display: grid; gap: 6px; color: var(--paper-dim); font-size: var(--t-sm); }
  input, select {
    min-height: var(--touch);
    padding: 0 16px;
    border-radius: var(--radius-control);
    border: 1px solid rgb(255 255 255 / 0.08);
    background: var(--well);
    box-shadow: var(--well-shadow);
    color: var(--paper);
    font-size: var(--t-md);
    user-select: text;
  }
  input:focus, select:focus { border-color: var(--paper); outline: none; }
  .two { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; align-items: end; }

  .error { color: var(--stop); }
  .primary, .secondary { min-height: var(--touch); padding: 0 28px; border-radius: var(--radius-control); font-weight: 650; }
  .primary:disabled { opacity: 0.4; }
  .secondary { color: var(--paper-dim); }
  select { font-family: inherit; }
</style>
