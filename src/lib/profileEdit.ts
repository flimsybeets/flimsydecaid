// Pure logic behind the profile editor: step operations, the planned curve
// for the chart, validation against what the DE1 can do, undo history, and
// how a save maps onto Decaid's content-hashed profiles.

import type { Profile, ProfileRecord, ProfileStep, StepExit } from '../api/types';

export type Pump = ProfileStep['pump'];

/** DE1 limits. Past these the machine clamps or refuses; warn, don't block. */
export const LIMITS = {
  steps: 20,
  seconds: 127,
  pressure: 12,
  flow: 8,
  tempMin: 0,
  tempMax: 105,
} as const;

const DEFAULT_TARGET: Record<Pump, number> = { pressure: 9, flow: 2 };

const r1 = (n: number) => Math.round(n * 10) / 10;

/** The value the pump is driving towards on this step. */
export function stepTarget(step: ProfileStep): number {
  return (step.pump === 'pressure' ? step.pressure : step.flow) ?? DEFAULT_TARGET[step.pump];
}

export function setStepTarget(step: ProfileStep, value: number): ProfileStep {
  return step.pump === 'pressure' ? { ...step, pressure: value } : { ...step, flow: value };
}

/**
 * Switch a step between pressure and flow control. Keeps the other value if
 * the step already had one, so flipping back and forth loses nothing.
 */
export function setPump(step: ProfileStep, pump: Pump): ProfileStep {
  if (step.pump === pump) return step;
  const next: ProfileStep = { ...step, pump };
  if (pump === 'pressure' && next.pressure === undefined) next.pressure = DEFAULT_TARGET.pressure;
  if (pump === 'flow' && next.flow === undefined) next.flow = DEFAULT_TARGET.flow;
  return next;
}

/** A new step that carries on from `after` (same temperature and sensor). */
export function newStep(after?: ProfileStep, pump: Pump = 'pressure'): ProfileStep {
  return {
    name: pump === 'flow' ? 'flow' : 'pressure',
    pump,
    transition: 'fast',
    volume: 0,
    seconds: 10,
    weight: 0,
    temperature: after?.temperature ?? 93,
    sensor: after?.sensor ?? 'coffee',
    ...(pump === 'pressure' ? { pressure: DEFAULT_TARGET.pressure } : { flow: DEFAULT_TARGET.flow }),
    exit: null,
    limiter: { value: 0, range: 0.6 },
  };
}

/** A sensible starting point: flow preinfusion that hands over at 4 bar, then 9 bar. */
export function blankProfile(author = ''): Profile {
  const pre: ProfileStep = {
    ...newStep(undefined, 'flow'),
    name: 'preinfusion',
    flow: 4,
    seconds: 20,
    exit: { type: 'pressure', condition: 'over', value: 4 },
  };
  const pour: ProfileStep = { ...newStep(pre, 'pressure'), name: 'pour', transition: 'smooth', seconds: 40 };
  return {
    version: '2',
    title: 'New profile',
    author,
    notes: '',
    beverage_type: 'espresso',
    steps: [pre, pour],
    target_volume: 0,
    target_weight: 36,
    target_volume_count_start: 0,
    tank_temperature: 0,
  };
}

export function insertStep(steps: readonly ProfileStep[], index: number, step: ProfileStep): ProfileStep[] {
  const out = [...steps];
  out.splice(Math.max(0, Math.min(index, out.length)), 0, step);
  return out;
}

export function duplicateStep(steps: readonly ProfileStep[], index: number): ProfileStep[] {
  const src = steps[index];
  if (!src) return [...steps];
  return insertStep(steps, index + 1, JSON.parse(JSON.stringify(src)) as ProfileStep);
}

/** Never removes the last step: a profile needs at least one. */
export function removeStep(steps: readonly ProfileStep[], index: number): ProfileStep[] {
  if (steps.length <= 1) return [...steps];
  return steps.filter((_, i) => i !== index);
}

export function moveStep(steps: readonly ProfileStep[], index: number, to: number): ProfileStep[] {
  if (to < 0 || to >= steps.length || index === to) return [...steps];
  const out = [...steps];
  const [s] = out.splice(index, 1);
  out.splice(to, 0, s!);
  return out;
}

