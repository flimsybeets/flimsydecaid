// The only module that talks to Decaid. UI and state code call these
// methods and never use fetch or WebSocket directly, so the real gateway
// and the mock (src/api/mock.ts) are interchangeable.

import type { GatewayConfig } from './config';
import { openSocket, type ManagedSocket, type SocketStatus } from './socket';
import type {
  Bean, BeanBatch, DevicesState, DisplayState, MachineInfo, MachineSnapshot, MachineState, PluginInfo, Profile, ProfileRecord,
  ScaleFrame, ShotAnnotations, ShotPage, ShotQuery, ShotRecord, ShotSummary, WaterLevels, Workflow, WorkflowPatch,
} from './types';

/** Our namespace in Decaid's shared key-value store. Not scoped per owner, so keep it unique. */
export const STORE_NS = 'flimsydecaid';

export interface Subscriptions {
  onMachine(frame: MachineSnapshot): void;
  onScale(frame: ScaleFrame): void;
  onDevices(state: DevicesState): void;
  /** Tank level and refill threshold (mm), sent when either changes. */
  onWater(levels: WaterLevels): void;
  onSocketStatus(channel: 'machine' | 'scale' | 'devices', status: SocketStatus): void;
}

export interface Gateway {
  readonly mock: boolean;

  subscribe(subs: Subscriptions): () => void;
  /** Ask Decaid to scan for (and auto-connect) devices. */
  scanDevices(): void;

  getMachineInfo(): Promise<MachineInfo>;
  /** POST /webui/skins/update: Decaid re-fetches installed skins from their sources. */
  checkSkinUpdates(): Promise<void>;
  /** GET /webui/skins/{id}: the version Decaid has installed for a skin, or null. */
  installedSkinVersion(id: string): Promise<string | null>;
  /** POST /machine/waterLevels: the tank level (mm) at which the machine warns to refill. */
  setWaterRefillLevel(mm: number): Promise<void>;
  requestState(state: MachineState): Promise<void>;
  tareScale(): Promise<void>;
  /**
   * Keep the tablet screen on even while the machine sleeps (Decaid normally
   * lets it turn off then). false hands control back to Decaid.
   */
  keepScreenOn(on: boolean): Promise<void>;
  getDisplay(): Promise<DisplayState>;
  /** 0–100; 100 hands brightness back to the OS. */
  setBrightness(brightness: number): Promise<void>;

  getProfiles(): Promise<ProfileRecord[]>;
  /**
   * POST /profiles. Ids hash the steps and targets only; creating one that
   * already exists returns the existing record unchanged.
   */
  createProfile(profile: Profile, parentId: string | null): Promise<ProfileRecord>;
  /** PUT /profiles/{id}: used for title/author/notes only (refused on Decaid's defaults). */
  updateProfile(id: string, profile: Profile): Promise<ProfileRecord>;
  getWorkflow(): Promise<Workflow>;
  /** Deep-merge update; returns the workflow as Decaid stored it. */
  updateWorkflow(patch: WorkflowPatch): Promise<Workflow>;

  getBeans(): Promise<Bean[]>;
  createBean(bean: Partial<Bean> & Pick<Bean, 'roaster' | 'name'>): Promise<Bean>;
  updateBean(id: string, patch: Partial<Bean>): Promise<Bean>;
  getBatches(): Promise<BeanBatch[]>;
  /** One bag, fresh from Decaid (used before read-modify-write of its weight). */
  getBatch(id: string): Promise<BeanBatch>;
  createBatch(beanId: string, batch: Partial<BeanBatch>): Promise<BeanBatch>;
  updateBatch(id: string, patch: Partial<BeanBatch>): Promise<BeanBatch>;
  /** Permanent. Shots keep their coffee name text but lose the link to the bag. */
  deleteBatch(id: string): Promise<void>;

  /** Newest first, without measurements. */
  getShots(query?: ShotQuery): Promise<ShotPage>;
  /** One shot with its measurements. */
  getShot(id: string): Promise<ShotRecord>;
  /** Deep-merged; only the annotation fields sent change. */
  updateShot(id: string, annotations: Partial<ShotAnnotations>): Promise<ShotSummary>;
  deleteShot(id: string): Promise<void>;
  /** hidden: out of lists, reversible in Decaid. (deleted is refused for Decaid's defaults.) */
  setProfileVisibility(id: string, visibility: ProfileRecord['visibility']): Promise<ProfileRecord>;

