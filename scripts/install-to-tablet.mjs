// Build, package, and install the skin on a tablet running Decaid, over Wi-Fi.
//
//   npm run install:tablet -- 192.168.1.50
//
// Serves the zip from this laptop for a minute and asks Decaid to install it
// from that URL, then makes it the default skin. Works with a private repo:
// nothing goes through GitHub.

import { createServer } from 'node:http';
import { execSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { join } from 'node:path';

const tablet = process.argv[2] || process.env.TABLET;
if (!tablet) {
  console.error('Usage: npm run install:tablet -- <tablet IP>');
  process.exit(1);
}
const gateway = `http://${/:\d+$/.test(tablet) ? tablet : `${tablet}:8080`}`;

execSync('npm run package', { stdio: 'inherit' });

const root = new URL('..', import.meta.url).pathname;
const releaseDir = join(root, 'release');
const zip = readdirSync(releaseDir)
  .filter((f) => f.endsWith('.zip'))
  .map((f) => join(releaseDir, f))
  .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
const manifest = JSON.parse(readFileSync(join(root, 'dist', 'skin-manifest.json'), 'utf8'));

// Pick the laptop address on the same subnet as the tablet.
const tabletHost = tablet.replace(/:\d+$/, '');
const prefix = tabletHost.split('.').slice(0, 3).join('.');
const addresses = Object.values(networkInterfaces()).flat().filter((a) => a && a.family === 'IPv4' && !a.internal);
const laptop = (addresses.find((a) => a.address.startsWith(prefix + '.')) ?? addresses[0])?.address;
if (!laptop) {
  console.error('Could not find this computer\'s network address.');
  process.exit(1);
}

const body = readFileSync(zip);
const server = createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/zip', 'Content-Length': body.length });
  res.end(body);
});

server.listen(0, '0.0.0.0', async () => {
  const { port } = server.address();
  const url = `http://${laptop}:${port}/${manifest.id}.zip`;
  const timeout = setTimeout(() => { console.error('Timed out.'); process.exit(1); }, 60_000);
  try {
    console.log(`Asking ${gateway} to install ${url}`);
    await send('POST', '/api/v1/webui/skins/install/url', { url });
    await send('PUT', '/api/v1/webui/skins/default', { skinId: manifest.id });
    console.log(`Installed ${manifest.name} ${manifest.version} and set it as the default skin.`);
  } catch (e) {
    console.error(String(e.message || e));
    process.exitCode = 1;
  } finally {
    clearTimeout(timeout);
    server.close();
  }
});

async function send(method, path, json) {
  const res = await fetch(gateway + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(json),
  });
  if (!res.ok) throw new Error(`${path} failed: ${res.status} ${await res.text()}`);
}