/** target_volume_count_start is a step index; keep it pointing at the same step after a reorder or removal. */
export function remapCountStart(start: number, len: number): number {
  return Math.max(0, Math.min(start, Math.max(0, len - 1)));
}

/**
 * Clean a profile for saving: drop the target field the pump doesn't use
 * (Decaid keys pressure/flow by pump), round to what the machine resolves,
 * and turn an "off" exit into null. Unknown fields pass through untouched.
 */
export function normalizeProfile(p: Profile): Profile {
  return {
    ...p,
    title: p.title.trim(),
    steps: p.steps.map((s) => {
      const step: ProfileStep = { ...s, seconds: r1(s.seconds), temperature: r1(s.temperature), volume: Math.round(s.volume ?? 0) };
      if (step.pump === 'pressure') { step.pressure = r1(stepTarget(s)); delete step.flow; }
      else { step.flow = r1(stepTarget(s)); delete step.pressure; }
      if (step.exit && !(step.exit.value > 0)) step.exit = null;
      return step;
    }),
    target_volume_count_start: remapCountStart(p.target_volume_count_start ?? 0, p.steps.length),
  };
}

// ---- The planned curve -----------------------------------------------------

export interface CurveSegment {
  index: number;
  t0: number;
  t1: number;
  pump: Pump;
  /** Target at the start of the step (differs from `to` on smooth steps). */
  from: number;
  to: number;
  temperature: number;
  sensor: ProfileStep['sensor'];
}

/**
 * What the profile asks for over time, if every step ran its full length.
 * Smooth steps ramp from where the last step left this quantity: the
 * previous target when the pump is the same, the previous step's exit
 * threshold when it exits on this quantity, otherwise from zero.
 */
export function profileCurve(steps: readonly ProfileStep[]): { segments: CurveSegment[]; total: number } {
  const segments: CurveSegment[] = [];
  let t = 0;
  steps.forEach((s, i) => {
    const to = stepTarget(s);
    const prev = steps[i - 1];
    let from = to;
    if (s.transition === 'smooth') {
      if (prev && prev.pump === s.pump) from = stepTarget(prev);
      else if (prev?.exit && prev.exit.type === s.pump) from = prev.exit.value;
      else from = 0;
    }
    const len = Math.max(0, s.seconds);
    segments.push({ index: i, t0: t, t1: t + len, pump: s.pump, from, to, temperature: s.temperature, sensor: s.sensor });
    t += len;
  });
  return { segments, total: t };
}

// ---- Validation ------------------------------------------------------------

export interface Issue {
  level: 'error' | 'warn';
  step?: number;
  message: string;
}

export function validateProfile(p: Profile): Issue[] {
  const issues: Issue[] = [];
  if (!p.title.trim()) issues.push({ level: 'error', message: 'Give it a title' });
  if (p.steps.length === 0) issues.push({ level: 'error', message: 'Needs at least one step' });
  if (p.steps.length > LIMITS.steps) issues.push({ level: 'warn', message: `${p.steps.length} steps; the DE1 runs at most ${LIMITS.steps}` });
  p.steps.forEach((s, i) => {
    const n = i + 1;
    const v = stepTarget(s);
    const bad = [s.seconds, s.temperature, v, s.volume ?? 0].some((x) => !Number.isFinite(x) || x < 0);
    if (bad) issues.push({ level: 'error', step: i, message: `Step ${n}: values must be zero or more` });
    if (s.seconds > LIMITS.seconds) issues.push({ level: 'warn', step: i, message: `Step ${n}: ${s.seconds} s is past the DE1's ${LIMITS.seconds} s per step` });
    if (s.seconds === 0 && !s.exit) issues.push({ level: 'warn', step: i, message: `Step ${n}: 0 s with no exit condition is skipped` });
    if (s.pump === 'pressure' && v > LIMITS.pressure) issues.push({ level: 'warn', step: i, message: `Step ${n}: ${v} bar is past ${LIMITS.pressure} bar` });
    if (s.pump === 'flow' && v > LIMITS.flow) issues.push({ level: 'warn', step: i, message: `Step ${n}: ${v} ml/s is past ${LIMITS.flow} ml/s` });
    if (s.temperature > LIMITS.tempMax) issues.push({ level: 'error', step: i, message: `Step ${n}: ${s.temperature}° is too hot` });
    if (s.exit && s.exit.type === s.pump && s.exit.condition === 'over' && s.exit.value > v && s.transition === 'fast') {
      issues.push({ level: 'warn', step: i, message: `Step ${n}: exits at ${exitText(s.exit)} but only targets ${v}` });
    }
  });
  return issues;
}

