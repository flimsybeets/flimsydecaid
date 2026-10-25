<script lang="ts">
  import { app } from '../../state/app.svelte';
  import { resolveGateway } from '../../api/config';

  const gw = resolveGateway();
  const version = __APP_VERSION__;

  // Decaid's bundled settings plugin covers machine, scale and app settings,
  // so we hand off to it rather than rebuilding them.
  const decaidSettings = `${gw.httpBase}/api/v1/plugins/settings.reaplugin/ui?backName=FlimsyDecaid`;
</script>

<div class="page">
  <section>
    <h2>Machine and app settings</h2>
    <p>Decaid's own settings screen handles the machine, scale, and app.</p>
    <a class="button" href={decaidSettings}>Open Decaid settings</a>
  </section>

  <section>
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
  section { display: grid; gap: 10px; }
  h2 { font-size: var(--t-lg); font-weight: 700; }
  p { color: var(--paper-dim); }
  .button {
    justify-self: start;
    display: inline-flex; align-items: center;
    min-height: var(--touch); padding: 0 26px;
    border-radius: var(--radius-control);
    background: var(--paper); color: var(--ink);
    font-weight: 650; text-decoration: none;
  }
  dl { display: grid; grid-template-columns: max-content 1fr; gap: 10px 24px; margin: 0; }
  dt { color: var(--paper-dim); }
  dd { margin: 0; }
</style>
