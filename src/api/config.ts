// Where is Decaid?
//
// Installed on the tablet, the skin is served by Decaid itself, so the gateway
// is the page's own hostname on :8080.
//
// During development the page comes from your laptop's dev server:
//   ?gateway=192.168.1.50   talk to Decaid on the tablet (remembered)
//   ?gateway=localhost      talk to Decaid running on this laptop
//   ?gateway=               forget the remembered gateway
//   ?mock=1                 simulated machine, scale and data; no Decaid needed
// With no gateway configured, the dev server defaults to mock mode.

const GATEWAY_KEY = 'flimsydecaid.gateway';

function safeGet(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function safeSet(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch { /* storage unavailable: fine, just not remembered */ }
}

export interface GatewayConfig {
  mock: boolean;
  /** e.g. "http://192.168.1.50:8080" */
  httpBase: string;
  /** e.g. "ws://192.168.1.50:8080" */
  wsBase: string;
}

export function resolveGateway(location: Location = window.location): GatewayConfig {
  const params = new URLSearchParams(location.search);

  const fromQuery = params.get('gateway');
  if (fromQuery !== null) safeSet(GATEWAY_KEY, fromQuery || null);

  // reaHostname is the shared override used by Streamline.js and other skins.
  const configured =
    fromQuery || safeGet(GATEWAY_KEY) || safeGet('reaHostname') || import.meta.env.VITE_GATEWAY || '';

  const mock =
    params.get('mock') === '1' ||
    (import.meta.env.DEV && params.get('mock') !== '0' && !configured);

  const host = configured || location.hostname || 'localhost';
  const bare = host.replace(/^\w+:\/\//, '').replace(/\/+$/, '');
  const withPort = /:\d+$/.test(bare) ? bare : `${bare}:8080`;
  return { mock, httpBase: `http://${withPort}`, wsBase: `ws://${withPort}` };
}
