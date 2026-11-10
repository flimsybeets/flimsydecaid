<script lang="ts">
  import { app } from '../../state/app.svelte';
  import LookPane from './LookPane.svelte';
  import ScreensaverPane from './ScreensaverPane.svelte';
  import MachinePane from './MachinePane.svelte';
  import ShotsPane from './ShotsPane.svelte';
  import SleepPane from './SleepPane.svelte';
  import TabletPane from './TabletPane.svelte';
  import VisualizerPane from './VisualizerPane.svelte';
  import AdvancedPane from './AdvancedPane.svelte';
  import AboutPane from './AboutPane.svelte';

  // Settings: tabs down the side, one pane at a time. The skin's own options
  // (look, screensaver, Visualizer) and Decaid's settings for the machine, the
  // scale, sleep and the tablet, in plain words. Each pane writes its changes
  // to Decaid a moment after the last touch.
  const TABS = [
    { id: 'look', label: 'Look', icon: 'M12 3a9 9 0 1 0 0 18c1 0 1.6-.8 1.6-1.6 0-1-.8-1.4-.8-2.4 0-.9.7-1.6 1.6-1.6H17a4 4 0 0 0 4-4c0-4.6-4-8.4-9-8.4zM7.5 12a1.3 1.3 0 1 1 0-.1zM10 7.8a1.3 1.3 0 1 1 0-.1zM14.5 7.8a1.3 1.3 0 1 1 0-.1z' },
    { id: 'screensaver', label: 'Screensaver', icon: 'M4 5h16v11H4zM9 20h6M12 16v4M8 12l3-3 2 2 3-3' },
    { id: 'machine', label: 'Machine', icon: 'M5 4h14v6H5zM7 10v4h10v-4M9 14v2h6v-2M8 20h8M10 7h4' },
    { id: 'shots', label: 'Shots & scale', icon: 'M4 16h16v3H4zM7 16l1-6h8l1 6M10 10V7h4v3' },
    { id: 'sleep', label: 'Sleep & wake', icon: 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z' },
    { id: 'tablet', label: 'Tablet', icon: 'M6 3h12v18H6zM11 18h2M9 9h6v5H9z' },
    { id: 'visualizer', label: 'Visualizer', icon: 'M4 18l5-7 4 4 7-10M15 5h5v5' },
    { id: 'advanced', label: 'Advanced', icon: 'M4 7h10M18 7h2M4 17h4M12 17h8M14 5v4M8 15v4' },
    { id: 'about', label: 'About', icon: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v6M12 7.5v.5' },
  ] as const;
  type TabId = (typeof TABS)[number]['id'];
  const current = $derived<TabId>((TABS.some((t) => t.id === app.settingsTab) ? app.settingsTab : 'look') as TabId);
  let content = $state<HTMLDivElement>();
  function go(id: TabId) {
    app.settingsTab = id;
    content?.scrollTo({ top: 0 });
  }
</script>

<div class="settings">
  <nav class="rail glass frost" aria-label="Settings sections">
    {#each TABS as t (t.id)}
      <button class="tab" class:on={current === t.id} aria-current={current === t.id ? 'page' : undefined} onclick={() => go(t.id)}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d={t.icon} /></svg>
        <span>{t.label}</span>
      </button>
    {/each}
  </nav>
  <div class="content" bind:this={content}>
    <h1>{TABS.find((t) => t.id === current)?.label}</h1>
    {#key current}
      <div class="pane">
        {#if current === 'look'}<LookPane />
        {:else if current === 'screensaver'}<ScreensaverPane />
        {:else if current === 'machine'}<MachinePane />
        {:else if current === 'shots'}<ShotsPane />
        {:else if current === 'sleep'}<SleepPane />
        {:else if current === 'tablet'}<TabletPane />
        {:else if current === 'visualizer'}<VisualizerPane />
        {:else if current === 'advanced'}<AdvancedPane />
        {:else}<AboutPane />{/if}
      </div>
    {/key}
  </div>
</div>

<style>
  .settings {
    height: 100%;
    display: grid;
    grid-template-columns: 186px minmax(0, 1fr);
    gap: 14px;
    padding: var(--gutter);
    min-height: 0;
  }
  .rail {
    display: grid; align-content: start; gap: 3px;
    padding: 6px; border-radius: 22px;
    overflow-y: auto; min-height: 0;
  }
  .tab {
    display: flex; align-items: center; gap: 10px;
    min-height: 40px; padding: 0 12px; border-radius: 14px;
    color: var(--paper-dim); font-weight: 650; text-align: left;
    transition: background 150ms ease, color 150ms ease;
  }
  .tab svg { width: 20px; height: 20px; flex: none; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
  .tab.on { background: var(--paper); color: var(--ink); }
  .content { position: relative; overflow-y: auto; min-height: 0; padding-right: 4px; display: grid; align-content: start; gap: 12px; }
  h1 { font-size: var(--t-xl, 28px); font-weight: 750; padding: 2px 4px 0; }
  .pane { display: grid; gap: 14px; align-content: start; }

  /* Shared look for every pane's cards and controls. */
  .pane :global(.pane-head) { position: absolute; top: 14px; right: 10px; pointer-events: none; }
  .pane :global(.card) { display: grid; gap: 12px; padding: 18px 20px; border-radius: 24px; }
  .pane :global(.card h2) { font-size: var(--t-lg); font-weight: 700; }
  .pane :global(.card p) { color: var(--paper-dim); }
  .pane :global(.small) { font-size: var(--t-xs); }
  .pane :global(.note) { color: var(--warn); }
  .pane :global(.error) { color: var(--stop); }
  .pane :global(.okmsg) { color: var(--go); }
  .pane :global(.grid) { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 12px; }
  .pane :global(.row) { display: flex; flex-wrap: wrap; gap: 9px; align-items: center; }
  .pane :global(.button) {
    justify-self: start; display: inline-flex; align-items: center;
    min-height: var(--touch); padding: 0 20px; border-radius: var(--radius-control);
    font-weight: 650; text-decoration: none;
  }
  .pane :global(.button:not(.solid)) { color: var(--paper); }
  .pane :global(.button:disabled) { opacity: 0.5; }
  .pane :global(.field) { display: grid; gap: 6px; justify-items: start; }
  .pane :global(.field .label) { color: var(--paper-dim); font-size: var(--t-sm); }
  .pane :global(.slider) { display: grid; gap: 6px; }
  .pane :global(.slider-head) { display: flex; justify-content: space-between; font-weight: 600; }
  .pane :global(.slider-head b) { font-variant-numeric: tabular-nums; }
  .pane :global(.slider input) { width: 100%; min-height: var(--touch); accent-color: var(--paper); }
  .pane :global(.ends) { display: flex; justify-content: space-between; margin-top: -6px; }
  .pane :global(.saver-preview) { width: 100%; max-width: 270px; aspect-ratio: 16 / 10; object-fit: cover; border-radius: 16px; box-shadow: var(--glass-shadow); }
  .pane :global(.times) { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; }
  .pane :global(.times label) { display: grid; gap: 6px; color: var(--paper-dim); font-size: var(--t-sm); }
  .pane :global(.times input) { min-height: var(--touch); padding: 0 12px; border-radius: var(--radius-control); color: var(--paper); font-size: var(--t-lg); color-scheme: dark; }
  /* Visualizer */
  .pane :global(.status) { color: var(--paper-faint); font-size: var(--t-sm); }
  .pane :global(.status.ok) { color: var(--go); }
  .pane :global(.status.bad) { color: var(--stop); }
  .pane :global(.creds) { display: grid; grid-template-columns: 1fr 1fr; gap: 9px; align-items: end; }
  .pane :global(.creds label) { display: grid; gap: 4px; color: var(--paper-dim); font-size: var(--t-sm); }
  .pane :global(.creds input) { min-height: var(--touch); padding: 0 12px; border-radius: var(--radius-control); color: var(--paper); font-size: var(--t-md); width: 100%; min-width: 0; }
  .pane :global(.creds .button) { grid-column: 1 / -1; }
  /* About */
  .pane :global(dl) { display: grid; grid-template-columns: max-content 1fr; gap: 8px 18px; margin: 0; }
  .pane :global(dt) { color: var(--paper-dim); }
  .pane :global(dd) { margin: 0; overflow-wrap: anywhere; }

  /* Narrow: the tabs become a scrolling row above the pane. */
  @media (max-width: 760px) {
    .settings { grid-template-columns: minmax(0, 1fr); grid-template-rows: auto minmax(0, 1fr); }
    .rail { display: flex; overflow-x: auto; overflow-y: hidden; }
    .tab { flex: none; }
  }
</style>
