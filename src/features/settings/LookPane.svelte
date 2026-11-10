<script lang="ts">
  import { app } from '../../state/app.svelte';
  import { toneLabel } from '../../lib/background';
  import Segmented from '../../components/Segmented.svelte';
  import Switch from './Switch.svelte';
  import { EDITION } from '../../edition';
  import type { PanelTint } from '../../lib/theme';
  import type { TilePreview } from '../../lib/miniGraph';

  const TINTS: { value: PanelTint; label: string }[] = [
    { value: 'dark', label: 'Dark' }, { value: 'teal', label: 'Teal' }, { value: 'coffee', label: 'Coffee' }, { value: 'plum', label: 'Plum' },
  ];
  const PREVIEWS: { value: TilePreview; label: string }[] = [
    { value: 'shot', label: 'Last shot' }, { value: 'plan', label: 'Plan' }, { value: 'none', label: 'None' },
  ];

  // App background: same picking and shrinking as the screensaver photo.
  let bgPicker = $state<HTMLInputElement>();
  let bgBusy = $state<'saving' | 'removing' | null>(null);
  let bgError = $state<string | null>(null);
  async function onPickBg(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    bgBusy = 'saving';
    bgError = null;
    try { await app.setAppBackground(file); }
    catch (err) { bgError = `Couldn't use that image: ${(err as Error).message}`; }
    finally { bgBusy = null; }
  }
  async function removeBg() {
    bgBusy = 'removing';
    bgError = null;
    try { await app.removeAppBackground(); }
    catch (err) { bgError = `Couldn't remove it: ${(err as Error).message}`; }
    finally { bgBusy = null; }
  }
</script>

<section class="card glass frost">
  <h2>App background</h2>
  <p>A photo behind the whole skin. Darken it so everything stays easy to read.</p>
  <div class="row">
    <button class="button glass solid" disabled={bgBusy !== null} onclick={() => bgPicker?.click()}>
      {bgBusy === 'saving' ? 'Saving…' : app.appBackground ? 'Choose another image' : 'Choose an image'}
    </button>
    {#if app.appBackground}
      <button class="button glass" disabled={bgBusy !== null} onclick={removeBg}>{bgBusy === 'removing' ? 'Removing…' : 'Remove'}</button>
    {/if}
  </div>
  {#if app.appBackground}
    <label class="slider">
      <span class="slider-head">Darken <b>{toneLabel(app.bgTone)}</b></span>
      <input type="range" min="0" max="100" step="1" value={-app.bgTone}
        oninput={(e) => app.setBgTone(-Number(e.currentTarget.value))} />
      <span class="ends small"><span>As is</span><span>Black</span></span>
    </label>
  {/if}
  {#if bgError}<p class="error" role="alert">{bgError}</p>{/if}
  <input bind:this={bgPicker} class="sr-only" type="file" accept="image/*" onchange={onPickBg} tabindex="-1" aria-hidden="true" />
</section>

<section class="card glass frost">
  <h2>Panels and tiles</h2>
  <div class="field">
    <span class="label">Panel colour</span>
    <Segmented label="Panel colour" value={app.panelTint} options={TINTS} onchange={(v) => app.setPanelTint(v)} />
    <p class="small">The frosted glass of the brew panel, dialogs and graphs.</p>
  </div>
  <div class="field">
    <span class="label">Graph on each profile tile</span>
    <Segmented label="Graph on each profile tile" value={app.tilePreview} options={PREVIEWS} onchange={(v) => app.setTilePreview(v)} />
    <p class="small">The same switch sits above the profiles in each category on Home.</p>
  </div>
</section>

{#if EDITION.screensaverExtra}
  <section class="card glass frost">
    <h2>Extras</h2>
    <Switch label={EDITION.screensaverExtra.label} on={app.screensaverArt} onchange={(v) => app.setScreensaverArt(v)}
      note={EDITION.screensaverExtra.note + (app.screensaverImage ? '' : ' Choose a screensaver image first.')} />
    <button class="button glass" disabled={!app.screensaverImage} onclick={() => (app.screensaverPreview = true)}>Preview</button>
  </section>
{/if}