  /** GET /plugins */
  getPlugins(): Promise<PluginInfo[]>;
  /** GET /plugins/{id}/settings. Secure values come back as { isSet }. */
  getPluginSettings(id: string): Promise<Record<string, unknown>>;
  /** POST /plugins/{id}/settings: omitted fields are kept, null clears. Reloads a loaded plugin. */
  savePluginSettings(id: string, patch: Record<string, unknown>): Promise<Record<string, unknown>>;
  /** POST /plugins/{id}/enable or /disable. */
  setPluginEnabled(id: string, enabled: boolean): Promise<void>;
  /** A plugin's declared HTTP endpoint: GET without a body, POST with one. Throws HttpError on non-2xx. */
  callPlugin<T>(id: string, endpoint: string, body?: unknown): Promise<T>;

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
      const water = openSocket<Partial<WaterLevels>>({
        url: ws('machine/waterLevels'),
        onMessage: (m) => {
          if (typeof m.currentLevel === 'number') subs.onWater({ currentLevel: m.currentLevel, refillLevel: m.refillLevel ?? NaN });
        },
      });
      devicesSocket = devices;
      return () => {
        machine.close(); scale.close(); devices.close(); water.close();
        devicesSocket = null;
      };
    },

    scanDevices() {
      // Connect the remembered scale the moment it's seen, instead of after the
      // whole scan (Decaid's plain scan waits out full discovery first).
      if (!devicesSocket?.send({ command: 'scan', connect: true, connectPreferredScaleEarly: true })) {
        void call('GET', '/devices/scan?connect=true&connectPreferredScaleEarly=true').catch(() => {});
      }
    },

    getMachineInfo: () => call('GET', '/machine/info'),
    checkSkinUpdates: () => call('POST', '/webui/skins/update'),
    async installedSkinVersion(id) {
      const skin = await call<{ version?: string | null } | null>('GET', `/webui/skins/${encodeURIComponent(id)}`);
      return skin?.version ?? null;
    },
    setWaterRefillLevel: (mm) => call('POST', '/machine/waterLevels', { refillLevel: Math.trunc(mm) }),
    requestState: (state) => call('PUT', `/machine/state/${state}`),
    tareScale: () => call('PUT', '/scale/tare'),
    keepScreenOn: (on) => call(on ? 'POST' : 'DELETE', '/display/wakelock'),
    getDisplay: () => call('GET', '/display'),
    setBrightness: (brightness) => call('PUT', '/display/brightness', { brightness: Math.round(brightness) }),

    getProfiles: () => call('GET', '/profiles?visibility=visible'),
    createProfile: (profile, parentId) => call('POST', '/profiles', parentId ? { profile, parentId } : { profile }),
    updateProfile: (id, profile) => call('PUT', `/profiles/${encodeURIComponent(id)}`, { profile }),
    getWorkflow: () => call('GET', '/workflow'),
    updateWorkflow: (patch) => call('PUT', '/workflow', patch),

    // Include archived (finished) beans and bags: dial-in carries over from
    // a finished bag, Beans can show them, and old shots still name them.
    // Decaid leaves them out by default.
    getBeans: () => call('GET', '/beans?includeArchived=true'),
    createBean: (bean) => call('POST', '/beans', bean),
    updateBean: (id, patch) => call('PUT', `/beans/${encodeURIComponent(id)}`, patch),
    getBatches: () => call('GET', '/bean-batches?includeArchived=true'),
    getBatch: (id) => call('GET', `/bean-batches/${encodeURIComponent(id)}`),
    createBatch: (beanId, batch) => call('POST', `/beans/${encodeURIComponent(beanId)}/batches`, batch),
    updateBatch: (id, patch) => call('PUT', `/bean-batches/${encodeURIComponent(id)}`, patch),
    deleteBatch: (id) => call('DELETE', `/bean-batches/${encodeURIComponent(id)}`),

    getShots(query = {}) {
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== '') params.set(k, String(v));
      const qs = params.toString();
      return call('GET', `/shots${qs ? `?${qs}` : ''}`);
    },
    getShot: (id) => call('GET', `/shots/${encodeURIComponent(id)}`),
    updateShot: (id, annotations) => call('PUT', `/shots/${encodeURIComponent(id)}`, { annotations }),
    deleteShot: (id) => call('DELETE', `/shots/${encodeURIComponent(id)}`),
    setProfileVisibility: (id, visibility) => call('PUT', `/profiles/${encodeURIComponent(id)}/visibility`, { visibility }),

    getPlugins: () => call('GET', '/plugins'),
    getPluginSettings: (id) => call('GET', `/plugins/${encodeURIComponent(id)}/settings`),
    savePluginSettings: (id, patch) => call('POST', `/plugins/${encodeURIComponent(id)}/settings`, patch),
    async setPluginEnabled(id, enabled) {
      await call('POST', `/plugins/${encodeURIComponent(id)}/${enabled ? 'enable' : 'disable'}`);
    },
    callPlugin: (id, endpoint, body) => call(body === undefined ? 'GET' : 'POST', `/plugins/${encodeURIComponent(id)}/${encodeURIComponent(endpoint)}`, body),

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
