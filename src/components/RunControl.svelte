<script lang="ts">
  import { app } from '../state/app.svelte';

  // Start / Stop for flush, steam and hot water, inside their bottom-bar
  // dialogs. A machine with a group head controller only starts these from
  // the group head (its firmware ignores a start from the tablet), so it gets
  // no Start; Stop shows on every machine while one runs.

  let { kind, label, blocked = null, detail = null, beforeStart, onStarted }: {
    kind: 'flush' | 'steam' | 'hotWater';
    /** "Start flush", "Start steam", "Start hot water". */
    label: string;
    /** What will run, beside the Start button. */
    detail?: string | null;
    /** Why it can't start now (e.g. the steam heater is off), or null. */
    blocked?: string | null;
    /** Save the dialog's draft first, so it runs with what's on screen. */
    beforeStart?: () => Promise<void>;
    onStarted?: () => void;
  } = $props();

  const ms = $derived(app.machine.state?.state);
  const running = $derived(ms === kind);
  // Only from a resting state: not mid-shot, asleep or empty.
  const ready = $derived(ms === 'idle' || ms === 'heating' || ms === 'preheating');
  let busy = $state(false);
  let error = $state<string | null>(null);

  async function start() {
    busy = true;
    error = null;
    try {
      await beforeStart?.();
      await app.startActivity(kind);
      onStarted?.();
    } catch (e) {
      error = `Couldn't start: ${(e as Error).message}`;
    } finally {
      busy = false;
    }
  }
  async function stop() {
    busy = true;
    try { await app.stop(); } catch (e) { error = `Couldn't stop: ${(e as Error).message}`; } finally { busy = false; }
  }
  const why = $derived(
    !app.machineConnected && !app.mock ? 'Connect the machine first.'
    : ms === 'sleeping' ? 'Wake the machine first.'
    : ms === 'needsWater' ? 'Fill the water tank first.'
    : !ready ? 'Wait until the machine is ready.'
    : blocked,
  );
</script>

<!-- A GHC machine starts these from the group head; nothing to show then unless it's running. -->
{#if running || !app.ghc}
  <div class="run">
    {#if running}
      <button class="go stop" disabled={busy} onclick={stop}>
        <span class="dot"></span>{busy ? 'Stopping…' : 'Stop'}
      </button>
    {:else}
      <button class="go" disabled={busy || !!why} onclick={start}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" /></svg>{busy ? 'Starting…' : label}
      </button>
      {#if why}<p class="note">{why}</p>{:else if detail}<p class="note">{detail}</p>{/if}
    {/if}
    {#if error}<p class="error" role="alert">{error}</p>{/if}
  </div>
{/if}

<style>
  .run { display: grid; gap: 8px; }
  /* The one loud thing in the dialog: big, mint, friendly (the same green as Start shot in the guide). */
  .go {
    display: flex; align-items: center; justify-content: center; gap: 10px;
    width: 100%; min-height: 68px; border-radius: 22px;
    font-size: var(--t-lg); font-weight: 800; color: var(--cat-ink);
    background: linear-gradient(165deg, #b9f0dd, var(--go));
    box-shadow: 0 14px 30px -14px rgb(143 211 192 / 0.8), inset 0 1px 0 rgb(255 255 255 / 0.8);
  }
  .go:active { transform: scale(0.98); }
  .go:disabled { opacity: 0.45; box-shadow: none; }
  .go svg { width: 22px; height: 22px; fill: currentColor; }
  .go.stop { color: #fff; background: linear-gradient(165deg, #ff9a8c, var(--stop)); box-shadow: 0 14px 30px -14px rgb(255 120 100 / 0.8), inset 0 1px 0 rgb(255 255 255 / 0.5); }
  .dot { width: 10px; height: 10px; border-radius: 50%; background: #fff; animation: pulse 1.2s ease-in-out infinite; }
  @keyframes pulse { 50% { opacity: 0.3; } }
  @media (prefers-reduced-motion: reduce) { .dot { animation: none; } .go:active { transform: none; } }
  .note { color: var(--paper-dim); font-size: var(--t-sm); text-align: center; }
  .error { color: var(--stop); font-size: var(--t-sm); text-align: center; }
</style>
