// A pretend Decaid for designing without a machine (?mock=1, or the dev
// server with no gateway configured). Everything lives in memory and resets
// on reload. Start a shot to see the live graph; the simulated shot follows
// the selected profile's steps loosely.

import type { Gateway, Subscriptions } from './gateway';
import type {
  Bean, BeanBatch, DevicesState, MachineSnapshot, MachineState, MachineSubstate,
  Profile, ProfileRecord, ProfileStep, ShotMeasurement, ShotRecord, ShotSummary, Workflow, WorkflowPatch,
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

/**
 * A believable saved shot: preinfusion at low pressure, a ramp, a slow
 * decline, weight arriving after the first few seconds.
 */
function pastShot(id: string, when: string, p: ProfileRecord, batch: BeanBatch, grind: string, dose: number, yieldTarget: number, enjoyment: number | null, notes: string | null): ShotRecord {
  const bean = BEANS.find((b) => b.id === batch.beanId)!;
  const start = Date.parse(when);
  const temp = p.profile.steps[0]?.temperature ?? 93;
  const measurements: ShotMeasurement[] = [];
  let weight = 0;
  let mix = temp - 0.6;
  let group = temp - 1.2;
  for (let i = 0; weight < yieldTarget && i < 900; i++) {
    const t = i / 10;
    const pre = t < 8;
    const pressure = pre ? Math.min(2.5, t * 0.5) : Math.max(5.5, 9 - Math.max(0, t - 14) * 0.12);
    const flow = pre ? 4 - t * 0.3 : 1.6 + Math.min(1, (t - 8) * 0.05);
    if (t > 6) weight += flow * 0.085;
    mix += (temp - mix) * 0.2 + Math.sin(i / 7) * 0.08;
    group += (mix - group) * 0.03;
    const ts = new Date(start + i * 100).toISOString();
    measurements.push({
      machine: {
        timestamp: ts,
        state: { state: 'espresso', substate: pre ? 'preinfusion' : 'pouring' },
        pressure, flow,
        targetPressure: pre ? 0 : 9, targetFlow: pre ? 4 : 0,
        mixTemperature: mix, groupTemperature: group,
        targetMixTemperature: temp, targetGroupTemperature: temp,
        profileFrame: pre ? 0 : 1,
      },
      scale: { timestamp: ts, weight: Math.round(weight * 10) / 10 },
    });
  }
  return {
    id, timestamp: when, createdAt: when, updatedAt: when,
    workflow: {
      profile: p.profile,
      context: { beanBatchId: batch.id, coffeeName: bean.name, coffeeRoaster: bean.roaster, grinderSetting: grind, targetDoseWeight: dose, targetYield: yieldTarget },
    },
    annotations: { enjoyment, espressoNotes: notes },
    stopReason: 'targetWeight',
    measurements,
  };
}

const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();
const byId = (id: string) => PROFILES.find((p) => p.id === id)!;
const batch = (id: string) => BATCHES.find((b) => b.id === id)!;

const SHOTS: ShotRecord[] = [
  pastShot('shot-6', hoursAgo(2), byId('profile:mock-classic-v2'), batch('batch-2a'), '14', 18, 36, 8, null),
  pastShot('shot-5', hoursAgo(3), byId('profile:mock-classic-v2'), batch('batch-2a'), '13.5', 18, 36, 6, 'A bit sharp, going finer'),
  pastShot('shot-4', hoursAgo(26), byId('profile:mock-blooming'), batch('batch-1b'), '11', 18, 45, 9, 'Peach for days'),
  pastShot('shot-3', hoursAgo(50), byId('profile:mock-gentle'), batch('batch-3a'), '15', 18, 36, null, null),
  pastShot('shot-2', hoursAgo(24 * 9), byId('profile:mock-blooming'), batch('batch-1a'), '11', 18, 45, 7, null),
  pastShot('shot-1', hoursAgo(24 * 16), byId('profile:mock-blooming'), batch('batch-1a'), '12', 18, 45, 5, 'Too fast'),
];

/** Stand-in for Decaid's content hash: everything the machine runs, nothing descriptive. */
function executionId(p: Profile): string {
  const run = JSON.stringify([p.version, p.beverage_type, p.steps, p.tank_temperature, p.target_weight, p.target_volume, p.target_volume_count_start]);
  let h = 2166136261;
  for (let i = 0; i < run.length; i++) h = Math.imul(h ^ run.charCodeAt(i), 16777619);
  return `profile:mock-${(h >>> 0).toString(16)}`;
}

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
  const shots = clone(SHOTS);
  let recording: ShotMeasurement[] | null = null;
  let stopReason: string | null = null;

  /** Save the finished shot the way Decaid does: measurements plus the workflow at the time. */
  const saveShot = () => {
    if (!recording?.length) return;
    const when = recording[0]!.machine.timestamp ?? now();
    shots.unshift({
      id: `shot-${crypto.randomUUID()}`, timestamp: when, createdAt: when, updatedAt: now(),
      workflow: clone({ profile: workflow.profile, context: workflow.context }),
      annotations: vizLoaded && vizSettings.AutoUpload && vizSignedIn() ? { extras: { visualizerId: `viz-${Math.random().toString(36).slice(2, 8)}` } } : null,
      stopReason,
      measurements: recording,
    });
  };

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
  let scanning = false;
  let shotT = 0;
  /** Seconds of warm-up left before an espresso pours (set by pressBrew). */
  let preheat = 0;
  let pressure = 0;
  let flow = 0;
  let subs: Subscriptions | null = null;
  // Visualizer plugin: installed but off at first. Password: anything but "wrong" signs in.
  let vizLoaded = false;
  let vizSettings: { Username: string; Password: string; AutoUpload: boolean } = { Username: '', Password: '', AutoUpload: true };
  const vizRedacted = () => ({ Username: vizSettings.Username, Password: { isSet: vizSettings.Password !== '' }, AutoUpload: vizSettings.AutoUpload });
  const vizSignedIn = () => vizSettings.Username !== '' && vizSettings.Password !== '' && vizSettings.Password !== 'wrong';
  let brightness = 100;
  // Tank: slowly drops (about 1 mm a minute). ?water=<mm> starts it at that level.
  let waterLevel = Number(new URLSearchParams(location.search).get('water') ?? 42);
  let refillLevel = 10;
  let ticks = 0;
  let timer: ReturnType<typeof setInterval> | null = null;

  const devices = (): DevicesState => ({
    timestamp: now(),
    scanning,
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

    if (state === 'espresso' && p && preheat > 0) {
      // Group-head brew button: the machine warms up before it pours.
      preheat -= 0.1;
      substate = 'preparingForShot';
      targetTemp = p.steps[0]?.temperature ?? 93;
      mix += (targetTemp - mix) * 0.06;
      group += (targetTemp - group) * 0.05;
    } else if (state === 'espresso' && p) {
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
        stopReason = yieldTarget > 0 && weight >= yieldTarget ? 'targetWeight' : 'machineEnded';
        setTimeout(() => { if (state === 'idle') substate = 'idle'; }, 300);
      }
    } else {
      pressure *= 0.7;
      flow = state === 'flush' ? flow + (6 - flow) * 0.2 : flow * 0.7;
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
    const scaleFrame = { timestamp: now(), weight: Math.round(weight * 10) / 10, weightFlow: state === 'espresso' ? flow * 0.85 : 0, battery: 82, timerValue: null };
    if (recording) {
      recording.push({ machine: snapshot, scale: scaleConnected ? scaleFrame : null });
      if (state !== 'espresso') { saveShot(); recording = null; }
    }
    subs?.onMachine(snapshot);
    if (scaleConnected) subs?.onScale(scaleFrame);
    if (++ticks % 10 === 0) {
      waterLevel = Math.max(0, waterLevel - 1 / 60);
      subs?.onWater({ currentLevel: Math.round(waterLevel * 10) / 10, refillLevel });
    }
  };

  const delay = (ms = 120) => new Promise((r) => setTimeout(r, ms));

  return {
    mock: true,

    subscribe(s) {
      // Demo-only hook, so the guide's weighing step can be tried without a
      // scale: __flimsyMock.setWeight(17.6) in the console.
      // Same for the rinse, which is started on the machine: __flimsyMock.pressFlush().
      (globalThis as { __flimsyMock?: unknown }).__flimsyMock = {
        setWeight: (g: number) => { weight = g; },
        pressFlush: () => { void this.requestState('flush'); },
        // Steam button on the machine: runs for the steam duration (at most 20 s here).
        pressSteam: () => { void this.requestState('steam'); },
        // Group-head brew button: a few seconds of preheat before the shot pours.
        // Scale drops off (as if switched off): the guide then offers Tap to connect.
        disconnectScale: () => { scaleConnected = false; subs?.onScale({ status: 'disconnected' }); subs?.onDevices(devices()); },
        pressBrew: () => { preheat = 5; mix -= 3; group -= 6; void this.requestState('espresso'); },
      };
      subs = s;
      s.onSocketStatus('machine', 'open');
      s.onSocketStatus('scale', 'open');
      s.onSocketStatus('devices', 'open');
      s.onDevices(devices());
      s.onScale({ status: 'connected' });
      s.onWater({ currentLevel: waterLevel, refillLevel });
      timer = setInterval(tick, 100);
      return () => { if (timer) clearInterval(timer); subs = null; };
    },

    scanDevices() {
      // A scan takes a moment, like a real one.
      scanning = true;
      subs?.onDevices(devices());
      setTimeout(() => {
        scanning = false;
        scaleConnected = true;
        subs?.onScale({ status: 'connected' });
        subs?.onDevices(devices());
      }, 1500);
    },

    async requestState(next) {
      await delay();
      if (next !== 'espresso') preheat = 0;
      if (next === 'espresso') { shotT = 0; weight = 0; pressure = 0; flow = 0; recording = []; stopReason = null; }
      else if (state === 'espresso') stopReason = 'apiStop';
      state = next;
      substate = next === 'espresso' ? 'preparingForShot' : 'idle';
      // A rinse runs for the workflow's rinse time, then the machine goes idle.
      if (next === 'flush') {
        const secs = Math.min(8, workflow.rinseData?.duration ?? 5);
        setTimeout(() => { if (state === 'flush') state = 'idle'; }, secs * 1000);
      }
      // Steam runs for its max run time, then stops (Stop ends it sooner).
      if (next === 'steam') {
        const secs = Math.min(20, workflow.steamSettings?.duration ?? 20);
        setTimeout(() => { if (state === 'steam') state = 'idle'; }, secs * 1000);
      }
    },
    // ?mock=1&ghc=1 pretends a Group Head Controller is fitted.
    async getMachineInfo() {
      await delay();
      return { model: 'DE1+', version: 'mock', GHC: new URLSearchParams(location.search).get('ghc') === '1' };
    },
    async checkSkinUpdates() { await delay(1500); },
    async installedSkinVersion() { await delay(); return __APP_VERSION__; },
    async setWaterRefillLevel(mm) { await delay(); refillLevel = Math.trunc(mm); },
    async tareScale() { await delay(); weight = 0; },
    async keepScreenOn() { await delay(20); },
    async getDisplay() { await delay(20); return { brightness, requestedBrightness: brightness, platformSupported: { brightness: true, wakeLock: true } }; },
    async setBrightness(b) { await delay(20); brightness = Math.round(b); },

    async getProfiles() { await delay(); return clone(profiles.filter((r) => r.visibility === 'visible')); },
    // Like Decaid: the id hashes what the machine runs (not title/author/notes),
    // and creating an existing id returns that record unchanged.
    async createProfile(profile, parentId) {
      await delay();
      if (!profile.title?.trim() || !profile.steps?.length) throw new Error('400 Invalid profile');
      if (parentId && !profiles.some((r) => r.id === parentId)) throw new Error(`400 Parent profile not found: ${parentId}`);
      const id = executionId(profile);
      const found = profiles.find((r) => r.id === id);
      if (found) return clone(found);
      const rec: ProfileRecord = { id, profile: clone(profile), parentId, visibility: 'visible', isDefault: false, createdAt: now(), updatedAt: now() };
      profiles.push(rec);
      return clone(rec);
    },
    async updateProfile(id, profile) {
      await delay();
      const i = profiles.findIndex((r) => r.id === id);
      if (i < 0) throw new Error(`400 Profile not found: ${id}`);
      if (profiles[i]!.isDefault) throw new Error('400 Cannot modify default profile content');
      if (executionId(profile) !== id) throw new Error('400 Use parentId for versioning');
      profiles[i] = { ...profiles[i]!, profile: clone(profile), updatedAt: now() };
      return clone(profiles[i]!);
    },
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
    async getBatch(id) {
      await delay();
      const b = batches.find((x) => x.id === id);
      if (!b) throw new Error('404 Batch not found');
      return clone(b);
    },
    async createBatch(beanId, b) {
      await delay();
      const batch: BeanBatch = { frozen: false, archived: false, ...b, weightRemaining: b.weightRemaining ?? b.weight ?? null, beanId, id: `batch-${crypto.randomUUID()}`, createdAt: now(), updatedAt: now() };
      batches.push(batch);
      return clone(batch);
    },
    async deleteBatch(id) {
      await delay();
      const i = batches.findIndex((b) => b.id === id);
      if (i >= 0) batches.splice(i, 1);
    },
    async updateBatch(id, patch) {
      await delay();
      const i = batches.findIndex((b) => b.id === id);
      if (i < 0) throw new Error('Batch not found');
      batches[i] = { ...batches[i]!, ...patch, updatedAt: now() };
      return clone(batches[i]!);
    },

    async getShots(q = {}) {
      await delay();
      let items = shots;
      if (q.profileTitle) items = items.filter((x) => x.workflow?.profile?.title === q.profileTitle);
      if (q.beanBatchId) items = items.filter((x) => x.workflow?.context?.beanBatchId === q.beanBatchId);
      if (q.beanId) {
        const ids = new Set(batches.filter((b) => b.beanId === q.beanId).map((b) => b.id));
        items = items.filter((x) => ids.has(x.workflow?.context?.beanBatchId ?? ''));
      }
      const offset = q.offset ?? 0;
      const limit = Math.min(100, Math.max(1, q.limit ?? 20));
      const page = items.slice(offset, offset + limit).map(({ measurements: _, ...summary }): ShotSummary => summary);
      return clone({ items: page, total: items.length, limit, offset });
    },
    async getShot(id) {
      await delay();
      const shot = shots.find((x) => x.id === id);
      if (!shot) throw new Error('Shot not found');
      return clone(shot);
    },
    async updateShot(id, annotations) {
      await delay();
      const shot = shots.find((x) => x.id === id);
      if (!shot) throw new Error('404 Shot not found');
      if (annotations.enjoyment != null && (annotations.enjoyment < 0 || annotations.enjoyment > 10)) throw new Error('400 enjoyment must be 0-10');
      shot.annotations = { ...(shot.annotations ?? {}), ...clone(annotations) };
      shot.updatedAt = now();
      const { measurements: _, ...summary } = shot;
      return clone(summary);
    },
    async deleteShot(id) {
      await delay();
      const i = shots.findIndex((x) => x.id === id);
      if (i >= 0) shots.splice(i, 1);
    },
    async setProfileVisibility(id, visibility) {
      await delay();
      const r = profiles.find((x) => x.id === id);
      if (!r) throw new Error(`404 Profile not found: ${id}`);
      if (r.isDefault && visibility === 'deleted') throw new Error('400 Cannot delete default profiles, only hide them');
      r.visibility = visibility;
      return clone(r);
    },

    async getPlugins() { await delay(); return [{ id: 'visualizer.reaplugin', name: 'Visualizer upload', loaded: vizLoaded, autoLoad: vizLoaded }]; },
    async getPluginSettings(id) {
      await delay();
      if (id !== 'visualizer.reaplugin') throw new Error('404 Plugin not found');
      return vizRedacted();
    },
    async savePluginSettings(id, patch) {
      await delay();
      if (id !== 'visualizer.reaplugin') throw new Error('404 Plugin not found');
      for (const [k, v] of Object.entries(patch)) {
        if (k === 'Username') vizSettings.Username = v === null ? '' : String(v);
        else if (k === 'Password') vizSettings.Password = v === null ? '' : String(v);
        else if (k === 'AutoUpload') vizSettings.AutoUpload = v === true;
      }
      return vizRedacted();
    },
    async setPluginEnabled(id, enabled) {
      await delay();
      if (id !== 'visualizer.reaplugin') throw new Error('404 Plugin not found');
      vizLoaded = enabled;
    },
    async callPlugin<T>(id: string, endpoint: string, body?: unknown): Promise<T> {
      await delay(250);
      if (id !== 'visualizer.reaplugin' || !vizLoaded) throw new Error('404 Plugin not loaded');
      const b = (body ?? {}) as Record<string, string>;
      if (endpoint === 'status') return { status: 'online', timestamp: Date.now() } as T;
      if (endpoint === 'verifyCredentials') return { valid: b.username !== '' && b.password !== '' && b.password !== 'wrong' } as T;
      if (endpoint === 'upload') {
        const shot = shots.find((x) => x.id === b.shotId);
        if (!shot) throw new Error('400 shotId is required');
        if (!vizSignedIn()) throw new Error('502 Visualizer upload failed: sign in first');
        const vid = `viz-${Math.random().toString(36).slice(2, 8)}`;
        shot.annotations = { ...(shot.annotations ?? {}), extras: { ...(shot.annotations?.extras ?? {}), visualizerId: vid } };
        return { visualizer_id: vid, tag_sync_pending: true } as T;
      }
      throw new Error('404 Unknown plugin endpoint');
    },

    async storeGet<T>(key: string) { await delay(40); return (store.has(key) ? clone(store.get(key)) : null) as T | null; },
    async storeSet(key, value) { await delay(40); store.set(key, clone(value)); },
    async storeDelete(key) { await delay(40); store.delete(key); },
  };
}
