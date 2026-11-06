<script lang="ts">
  import PhotoCrop from '../../components/PhotoCrop.svelte';
  import { dataUrlBlob, frameBlob, openFrontCamera, stopStream } from '../../lib/photo';

  // A step's own picture: Take photo (live front camera, else the system
  // camera), Upload photo, Crop photo, Remove photo. Same pipeline as the
  // coffee photo (PhotoCrop, then a ~900px JPEG). Nothing is saved here:
  // the editor gets the new data URL (or null to remove) and saves it with
  // the steps.

  let { shown, onChange }: { shown: string | null; onChange: (url: string | null) => void } = $props();

  let cropping = $state<Blob | null>(null);
  let stream = $state<MediaStream | null>(null);
  let video = $state<HTMLVideoElement>();
  let fileInput: HTMLInputElement;
  let cameraInput: HTMLInputElement;
  let note = $state<string | null>(null);

  $effect(() => {
    if (video && stream) {
      video.srcObject = stream;
      void video.play().catch(() => {});
    }
  });
  $effect(() => () => stopStream(stream));

  async function take() {
    note = null;
    const s = await openFrontCamera();
    if (s) { stream = s; return; }
    cameraInput.click(); // no live camera here: the system capture picker
  }
  async function snap() {
    if (!video) return;
    try { cropping = await frameBlob(video); } catch { note = "That photo couldn't be taken. Try again."; return; }
    stopStream(stream);
    stream = null;
  }
  function onFile(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { note = "That photo couldn't be read. Try another."; return; }
    cropping = file;
  }
  async function cropExisting() {
    if (!shown) return;
    try { cropping = await dataUrlBlob(shown); } catch { note = "That photo couldn't be read."; }
  }
</script>

<div class="photo">
  {#if stream}
    <!-- svelte-ignore a11y_media_has_caption -->
    <video bind:this={video} playsinline muted></video>
    <button class="small glass solid" onclick={snap}>Take photo</button>
    <button class="small glass" onclick={() => { stopStream(stream); stream = null; }}>Cancel</button>
  {:else}
    {#if shown}<img src={shown} alt="Step" />{/if}
    <button class="small glass" onclick={take}>Take photo</button>
    <button class="small glass" onclick={() => fileInput.click()}>Upload photo</button>
    {#if shown}<button class="small glass" onclick={cropExisting}>Crop photo</button>{/if}
    {#if shown}<button class="small glass danger" onclick={() => onChange(null)}>Remove photo</button>{/if}
  {/if}
  <input bind:this={fileInput} class="sr-only" type="file" accept="image/*" onchange={onFile} tabindex="-1" aria-hidden="true" />
  <input bind:this={cameraInput} class="sr-only" type="file" accept="image/*" capture="user" onchange={onFile} tabindex="-1" aria-hidden="true" />
  {#if note}<p class="error">{note}</p>{/if}
</div>

{#if cropping}
  <PhotoCrop source={cropping} onDone={(url) => { onChange(url); cropping = null; }} onCancel={() => { cropping = null; }} />
{/if}

<style>
  .photo { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
  .photo img { width: 72px; height: 72px; object-fit: cover; border-radius: 14px; }
  .photo video { width: 100%; max-height: 180px; object-fit: cover; border-radius: 16px; transform: scaleX(-1); }
  .small { min-height: 40px; padding: 0 14px; border-radius: var(--radius-pill); color: var(--paper); font-size: var(--t-xs); font-weight: 650; }
  .small.danger { color: #ffb3ab; }
  .error { color: var(--stop); width: 100%; }
</style>
