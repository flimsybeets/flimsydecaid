// A pretend Decaid for designing without a machine (?mock=1, or the dev
// server with no gateway configured). Everything lives in memory and resets
// on reload. Start a shot to see the live graph; the simulated shot follows
// the selected profile's steps loosely.

import type { Gateway, Subscriptions } from './gateway';
import type {
  Bean, BeanBatch, DevicesState, MachineSnapshot, MachineState, MachineSubstate,
  Profile, ProfileRecord, ProfileStep, Workflow, WorkflowPatch,
} from './types';

const now = () => new Date().toISOString();
const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();

function step(name: string, pump: 'pressure' | 'flow', value: number, seconds: number, temperature: number, transition: 'fast' | 'smooth' = 'fast'): ProfileStep {
  return {
    name, pump, transition, seconds, temperature, volume: 0, sensor: 'coffee',
    ...(pump === 'pressure' ? { pressure: value } : { flow: value }),
  };
}

function profile(title: string, steps: ProfileStep[], targetWeight: number): Profile {
  return { title, author: 'Mock', notes: '', beverage_type: 'espresso', steps, target_weight: targetWeight, target_volume_count_start: 0, tank_temperature: 0 };
}

function record(id: string, p: Profile, parentId: string | null = null): ProfileRecord {
  return { id, profile: p, parentId, visibility: 'visible', isDefault: false, createdAt: daysAgo(30), updatedAt: daysAgo(parentId ? 2 : 30) };
}

const PROFILES: ProfileRecord[] = [
  record('profile:mock-classic', profile('Classic Italian', [step('preinfusion', 'flow', 4, 8, 93), step('rise', 'pressure', 9, 4, 93, 'smooth'), step('hold', 'pressure', 9, 25, 93)], 36)),
  record('profile:mock-blooming', profile('Blooming Espresso', [step('fill', 'flow', 4, 6, 94), step('bloom', 'flow', 0, 30, 94), step('extract', 'pressure', 6, 30, 92, 'smooth')], 40)),
  record('profile:mock-turbo', profile('Turbo Shot', [step('fill', 'flow', 8, 4, 92), step('pour', 'flow', 4.5, 15, 92)], 50)),
  record('profile:mock-londinium', profile('Londinium', [step('fill', 'flow', 6, 6, 90), step('soak', 'pressure', 3, 8, 90), step('lever', 'pressure', 9, 4, 90, 'smooth'), step('decline', 'pressure', 5, 30, 90, 'smooth')], 40)),
  record('profile:mock-allonge', profile('Allongé', [step('fill', 'flow', 8, 4, 95), step('pour', 'flow', 4.5, 40, 95)], 120)),
  record('profile:mock-filter', profile('Filter 2.1', [step('fill', 'flow', 8, 5, 95), step('bloom', 'flow', 0, 25, 95), step('pour', 'flow', 3, 120, 95)], 220)),
  record('profile:mock-gentle', profile('Gentle & Sweet', [step('fill', 'flow', 3, 10, 88), step('pour', 'pressure', 6, 30, 88, 'smooth')], 36)),
  record('profile:mock-adaptive', profile('Adaptive v2', [step('fill', 'flow', 6, 6, 94), step('pressurise', 'pressure', 8.5, 6, 94), step('flow', 'flow', 2, 30, 94)], 42)),
];
// An edited version of Classic Italian, to exercise lineage handling.
PROFILES.push(record('profile:mock-classic-v2', profile('Classic Italian', [step('preinfusion', 'flow', 4, 10, 93), step('rise', 'pressure', 9, 4, 93, 'smooth'), step('hold', 'pressure', 8.5, 25, 93)], 36), 'profile:mock-classic'));

const BEANS: Bean[] = [
  { id: 'bean-1', roaster: 'Proud Mary', name: 'Ethiopia Hambela', country: 'Ethiopia', processing: 'washed', decaf: false, archived: false, createdAt: daysAgo(40), updatedAt: daysAgo(40), notes: 'Peach, jasmine, black tea' },
  { id: 'bean-2', roaster: 'Market Lane', name: 'Seasonal Espresso', decaf: false, archived: false, createdAt: daysAgo(60), updatedAt: daysAgo(60), notes: 'Chocolate, red fruit' },
  { id: 'bean-3', roaster: 'Single O', name: 'Killbean Decaf', decaf: true, archived: false, createdAt: daysAgo(20), updatedAt: daysAgo(20) },
];

