<script lang="ts">
  import { app, type Tab } from './state/app.svelte';
  import BottomBar from './components/BottomBar.svelte';
  import SteamModal from './components/SteamModal.svelte';
  import ShotView from './components/ShotView.svelte';
  import Screensaver from './components/Screensaver.svelte';
  import ProfileEditor from './features/profiles/ProfileEditor.svelte';
  import Guide from './features/guide/Guide.svelte';
  import Home from './features/home/Home.svelte';
  import Profiles from './features/profiles/Profiles.svelte';
  import History from './features/history/History.svelte';
  import Beans from './features/beans/Beans.svelte';
  import Settings from './features/settings/Settings.svelte';

  const tabs: { id: Tab; label: string }[] = [
    { id: 'home', label: 'Home' },
    { id: 'profiles', label: 'Profiles' },
    { id: 'history', label: 'History' },
    { id: 'beans', label: 'Beans' },
    { id: 'settings', label: 'Settings' },
  ];

  let steamOpen = $state(false);
  // The shot view takes over while pulling and stays until dismissed,
  // so you can read the finished graph.
  let shotOpen = $state(false);
  $effect(() => { if (app.shotActive) shotOpen = true; });

  // Screensaver: up while the machine sleeps, once a photo is chosen.
  // Tapping asks the machine to wake. If it stays asleep (say the wake
  // didn't get through), the screensaver comes back after a minute.
  let saverDismissed = $state(false);
  $effect(() => { if (!app.asleep) saverDismissed = false; });
  $effect(() => {
    if (!saverDismissed) return;
    const t = setTimeout(() => (saverDismissed = false), 60_000);
    return () => clearTimeout(t);
  });
  const saverUp = $derived(app.asleep && app.screensaverImage !== null && !saverDismissed);

  function dismissSaver() {
    saverDismissed = true;
    void app.wake().catch(() => {});
  }

  const STATE_LABELS: Record<string, string> = {
    idle: 'Ready', sleeping: 'Asleep', heating: 'Heating', preheating: 'Heating', booting: 'Starting up',
    espresso: 'Pulling', steam: 'Steaming', hotWater: 'Hot water', flush: 'Flushing',
    needsWater: 'Refill the tank', error: 'Machine error', cleaning: 'Cleaning', descaling: 'Descaling',
  };

  const status = $derived.by(() => {
    if (app.mock) return { text: 'Demo data', tone: 'demo' };
    if (!app.gatewayOnline) return { text: "Can't reach Decaid", tone: 'bad' };
    if (!app.machineConnected) return { text: 'Machine not connected', tone: 'bad' };
    const s = app.machine.state?.state ?? 'idle';
    return { text: STATE_LABELS[s] ?? s, tone: s === 'needsWater' || s === 'error' ? 'bad' : s === 'heating' || s === 'preheating' ? 'warm' : 'ok' };
  });
</script>

<div class="shell">
  <header>
    <nav class="glass" aria-label="Sections">
      {#each tabs as t (t.id)}
        <button class="tab" class:active={app.tab === t.id} aria-current={app.tab === t.id ? 'page' : undefined} onclick={() => (app.tab = t.id)}>
          {t.label}
        </button>
      {/each}
    </nav>
    <div class="status glass {status.tone}" role="status">
      <span class="dot" aria-hidden="true"></span>
      {status.text}
      {#if app.machine.groupTemperature !== undefined}
        <span class="temp">{app.machine.groupTemperature.toFixed(1)}°</span>
      {/if}
    </div>
  </header>

  <main>
    {#if app.error && !app.loaded}
      <div class="problem">
        <p>{app.error}</p>
        <p class="hint">Check that Decaid is running and on the same Wi-Fi. During development, open this page with <code>?gateway=&lt;tablet IP&gt;</code> or <code>?mock=1</code>.</p>
        <button class="retry glass solid" onclick={() => app.reload()}>Try again</button>
      </div>
    {:else if app.tab === 'home'}
      <Home />
    {:else if app.tab === 'profiles'}
      <Profiles />
    {:else if app.tab === 'history'}
      <History />
    {:else if app.tab === 'beans'}
      <Beans />
    {:else}
      <Settings />
    {/if}
  </main>

  <BottomBar onSteam={() => (steamOpen = true)} />
</div>

{#if steamOpen}
  <SteamModal onClose={() => (steamOpen = false)} />
{/if}

{#if app.guiding && app.guide}
  <Guide onclose={() => (app.guiding = false)} />
{/if}

{#if app.editing !== undefined}
  <ProfileEditor record={app.editing} onclose={() => (app.editing = undefined)} />
{/if}

{#if shotOpen}
  <ShotView onClose={() => (shotOpen = false)} />
{/if}

{#if app.screensaverPreview}
  <Screensaver image={app.screensaverImage} preview onDismiss={() => (app.screensaverPreview = false)} />
{:else if saverUp}
  <Screensaver image={app.screensaverImage} onDismiss={dismissSaver} />
{/if}

<style>
  .shell {
    display: grid;
    grid-template-rows: auto 1fr auto;
    height: 100%;
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--gutter);
    padding: 10px var(--gutter) 8px;
    position: relative;
    z-index: 5;
  }

  /* Floating glass tab bar; the active tab is a lens of brighter glass. */
  nav {
    display: flex;
    gap: 3px;
    padding: 4px;
    border-radius: var(--radius-pill);
  }

  .tab {
    min-height: 42px;
    padding: 0 18px;
    border-radius: var(--radius-pill);
    font-size: var(--t-md);
    font-weight: 500;
    color: var(--paper-dim);
    transition: background 180ms ease, color 180ms ease, box-shadow 180ms ease;
  }
  .tab.active {
    background: linear-gradient(170deg, rgb(255 255 255 / 0.95), rgb(226 236 232 / 0.86));
    color: var(--ink);
    font-weight: 650;
    box-shadow: 0 4px 12px -6px rgb(0 0 0 / 0.5), inset 0 1px 0 #fff;
  }

  .status {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 42px;
    padding: 0 15px;
    border-radius: var(--radius-pill);
    font-size: var(--t-sm);
    color: var(--paper-dim);
    white-space: nowrap;
  }
  .dot { width: 9px; height: 9px; border-radius: 50%; color: var(--go); background: currentColor; box-shadow: 0 0 8px currentColor; }
  .status.warm .dot { color: var(--warn); }
  .status.bad .dot { color: var(--stop); }
  .status.demo .dot { color: var(--cat-3); }
  .temp { color: var(--paper); font-weight: 600; }

  main {
    min-height: 0;
    overflow: hidden;
    position: relative;
  }

  .problem {
    max-width: 480px;
    margin: 12vh auto 0;
    padding: 0 var(--gutter);
    display: grid;
    gap: 12px;
    font-size: var(--t-md);
  }
  .hint { color: var(--paper-dim); font-size: var(--t-sm); }
  code { font-size: 0.9em; color: var(--paper); }
  .retry {
    justify-self: start;
    min-height: var(--touch);
    padding: 0 21px;
    border-radius: var(--radius-control);
    font-weight: 650;
  }

  @media (max-width: 900px) {
    .tab { padding: 0 10px; font-size: var(--t-sm); }
    .status .temp { display: none; }
  }
</style>