export function exitText(e: StepExit): string {
  return `${e.type === 'pressure' ? 'P' : 'F'} ${e.condition === 'over' ? '>' : '<'} ${e.value}`;
}

// ---- Undo / redo -----------------------------------------------------------

/**
 * Snapshots of the draft. Rapid changes to the same field (holding a
 * stepper) coalesce into one undo step.
 */
export class EditHistory<T> {
  private past: string[] = [];
  private future: string[] = [];
  private lastKey: string | null = null;
  private lastAt = 0;

  constructor(private current: string, private coalesceMs = 800) {}

  static of<T>(value: T, coalesceMs?: number): EditHistory<T> {
    return new EditHistory<T>(JSON.stringify(value), coalesceMs);
  }

  get canUndo(): boolean { return this.past.length > 0; }
  get canRedo(): boolean { return this.future.length > 0; }
  get value(): T { return JSON.parse(this.current) as T; }

  /** Record a new state. `key` names the field changed, for coalescing. */
  push(value: T, key: string | null = null, now = Date.now()): void {
    const next = JSON.stringify(value);
    if (next === this.current) return;
    const coalesce = key !== null && key === this.lastKey && now - this.lastAt < this.coalesceMs;
    if (!coalesce) this.past.push(this.current);
    this.current = next;
    this.future = [];
    this.lastKey = key;
    this.lastAt = now;
  }

  undo(): T | null {
    const prev = this.past.pop();
    if (prev === undefined) return null;
    this.future.push(this.current);
    this.current = prev;
    this.lastKey = null;
    return this.value;
  }

  redo(): T | null {
    const next = this.future.pop();
    if (next === undefined) return null;
    this.past.push(this.current);
    this.current = next;
    this.lastKey = null;
    return this.value;
  }
}

// ---- Saving ----------------------------------------------------------------

export interface ProfileApi {
  create(profile: Profile, parentId: string | null): Promise<ProfileRecord>;
  update(id: string, profile: Profile): Promise<ProfileRecord>;
}

export type SaveResult =
  /** version: new version of the edited profile; created: brand new; renamed: same steps, new title/notes. */
  | { kind: 'version' | 'created' | 'renamed' | 'unchanged'; record: ProfileRecord }
  /** Identical to another existing profile, so nothing new was made. */
  | { kind: 'same-as'; record: ProfileRecord };

const metaChanged = (a: Profile, b: Profile) =>
  a.title !== b.title || (a.author ?? '') !== (b.author ?? '') || (a.notes ?? '') !== (b.notes ?? '');

/**
 * Save a draft. Decaid ids hash only what the machine runs (steps and
 * targets), not title/author/notes, and creating a profile whose hash exists
 * returns the existing record unchanged. So:
 * - edit with changed steps: POST with parentId → a new version in the same
 *   lineage (categories and dial-ins follow it);
 * - edit with only title/author/notes changed: POST comes back with the same
 *   id, so PUT the metadata onto it (Decaid refuses this for its defaults);
 * - new or "save as copy": POST without a parent;
 * - any POST that lands on a different existing profile: nothing new was
 *   made; report which profile it matches.
 */
export async function saveProfile(api: ProfileApi, draft: Profile, original: ProfileRecord | null, asCopy = false): Promise<SaveResult> {
  const profile = normalizeProfile(draft);
  const parent = original && !asCopy ? original.id : null;
  const record = await api.create(profile, parent);

  if (original && !asCopy && record.id === original.id) {
    if (!metaChanged(record.profile, profile)) return { kind: 'unchanged', record };
    return { kind: 'renamed', record: await api.update(record.id, profile) };
  }
  const fresh = record.parentId === parent && metaSame(record.profile, profile);
  if (!fresh) return { kind: 'same-as', record };
  return { kind: parent ? 'version' : 'created', record };
}

const metaSame = (a: Profile, b: Profile) => !metaChanged(a, b);