const BATCHES: BeanBatch[] = [
  { id: 'batch-1a', beanId: 'bean-1', roastDate: daysAgo(35), weight: 250, weightRemaining: 0, frozen: false, archived: true, createdAt: daysAgo(34), updatedAt: daysAgo(14),
    extras: { flimsydecaid: { dialIn: { 'profile:mock-blooming': { grind: '11', dose: 18, yield: 45, tempOffset: 1, updatedAt: daysAgo(15) } } } } },
  { id: 'batch-1b', beanId: 'bean-1', roastDate: daysAgo(9), weight: 250, weightRemaining: 180, frozen: false, archived: false, createdAt: daysAgo(8), updatedAt: daysAgo(1) },
  { id: 'batch-2a', beanId: 'bean-2', roastDate: daysAgo(12), weight: 1000, weightRemaining: 640, frozen: false, archived: false, createdAt: daysAgo(11), updatedAt: daysAgo(1),
    extras: { flimsydecaid: { dialIn: { 'profile:mock-classic': { grind: '14', dose: 18, yield: 36, tempOffset: 0, updatedAt: daysAgo(2) } } } } },
  { id: 'batch-3a', beanId: 'bean-3', roastDate: daysAgo(6), weight: 250, weightRemaining: 230, frozen: false, archived: false, createdAt: daysAgo(5), updatedAt: daysAgo(5) },
];

const STORE = new Map<string, unknown>([
  ['categories', {
    version: 1,
    categories: [
      { id: 'cat-everyday', name: 'Everyday', icon: '☕', colour: 1, profiles: ['profile:mock-classic', 'profile:mock-adaptive', 'profile:mock-gentle'] },
      { id: 'cat-light', name: 'Light roasts', icon: '🌸', colour: 2, profiles: ['profile:mock-blooming', 'profile:mock-turbo', 'profile:mock-allonge'] },
      { id: 'cat-lever', name: 'Lever style', icon: '🔧', colour: 3, profiles: ['profile:mock-londinium'] },
      { id: 'cat-long', name: 'Long & filter', icon: '🫖', colour: 4, profiles: ['profile:mock-filter', 'profile:mock-allonge'] },
    ],
  }],
]);

// JSON round-trip rather than structuredClone: values passed in from the UI
// can be Svelte state proxies, which structuredClone refuses.
function clone<T>(v: T): T {
  return v === undefined ? v : (JSON.parse(JSON.stringify(v)) as T);
}

function deepMerge<T>(target: T, patch: unknown): T {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return patch as T;
  const out: Record<string, unknown> = { ...(target as Record<string, unknown>) };
  for (const [k, v] of Object.entries(patch)) {
    out[k] = k === 'profile' ? v : deepMerge(out[k], v);
  }
  return out as T;
}

