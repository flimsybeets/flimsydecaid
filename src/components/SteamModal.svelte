<script lang="ts">
  import { app } from '../state/app.svelte';
  import Modal from './Modal.svelte';
  import Stepper from './Stepper.svelte';
  import { heaterOn, STEAM_DEFAULT_C, STEAM_FLOW_MAX, STEAM_FLOW_MIN, STEAM_MAX_C, STEAM_MIN_C } from '../lib/steam';

  let { onClose }: { onClose: () => void } = $props();

  // Edit a draft; nothing reaches the machine until Save.
  const initial = app.steam;
  let on = $state(heaterOn(initial));
  let temperature = $state<number | undefined>(heaterOn(initial) ? initial!.targetTemperature : STEAM_DEFAULT_C);
  let flow = $state<number | undefined>(initial?.flow ?? 1.2);
  let saving = $state(false);
  let error = $state<string | null>(null);

  const presets = [140, 150, 158];

  async function save() {
    saving = true;
    error = null;
    try {
      await app.setSteam({ on, temperature: on ? temperature : undefined, flow });
      onClose();
    } catch (e) {
      error = `Steam settings weren't saved: ${(e as Error).message}`;
    } finally {
      saving = false;
    }
  }
</script>

<Modal title="Steam" {onClose}>
  <button class="heater" class:on role="switch" aria-checked={on} onclick={() => (on = !on)}>
    <span>Steam heater</span>
    <span class="state">{on ? 'On' : 'Off'}</span>
  </button>
  {#if app.machine.steamTemperature !== undefined}
    <p class="live">Boiler is at {Math.round(app.machine.steamTemperature)}°C</p>
  {/if}

  <div class="grid">
    <div class="temp">
      <Stepper label="Temperature" bind:value={temperature} min={STEAM_MIN_C} max={STEAM_MAX_C} unit="°C" disabled={!on} />
      <div class="presets">
        {#each presets as p (p)}
          <button class:active={temperature === p} disabled={!on} onclick={() => (temperature = p)}>{p}°</button>
        {/each}
      </div>
    </div>
    <Stepper label="Flow" bind:value={flow} min={STEAM_FLOW_MIN} max={STEAM_FLOW_MAX} step={0.1} decimals={1} unit="ml/s" />
  </div>

  {#if error}<p class="error" role="alert">{error}</p>{/if}

  {#snippet actions()}
    <button class="secondary" onclick={onClose}>Cancel</button>
    <button class="primary" onclick={save} disabled={saving || (!app.mock && !app.gatewayOnline)}>
      {saving ? 'Saving…' : 'Save steam settings'}
    </button>
  {/snippet}
</Modal>

<style>
  .heater {
    display: flex;
    justify-content: space-between;
    align-items: center;
    min-height: 84px;
    padding: 0 24px;
    border-radius: var(--radius-control);
    background: var(--ink-sunk);
    font-size: var(--t-md);
    font-weight: 600;
  }
  .heater .state {
    min-width: 96px;
    padding: 10px 0;
    text-align: center;
    border-radius: var(--radius-pill);
    background: var(--line);
    color: var(--paper-dim);
  }
  .heater.on .state { background: var(--paper); color: var(--ink); }
  .live { color: var(--paper-dim); margin-top: -10px; }

  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; align-items: start; }
  .temp { display: grid; gap: 10px; }
  .presets { display: flex; gap: 8px; }
  .presets button {
    flex: 1;
    min-height: 48px;
    border-radius: var(--radius-pill);
    border: 1px solid var(--line);
    color: var(--paper-dim);
  }
  .presets button.active { background: var(--paper); color: var(--ink); border-color: var(--paper); }
  .presets button:disabled { opacity: 0.4; }

  .error { color: var(--stop); }

  .primary, .secondary {
    min-height: var(--touch);
    padding: 0 28px;
    border-radius: var(--radius-control);
    font-weight: 650;
  }
  .primary { background: var(--paper); color: var(--ink); }
  .primary:disabled { opacity: 0.5; }
  .secondary { color: var(--paper-dim); }

  @media (max-width: 640px) { .grid { grid-template-columns: 1fr; } }
</style>
