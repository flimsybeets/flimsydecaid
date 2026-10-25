// The only module that talks to Decaid. UI and state code call these
// methods and never use fetch or WebSocket directly, so the real gateway
// and the mock (src/api/mock.ts) are interchangeable.

import type { GatewayConfig } from './config';
import { openSocket, type ManagedSocket, type SocketStatus } from './socket';
import type {
  Bean, BeanBatch, DevicesState, MachineSnapshot, MachineState, ProfileRecord,
  ScaleFrame, ShotPage, ShotQuery, ShotRecord, Workflow, WorkflowPatch,
} from './types';

/** Our namespace in Decaid's shared key-value store. Not scoped per owner, so keep it unique. */
export const STORE_NS = 'flimsydecaid';

export interface Subscriptions {
  onMachine(frame: MachineSnapshot): void;
  onScale(frame: ScaleFrame): void;
  onDevices(state: DevicesState): void;
  onSocketStatus(channel: 'machine' | 'scale' | 'devices', status: SocketStatus): void;
}

export interface Gateway {
  readonly mock: boolean;

  subscribe(subs: Subscriptions): () => void;
  /** Ask Decaid to scan for (and auto-connect) devices. */
  scanDevices(): void;

  requestState(state: MachineState): Promise<void>;
  tareScale(): Promise<void>;
  /**
   * Keep the tablet screen on even while the machine sleeps (Decaid normally
   * lets it turn off then). false hands control back to Decaid.
   */
  keepScreenOn(on: boolean): Promise<void>;

  getProfiles(): Promise<ProfileRecord[]>;
  getWorkflow(): Promise<Workflow>;
  /** Deep-merge update; returns the workflow as Decaid stored it. */
  updateWorkflow(patch: WorkflowPatch): Promise<Workflow>;

  getBeans(): Promise<Bean[]>;
  createBean(bean: Partial<Bean> & Pick<Bean, 'roaster' | 'name'>): Promise<Bean>;
  updateBean(id: string, patch: Partial<Bean>): Promise<Bean>;
  getBatches(): Promise<BeanBatch[]>;
  createBatch(beanId: string, batch: Partial<BeanBatch>): Promise<BeanBatch>;
  updateBatch(id: string, patch: Partial<BeanBatch>): Promise<BeanBatch>;

  /** Newest first, without measurements. */
  getShots(query?: ShotQuery): Promise<ShotPage>;
  /** One shot with its measurements. */
  getShot(id: string): Promise<ShotRecord>;

  storeGet<T>(key: string): Promise<T | null>;
  storeSet(key: string, value: unknown): Promise<void>;
  storeDelete(key: string): Promise<void>;
}

export class HttpError extends Error {
  constructor(public status: number, public body: string, path: string) {
    super(`${status} from ${path}${body ? `: ${body.slice(0, 200)}` : ''}`);
  }
}

export function createHttpGateway(config: GatewayConfig): Gateway {
  const base = `${config.httpBase}/api/v1`;

  async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(base + path, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) throw new HttpError(res.status, text, path);
    return (text ? JSON.parse(text) : undefined) as T;
  }

  let devicesSocket: ManagedSocket | null = null;

  return {
    mock: false,

    subscribe(subs) {
      const ws = (path: string) => `${config.wsBase}/ws/v1/${path}`;
      const machine = openSocket<MachineSnapshot>({
        url: ws('machine/snapshot'),
        onMessage: subs.onMachine,
        onStatus: (s) => subs.onSocketStatus('machine', s),
      });
      const scale = openSocket<ScaleFrame>({
        url: ws('scale/snapshot'),
        onMessage: subs.onScale,
        onStatus: (s) => subs.onSocketStatus('scale', s),
      });
      const devices = openSocket<DevicesState | { command?: string }>({
        url: ws('devices'),
        onMessage: (m) => { if ('devices' in m) subs.onDevices(m as DevicesState); },
        onStatus: (s) => subs.onSocketStatus('devices', s),
      });
      devicesSocket = devices;
      return () => {
        machine.close(); scale.close(); devices.close();
        devicesSocket = null;
      };
    },

    scanDevices() {
      if (!devicesSocket?.send({ command: 'scan' })) {
        void call('GET', '/devices/scan').catch(() => {});
      }
    },

    requestState: (state) => call('PUT', `/machine/state/${state}`),
    tareScale: () => call('PUT', '/scale/tare'),
    keepScreenOn: (on) => call(on ? 'POST' : 'DELETE', '/display/wakelock'),

    getProfiles: () => call('GET', '/profiles?visibility=visible'),
    getWorkflow: () => call('GET', '/workflow'),
    updateWorkflow: (patch) => call('PUT', '/workflow', patch),

    getBeans: () => call('GET', '/beans'),
    createBean: (bean) => call('POST', '/beans', bean),
    updateBean: (id, patch) => call('PUT', `/beans/${encodeURIComponent(id)}`, patch),
    getBatches: () => call('GET', '/bean-batches'),
    createBatch: (beanId, batch) => call('POST', `/beans/${encodeURIComponent(beanId)}/batches`, batch),
    updateBatch: (id, patch) => call('PUT', `/bean-batches/${encodeURIComponent(id)}`, patch),

    getShots(query = {}) {
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== '') params.set(k, String(v));
      const qs = params.toString();
      return call('GET', `/shots${qs ? `?${qs}` : ''}`);
    },
    getShot: (id) => call('GET', `/shots/${encodeURIComponent(id)}`),

    async storeGet<T>(key: string) {
      try {
        return await call<T>('GET', `/store/${STORE_NS}/${encodeURIComponent(key)}`);
      } catch (e) {
        if (e instanceof HttpError && e.status === 404) return null;
        throw e;
      }
    },
    storeSet: (key, value) => call('POST', `/store/${STORE_NS}/${encodeURIComponent(key)}`, value),
    storeDelete: (key) => call('DELETE', `/store/${STORE_NS}/${encodeURIComponent(key)}`),
  };
}
