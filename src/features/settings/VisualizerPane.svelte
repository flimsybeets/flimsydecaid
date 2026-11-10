<script lang="ts">
  import { app } from '../../state/app.svelte';
  import { credentialsPatch } from '../../lib/visualizer';
  import Switch from './Switch.svelte';

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

</script>

    <section class="card glass frost">
      <h2>Upload your shots</h2>
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
        <Switch label="Upload shots automatically" on={vizAuto} onchange={() => toggleAuto()} />
        {#if vizResult}<p class={vizResult.ok ? 'okmsg' : 'error'} role="status">{vizResult.text}</p>{/if}
        {#if app.visualizer === 'on' && !vizPassSet}<p class="small">Add your Visualizer username and password to start uploading.</p>{/if}
      {/if}
    </section>
