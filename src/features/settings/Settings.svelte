<script lang="ts">
  import { app } from '../../state/app.svelte';
  import { resolveGateway } from '../../api/config';
  import Stepper from '../../components/Stepper.svelte';
  import { REFILL_MAX_MM, REFILL_MIN_MM } from '../../lib/water';
  import { credentialsPatch } from '../../lib/visualizer';
  import type { SkinUpdateResult } from '../../lib/skinUpdate';

  const gw = resolveGateway();
  const version = __APP_VERSION__;

  // Check for skin updates: Decaid fetches any newer release and installs it;
  // the new version runs after a reload.
  let updating = $state(false);
  let update = $state<SkinUpdateResult | null>(null);
  async function checkUpdates() {
    updating = true;
    update = null;
    try { update = await app.checkSkinUpdates(); } finally { updating = false; }
  }

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

  // Visualizer, through Decaid's bundled plugin. The stored password is never
  // read back: the field stays empty and a blank means "keep what's saved".
  let vizUser = $state('');
  let vizPass = $state('');
  let vizPassSet = $state(false);
  let vizAuto = $state(true);
  let vizLoaded = $state(false);
  let vizBusy = $state(false);
  let vizOnline = $state<boolean | null>(null);
  let vizResult = $state<{ ok: boolean; text: string } | null>(null);

  async function loadViz() {
    await app.loadVisualizer();
    if (app.visualizer === 'missing') { vizLoaded = true; return; }
    try {
      const s = await app.visualizerSettings();
      vizUser = s.username;
      vizPassSet = s.passwordSet;
      vizAuto = s.autoUpload;
    } catch { /* shown as not set up */ }
    vizLoaded = true;
    void checkViz();
  }
  async function checkViz() {
    vizOnline = null;
    if (app.visualizer !== 'on') return;
    vizOnline = await app.visualizerCall('status').then(() => true, () => false);
  }
  $effect(() => { void loadViz(); });

  async function toggleViz() {
    vizBusy = true;
    vizResult = null;
    try {
      await app.setVisualizerEnabled(app.visualizer !== 'on');
      await checkViz();
    } catch (e) {
      vizResult = { ok: false, text: `Couldn't change it: ${(e as Error).message}` };
    } finally {
      vizBusy = false;
    }
  }
  async function toggleAuto() {
    const next = !vizAuto;
    vizAuto = next;
    try { await app.saveVisualizerSettings({ AutoUpload: next }); } catch (e) {
      vizAuto = !next;
      vizResult = { ok: false, text: `Couldn't save: ${(e as Error).message}` };
    }
  }
  async function saveViz(e: Event) {
    e.preventDefault();
    vizBusy = true;
    vizResult = null;
    const typed = vizPass;
    try {
      const s = await app.saveVisualizerSettings(credentialsPatch(vizUser, typed));
      vizPassSet = s.passwordSet;
      vizPass = '';
      if (app.visualizer === 'on' && typed !== '') {
        const r = await app.visualizerCall<{ valid?: boolean }>('verifyCredentials', { username: vizUser.trim(), password: typed });
        vizResult = r.valid ? { ok: true, text: 'Signed in to Visualizer.' } : { ok: false, text: 'Visualizer didn’t accept that username and password.' };
      } else {
        vizResult = { ok: true, text: 'Saved.' };
      }
    } catch (err) {
      vizResult = { ok: false, text: `Couldn't save: ${(err as Error).message}` };
    } finally {
      vizBusy = false;
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
    <h2>Theme options</h2>
    <div class="row">
      <button class="button glass toggle theme-toggle" class:lit={app.halloween} role="switch" aria-checked={app.halloween} onclick={() => app.setHalloween(!app.halloween)}>
        Halloween screensaver <b>{app.halloween ? 'On' : 'Off'}</b>
      </button>
      <button class="button glass" disabled={!app.screensaverImage} onclick={() => (app.screensaverPreview = true)}>Preview</button>
    </div>
    <p class="small">Ghosts drift over your screensaver photo instead of the clock.{app.screensaverImage ? '' : ' Choose a screensaver image first.'}</p>
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
    <h2>Visualizer</h2>
    {#if !vizLoaded}
      <p class="small">Checking…</p>
    {:else if app.visualizer === 'missing'}
      <p>Decaid's Visualizer plugin isn't installed on this tablet. Install it from Decaid's own settings, then come back.</p>
    {:else}
      <p>Decaid uploads each shot to visualizer.coffee for you once this is on and you're signed in.</p>
      <div class="row">
        <button class="button glass" class:lit={app.visualizer === 'on'} role="switch" aria-checked={app.visualizer === 'on'} disabled={vizBusy} onclick={toggleViz}>
          {app.visualizer === 'on' ? 'Plugin on' : 'Plugin off'}
        </button>
        <span class="status" class:ok={vizOnline === true} class:bad={vizOnline === false}>
          {app.visualizer !== 'on' ? 'Not running' : vizOnline === null ? 'Checking…' : vizOnline ? 'Running' : 'Not answering'}
        </span>
      </div>
      <form class="creds" onsubmit={saveViz}>
        <label>Username<input class="well" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" bind:value={vizUser} /></label>
        <label>Password<input class="well" type="password" autocomplete="off" placeholder={vizPassSet ? 'Saved' : ''} bind:value={vizPass} /></label>
        <button class="button glass solid" type="submit" disabled={vizBusy || vizUser.trim() === ''}>{vizBusy ? 'Working…' : vizPass !== '' ? 'Save and sign in' : 'Save'}</button>
      </form>
      <button class="button glass toggle" class:lit={vizAuto} role="switch" aria-checked={vizAuto} onclick={toggleAuto}>
        Upload shots automatically <b>{vizAuto ? 'On' : 'Off'}</b>
      </button>
      {#if vizResult}<p class={vizResult.ok ? 'okmsg' : 'error'} role="status">{vizResult.text}</p>{/if}
      {#if app.visualizer === 'on' && !vizPassSet}<p class="small">Add your Visualizer username and password to start uploading.</p>{/if}
    {/if}
  </section>

  <section class="glass">
    <h2>Connection</h2>
    <dl>
      <dt>Decaid</dt><dd>{app.mock ? 'Demo data (no machine)' : gw.httpBase}</dd>
      <dt>Machine</dt><dd>{app.machineDevice ? `${app.machineDevice.name}, ${app.machineDevice.state}` : 'Not found'}</dd>
      <dt>Scale</dt><dd>{app.scaleDevice ? `${app.scaleDevice.name}, ${app.scaleDevice.state}` : 'Not found'}</dd>
      <dt>Skin version</dt><dd>{version}</dd>
    </dl>
    <button class="button glass" disabled={updating} onclick={checkUpdates}>{updating ? 'Checking…' : 'Check for skin updates'}</button>
    {#if update?.kind === 'updated'}
      <p class="okmsg" role="status">Version {update.installed} is installed.</p>
      <button class="button glass solid" onclick={() => location.reload()}>Reload to use it</button>
    {:else if update?.kind === 'current'}
      <p class="okmsg" role="status">You're on the latest version ({update.installed}).</p>
    {:else if update?.kind === 'failed'}
      <p class="error" role="alert">{update.message}</p>
    {/if}
  </section>
</div>

<style>
  .page { height: 100%; overflow-y: auto; padding: var(--gutter); display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 400px), 1fr)); gap: 16px; align-content: start; align-items: start; }
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
  .okmsg { color: var(--go); }
  .row { align-items: center; }
  .status { color: var(--paper-faint); font-size: var(--t-sm); }
  .status.ok { color: var(--go); }
  .status.bad { color: var(--stop); }
  .creds { display: grid; grid-template-columns: 1fr 1fr; gap: 9px; align-items: end; }
  .creds label { display: grid; gap: 4px; color: var(--paper-dim); font-size: var(--t-sm); }
  .creds input { min-height: var(--touch); padding: 0 12px; border-radius: var(--radius-control); color: var(--paper); font-size: var(--t-md); width: 100%; min-width: 0; }
  .creds .button { grid-column: 1 / -1; }
  .toggle { display: flex; justify-content: space-between; width: 100%; justify-self: stretch; }
  .theme-toggle { width: auto; flex: 1 1 260px; gap: 12px; }
  .toggle b { color: var(--paper-dim); }
  .toggle.lit b { color: var(--ink); }
  dl { display: grid; grid-template-columns: max-content 1fr; gap: 8px 18px; margin: 0; }
  dt { color: var(--paper-dim); }
  dd { margin: 0; }
</style>