export function createMockGateway(): Gateway {
  const profiles = clone(PROFILES);
  const beans = clone(BEANS);
  const batches = clone(BATCHES);
  const store = new Map([...STORE].map(([k, v]) => [k, clone(v)]));

  let workflow: Workflow = {
    name: 'Mock workflow',
    profile: clone(profiles[0]!.profile),
    context: { targetDoseWeight: 18, targetYield: 36, grinderSetting: '14' },
    steamSettings: { targetTemperature: 150, duration: 60, flow: 1.2 },
  };

  // Simulated machine.
  let state: MachineState = 'idle';
  let substate: MachineSubstate = 'idle';
  let mix = 91.5;
  let group = 92.4;
  let steam = 148;
  let weight = 0.0;
  let scaleConnected = true;
  let shotT = 0;
  let pressure = 0;
  let flow = 0;
  let subs: Subscriptions | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;

  const devices = (): DevicesState => ({
    timestamp: now(),
    scanning: false,
    devices: [
      { id: 'mock-de1', name: 'MockDe1', type: 'machine', state: 'connected', available: true },
      { id: 'mock-scale', name: 'MockScale', type: 'scale', state: scaleConnected ? 'connected' : 'disconnected', available: true },
    ],
  });

  const tick = () => {
    const p = workflow.profile;
    const steamOn = (workflow.steamSettings?.targetTemperature ?? 0) >= 135;
    const steamTarget = steamOn ? workflow.steamSettings!.targetTemperature : 20;
    steam += (steamTarget - steam) * 0.02;

    let frame = 0;
    let targetPressure = 0;
    let targetFlow = 0;
    let targetTemp = p?.steps[0]?.temperature ?? 93;

    if (state === 'espresso' && p) {
      shotT += 0.1;
      let acc = 0;
      frame = p.steps.length - 1;
      for (let i = 0; i < p.steps.length; i++) {
        acc += p.steps[i]!.seconds;
        if (shotT < acc) { frame = i; break; }
      }
      const s = p.steps[frame]!;
      targetTemp = s.temperature;
      if (s.pump === 'pressure') targetPressure = s.pressure ?? 9;
      else targetFlow = s.flow ?? 2;

      substate = shotT < 0.6 ? 'preparingForShot' : frame === 0 ? 'preinfusion' : 'pouring';
      const wantP = targetPressure || Math.min(9, flow * 2.2 + shotT * 0.05);
      pressure += (wantP - pressure) * 0.25 + (Math.random() - 0.5) * 0.08;
      const wantF = targetFlow || Math.max(0.2, 2.6 - pressure * 0.12 + shotT * 0.02);
      flow += (wantF - flow) * 0.2 + (Math.random() - 0.5) * 0.05;
      if (shotT > 6) weight += Math.max(0, flow * 0.1 * 0.85);
      // Water temp swings as the heater chases flow; the group lags behind it.
      mix += (targetTemp - mix) * 0.3 + (flow > 3 ? -0.15 : 0.05) + (Math.random() - 0.5) * 0.2;
      group += (mix - group) * 0.04;

      const yieldTarget = workflow.context?.targetYield ?? p.target_weight ?? 36;
      if ((yieldTarget > 0 && weight >= yieldTarget) || frame === p.steps.length - 1 && shotT >= p.steps.reduce((a, b) => a + b.seconds, 0)) {
        substate = 'pouringDone';
        state = 'idle';
        setTimeout(() => { if (state === 'idle') substate = 'idle'; }, 300);
      }
    } else {
      pressure *= 0.7;
      flow *= 0.7;
      mix += (targetTemp - 1.5 - mix) * 0.01;
      group += (targetTemp - group) * 0.01;
    }

    const snapshot: MachineSnapshot = {
      timestamp: now(),
      state: { state, substate },
      pressure: Math.max(0, pressure),
      flow: Math.max(0, flow),
      targetPressure,
      targetFlow,
      mixTemperature: mix,
      groupTemperature: group,
      targetMixTemperature: targetTemp,
      targetGroupTemperature: targetTemp,
      steamTemperature: steam,
      profileFrame: frame,
    };
    subs?.onMachine(snapshot);
    if (scaleConnected) subs?.onScale({ timestamp: now(), weight: Math.round(weight * 10) / 10, weightFlow: state === 'espresso' ? flow * 0.85 : 0, battery: 82, timerValue: null });
  };

  const delay = (ms = 120) => new Promise((r) => setTimeout(r, ms));

  return {
    mock: true,

    subscribe(s) {
      subs = s;
      s.onSocketStatus('machine', 'open');
      s.onSocketStatus('scale', 'open');
      s.onSocketStatus('devices', 'open');
      s.onDevices(devices());
      s.onScale({ status: 'connected' });
      timer = setInterval(tick, 100);
      return () => { if (timer) clearInterval(timer); subs = null; };
    },

    scanDevices() {
      scaleConnected = true;
      subs?.onScale({ status: 'connected' });
      subs?.onDevices(devices());
    },

    async requestState(next) {
      await delay();
      if (next === 'espresso') { shotT = 0; weight = 0; pressure = 0; flow = 0; }
      state = next;
      substate = next === 'espresso' ? 'preparingForShot' : 'idle';
    },
    async tareScale() { await delay(); weight = 0; },

    async getProfiles() { await delay(); return clone(profiles); },
    async getWorkflow() { await delay(); return clone(workflow); },
    async updateWorkflow(patch: WorkflowPatch) {
      await delay();
      workflow = deepMerge(workflow, clone(patch));
      return clone(workflow);
    },

    async getBeans() { await delay(); return clone(beans); },
    async createBean(b) {
      await delay();
      const bean: Bean = { decaf: false, archived: false, ...b, id: `bean-${crypto.randomUUID()}`, createdAt: now(), updatedAt: now() };
      beans.push(bean);
      return clone(bean);
    },
    async updateBean(id, patch) {
      await delay();
      const i = beans.findIndex((b) => b.id === id);
      if (i < 0) throw new Error('Bean not found');
      beans[i] = { ...beans[i]!, ...patch, updatedAt: now() };
      return clone(beans[i]!);
    },
    async getBatches() { await delay(); return clone(batches); },
    async createBatch(beanId, b) {
      await delay();
      const batch: BeanBatch = { frozen: false, archived: false, ...b, weightRemaining: b.weightRemaining ?? b.weight ?? null, beanId, id: `batch-${crypto.randomUUID()}`, createdAt: now(), updatedAt: now() };
      batches.push(batch);
      return clone(batch);
    },
    async updateBatch(id, patch) {
      await delay();
      const i = batches.findIndex((b) => b.id === id);
      if (i < 0) throw new Error('Batch not found');
      batches[i] = { ...batches[i]!, ...patch, updatedAt: now() };
      return clone(batches[i]!);
    },

    async storeGet<T>(key: string) { await delay(40); return (store.has(key) ? clone(store.get(key)) : null) as T | null; },
    async storeSet(key, value) { await delay(40); store.set(key, clone(value)); },
    async storeDelete(key) { await delay(40); store.delete(key); },
  };
}
