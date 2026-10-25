<script lang="ts">
  import { app } from '../../state/app.svelte';
  import { resolveGateway } from '../../api/config';

  const gw = resolveGateway();
  const version = __APP_VERSION__;

  // Decaid's bundled settings plugin covers machine, scale and app settings,
  // so we hand off to it rather than rebuilding them.
  const decaidSettings = `${gw.httpBase}/api/v1/plugins/settings.reaplugin/ui?backName=FlimsyDecaid`;

  // Screensaver photo. A plain file input (no capture) opens the tablet's
  // own file picker, so any photo saved on the tablet can be used.
  let picker: HTMLInputElement;
  let saverBusy = $state<'saving' | 'removing' | null>(null);
  let saverError = $state<string | null>(null);

  async function onPick(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    saverBusy = 'saving';
    saverError = null;
    try {
      await app.setScreensaver(file);
    } catch (err) {
      saverError = `Couldn't use that image: ${(err as Error).message}`;
    } finally {
      saverBusy = null;
    }
  }

  async function removeSaver() {
    saverBusy = 'removing';
    saverError = null;
    try {
      await app.removeScreensaver();
    } catch (err) {
      saverError = `Couldn't remove it: ${(err as Error).message}`;
    } finally {
      saverBusy = null;
    }
  }
</script>

<div class="page">
  <section class="glass">
    <h2>Machine and app settings</h2>
    <p>Decaid's own settings screen handles the machine, scale, and app.</p>
    <a class="button glass solid" href={decaidSettings}>Open Decaid settings</a>
  </section>

  <section class="glass">
    <h2>Screensaver</h2>
    <p>Shown while the machine is asleep, with a clock floating over it. Tap it to wake the machine.</p>
    {#if app.screensaverImage}
      <img class="saver-preview" src={app.screensaverImage} alt="Your screensaver" />
    {/if}
    <div class="row">
      <button class="button glass solid" disabled={saverBusy !== null} onclick={() => picker.click()}>
        {saverBusy === 'saving' ? 'Saving…' : app.screensaverImage ? 'Choose another image' : 'Choose an image'}
      </button>
      {#if app.screensaverImage}
        <button class="button glass" disabled={saverBusy !== null} onclick={() => (app.screensaverPreview = true)}>Preview</button>
        <button class="button glass" disabled={saverBusy !== null} onclick={removeSaver}>{saverBusy === 'removing' ? 'Removing…' : 'Remove'}</button>
      {/if}
    </div>
    {#if !app.screensaverImage}<p class="small">Until you choose one, the screen turns off when the machine sleeps, as usual.</p>{/if}
    {#if saverError}<p class="error" role="alert">{saverError}</p>{/if}
    <input bind:this={picker} class="sr-only" type="file" accept="image/*" onchange={onPick} tabindex="-1" aria-hidden="true" />
  </section>

  <section class="glass">
    <h2>Connection</h2>
    <dl>
      <dt>Decaid</dt><dd>{app.mock ? 'Demo data (no machine)' : gw.httpBase}</dd>
      <dt>Machine</dt><dd>{app.machineDevice ? `${app.machineDevice.name}, ${app.machineDevice.state}` : 'Not found'}</dd>
      <dt>Scale</dt><dd>{app.scaleDevice ? `${app.scaleDevice.name}, ${app.scaleDevice.state}` : 'Not found'}</dd>
      <dt>Skin version</dt><dd>{version}</dd>
    </dl>
  </section>
</div>

<style>
  .page { height: 100%; overflow-y: auto; padding: var(--gutter); display: grid; gap: 28px; align-content: start; max-width: 760px; }
  section { display: grid; gap: 12px; padding: 26px 28px; border-radius: 32px; }
  h2 { font-size: var(--t-lg); font-weight: 700; }
  p { color: var(--paper-dim); }
  .button {
    justify-self: start;
    display: inline-flex; align-items: center;
    min-height: var(--touch); padding: 0 26px;
    border-radius: var(--radius-control);
    font-weight: 650; text-decoration: none;
  }
  .row { display: flex; flex-wrap: wrap; gap: 12px; }
  .row .button { justify-self: auto; }
  .button:not(.solid) { color: var(--paper); }
  .button:disabled { opacity: 0.5; }
  .saver-preview { width: 100%; max-width: 360px; aspect-ratio: 16 / 10; object-fit: cover; border-radius: 22px; box-shadow: var(--glass-shadow); }
  .small { font-size: var(--t-xs); }
  .error { color: var(--stop); }
  dl { display: grid; grid-template-columns: max-content 1fr; gap: 10px 24px; margin: 0; }
  dt { color: var(--paper-dim); }
  dd { margin: 0; }
</style>
