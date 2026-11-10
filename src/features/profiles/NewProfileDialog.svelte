<script lang="ts">
  import Modal from '../../components/Modal.svelte';
  import { app } from '../../state/app.svelte';
  import { importErrorText, profileFromFile, shareCode } from '../../lib/profileImport';
  import type { Profile, ProfileRecord } from '../../api/types';

  // New profile: start from scratch, bring one in from Visualizer with a share
  // code, or open a .json profile file. Scratch and file open the editor on an
  // unsaved draft; Visualizer's plugin saves the profile itself, so the editor
  // opens on the saved record.
  let { onScratch, onDraft, onImported, onClose }: {
    onScratch: () => void;
    onDraft: (profile: Profile) => void;
    onImported: (record: ProfileRecord) => void;
    onClose: () => void;
  } = $props();

  let view = $state<'choose' | 'visualizer'>('choose');
  let code = $state('');
  let busy = $state(false);
  let error = $state<string | null>(null);
  let picker = $state<HTMLInputElement>();

  $effect(() => { void app.loadVisualizer(); });

  const clean = $derived(shareCode(code));
  const vizReady = $derived(app.visualizer === 'on');

  async function importCode() {
    if (!clean || busy) return;
    busy = true;
    error = null;
    try {
      const rec = await app.importFromVisualizer(clean);
      if (!rec) throw new Error('missing shot id');
      onImported(rec);
    } catch (e) {
      error = importErrorText(e);
    } finally {
      busy = false;
    }
  }

  async function onFile(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    error = null;
    if (file.size > 2_000_000) { error = 'That file is too big to be a profile.'; return; }
    const r = profileFromFile(await file.text());
    if (!r.ok) { error = r.error; return; }
    onDraft(r.profile);
  }
</script>

<Modal title={view === 'visualizer' ? 'From Visualizer' : 'New profile'} onClose={() => { if (!busy) onClose(); }}>
  {#if view === 'choose'}
    <div class="choices">
      <button class="choice glass" onclick={onScratch}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
        <span class="name">From scratch</span>
        <span class="say">A simple two-step profile to shape as you like.</span>
      </button>
      <button class="choice glass" onclick={() => { error = null; view = 'visualizer'; }}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 18l5-7 4 4 7-10" /><path d="M15 5h5v5" /></svg>
        <span class="name">From Visualizer</span>
        <span class="say">Type the share code of any shot on visualizer.coffee.</span>
      </button>
      <button class="choice glass" onclick={() => picker?.click()}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4M12 11v6M9 14l3 3 3-3" /></svg>
        <span class="name">From a file</span>
        <span class="say">Open a .json profile saved on the tablet.</span>
      </button>
    </div>
    <input bind:this={picker} class="sr-only" type="file" accept=".json,application/json,text/plain" onchange={onFile} tabindex="-1" aria-hidden="true" />
  {:else}
    <ol class="how">
      <li>On visualizer.coffee, open the shot whose profile you want.</li>
      <li>Tap <b>Share</b> and copy the 4-character code.</li>
      <li>Type it here. The profile is saved and opens in the editor.</li>
    </ol>
    <label class="field">
      <span>Share code</span>
      <input class="well code" type="text" maxlength="9" autocapitalize="characters" autocomplete="off" spellcheck="false"
        placeholder="AB12" bind:value={code} disabled={busy || !vizReady} />
    </label>
    {#if !vizReady}
      <p class="note">Visualizer is {app.visualizer === 'missing' ? 'not installed in Decaid' : 'off'}. Turn it on and sign in under Settings → Visualizer, then come back.</p>
    {/if}
  {/if}
  {#if error}<p class="error" role="alert">{error}</p>{/if}
  {#snippet actions()}
    {#if view === 'visualizer'}
      <button class="secondary glass" disabled={busy} onclick={() => { error = null; view = 'choose'; }}>Back</button>
      <button class="primary glass solid" disabled={busy || !clean || !vizReady} onclick={importCode}>{busy ? 'Importing…' : 'Import profile'}</button>
    {/if}
  {/snippet}
</Modal>

<style>
  .choices { display: grid; gap: 10px; }
  .choice {
    display: grid; grid-template-columns: 40px 1fr; grid-template-rows: auto auto;
    column-gap: 14px; align-items: center; text-align: left;
    min-height: 72px; padding: 12px 16px; border-radius: var(--radius-control);
  }
  .choice svg { grid-row: 1 / 3; width: 32px; height: 32px; fill: none; stroke: var(--paper); stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
  .name { font-weight: 700; font-size: var(--t-md); }
  .say { color: var(--paper-dim); font-size: var(--t-sm); }
  .how { margin: 0; padding-left: 1.3em; color: var(--paper-dim); display: grid; gap: 4px; }
  .how b { color: var(--paper); }
  .field { display: grid; gap: 6px; }
  .field span { color: var(--paper-dim); font-size: var(--t-sm); }
  .code { min-height: var(--touch); padding: 0 14px; font-size: var(--t-lg); letter-spacing: 0.2em; text-transform: uppercase; font-variant-numeric: tabular-nums; }
  .note { color: var(--warn); }
  .error { color: var(--stop); }
  .secondary, .primary { min-height: var(--touch); padding: 0 20px; border-radius: var(--radius-control); font-weight: 650; }
  .secondary { color: var(--paper-dim); }
  .primary:disabled, .secondary:disabled { opacity: 0.45; }
</style>
