<script lang="ts">
  import { app } from '../../state/app.svelte';
  import { resolveGateway } from '../../api/config';
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
</script>

    <section class="card glass frost">
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
