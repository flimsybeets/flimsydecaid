<script lang="ts">
  import { app } from '../../state/app.svelte';
  import { resolveGateway } from '../../api/config';
  import Stepper from '../../components/Stepper.svelte';
  import { REFILL_MAX_MM, REFILL_MIN_MM } from '../../lib/water';

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
    <label class="slider">
      <span class="slider-head">Screen brightness while asleep <b>{app.screensaverDim}%</b></span>
      <input type="range" min="0" max="100" step="1" value={app.screensaverDim}
        oninput={(e) => app.setScreensaverDim(Number(e.currentTarget.value))} />
      <span class="small">{app.screensaverDim >= 100 ? 'Not dimmed.' : 'Open Preview to see it as you move the slider.'}</span>
    </label>
    <input bind:this={picker} class="sr-only" type="file" accept="image/*" onchange={onPick} tabindex="-1" aria-hidden="true" />
  </section>

  <section class="glass">
    <h2>Water level warning</h2>
    <p>The machine warns you to refill when the tank drops to this height.</p>
    <div class="water-row">
      <Stepper compact label="Warn at" unit="mm" min={REFILL_MIN_MM} max={REFILL_MAX_MM} step={1}
        bind:value={() => (app.water && Number.isFinite(app.water.refillLevel) ? app.water.refillLevel : undefined), (v) => { if (v !== undefined) app.setWaterRefill(v); }}
        placeholder="…" disabled={!app.water || !Number.isFinite(app.water.refillLevel)} />
      <p class="small">{app.water && Number.isFinite(app.water.currentLevel) ? `Tank is at ${Math.round(app.water.currentLevel)} mm now.` : 'Waiting for the machine.'}</p>
    </div>
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
  .page { height: 100%; overflow-y: auto; padding: var(--gutter); display: grid; gap: 21px; align-content: start; max-width: 570px; }
  section { display: grid; gap: 9px; padding: 20px 21px; border-radius: 24px; }
  h2 { font-size: var(--t-lg); font-weight: 700; }
  p { color: var(--paper-dim); }
  .button {
    justify-self: start;
    display: inline-flex; align-items: center;
    min-height: var(--touch); padding: 0 20px;
    border-radius: var(--radius-control);
    font-weight: 650; text-decoration: none;
  }
  .row { display: flex; flex-wrap: wrap; gap: 9px; }
  .row .button { justify-self: auto; }
  .button:not(.solid) { color: var(--paper); }
  .button:disabled { opacity: 0.5; }
  .saver-preview { width: 100%; max-width: 270px; aspect-ratio: 16 / 10; object-fit: cover; border-radius: 16px; box-shadow: var(--glass-shadow); }
  .small { font-size: var(--t-xs); }
  .slider { display: grid; gap: 6px; margin-top: 4px; }
  .slider-head { display: flex; justify-content: space-between; font-weight: 600; }
  .slider-head b { font-variant-numeric: tabular-nums; }
  .slider input { width: 100%; min-height: var(--touch); accent-color: var(--paper); }
  .water-row { display: grid; grid-template-columns: minmax(0, 200px) 1fr; gap: 12px; align-items: center; }
  .error { color: var(--stop); }
  dl { display: grid; grid-template-columns: max-content 1fr; gap: 8px 18px; margin: 0; }
  dt { color: var(--paper-dim); }
  dd { margin: 0; }
</style>
