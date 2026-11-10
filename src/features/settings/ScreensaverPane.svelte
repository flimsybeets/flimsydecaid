<script lang="ts">
  import { app } from '../../state/app.svelte';
  import Switch from './Switch.svelte';

  // A plain file input (no capture) opens the tablet's own file picker, so
  // any photo saved on the tablet can be used.
  let picker = $state<HTMLInputElement>();
  let busy = $state<'saving' | 'removing' | null>(null);
  let error = $state<string | null>(null);

  async function onPick(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    busy = 'saving';
    error = null;
    try { await app.setScreensaver(file); }
    catch (err) { error = `Couldn't use that image: ${(err as Error).message}`; }
    finally { busy = null; }
  }
  async function remove() {
    busy = 'removing';
    error = null;
    try { await app.removeScreensaver(); }
    catch (err) { error = `Couldn't remove it: ${(err as Error).message}`; }
    finally { busy = null; }
  }
</script>

<section class="card glass frost">
  <h2>Photo</h2>
  <p>Shown while the machine is asleep{app.screensaverClock ? ', with a big clock over it' : ''}. Tap it to wake the machine.</p>
  {#if app.screensaverImage}
    <img class="saver-preview" src={app.screensaverImage} alt="Your screensaver" />
  {/if}
  <div class="row">
    <button class="button glass solid" disabled={busy !== null} onclick={() => picker?.click()}>
      {busy === 'saving' ? 'Saving…' : app.screensaverImage ? 'Choose another image' : 'Choose an image'}
    </button>
    {#if app.screensaverImage}
      <button class="button glass" disabled={busy !== null} onclick={() => (app.screensaverPreview = true)}>Preview</button>
      <button class="button glass" disabled={busy !== null} onclick={remove}>{busy === 'removing' ? 'Removing…' : 'Remove'}</button>
    {/if}
  </div>
  {#if !app.screensaverImage}<p class="small">Until you choose one, the screen turns off when the machine sleeps, as usual.</p>{/if}
  {#if error}<p class="error" role="alert">{error}</p>{/if}
  <input bind:this={picker} class="sr-only" type="file" accept="image/*" onchange={onPick} tabindex="-1" aria-hidden="true" />
</section>

<section class="card glass frost">
  <h2>While it shows</h2>
  <Switch label="Show the clock" on={app.screensaverClock} onchange={(v) => app.setScreensaverClock(v)} />
  <label class="slider">
    <span class="slider-head">Screen brightness <b>{app.screensaverDim}%</b></span>
    <input type="range" min="0" max="100" step="1" value={app.screensaverDim}
      oninput={(e) => app.setScreensaverDim(Number(e.currentTarget.value))} />
    <span class="small">{app.screensaverDim >= 100 ? 'Not dimmed.' : 'Open Preview to see it as you move the slider.'}</span>
  </label>
</section>
