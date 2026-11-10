// Decaid's own settings, shown on the skin's Settings page (the same things
// Decaid's bundled settings plugin offers, in plain words). Each group lives
// behind its own endpoint:
//   app       GET|POST /api/v1/settings
//   machine   GET|POST /api/v1/machine/settings         (fan, USB charger, tank temp, steam stop)
//   advanced  GET|POST /api/v1/machine/settings/advanced (heater, refill kit, mains voltage)
//   flow cal  GET|POST /api/v1/machine/calibration      ({flowMultiplier})
//   presence  GET|POST /api/v1/presence/settings        (+ /presence/schedules CRUD)
// Hot water and flush go through the workflow (hotWaterData, rinseData), which
// Decaid writes to the machine.
// Parsers fill gaps with Decaid's documented defaults so the page always has
// something to show, and every write is a partial patch.

export type GatewayMode = 'disabled' | 'tracking' | 'full';
export type ScalePowerMode = 'disabled' | 'displayOff' | 'disconnect';
export type ChargingMode = 'disabled' | 'longevity' | 'balanced' | 'highAvailability';
export type LogLevel = 'ALL' | 'FINEST' | 'FINER' | 'FINE' | 'CONFIG' | 'INFO' | 'WARNING' | 'SEVERE' | 'SHOUT' | 'OFF';

export interface AppSettings {
  gatewayMode: GatewayMode;
  logLevel: LogLevel;
  weightFlowMultiplier: number;
  volumeFlowMultiplier: number;
  hotWaterFlowMultiplier: number;
  scalePowerMode: ScalePowerMode;
  blockOnNoScale: boolean;
  blockTareDuringShot: boolean;
  stopHotWaterAtWeight: boolean;
  automaticUpdateCheck: boolean;
  chargingMode: ChargingMode;
  nightModeEnabled: boolean;
  /** Minutes since midnight. */
  nightModeSleepTime: number;
  nightModeMorningTime: number;
  lowBatteryBrightnessLimit: boolean;
  keepAwake: boolean;
  /** Only on tablets that report it. */
  battery: { percent: number; phase: string; usbChargerOn: boolean } | null;
}

export interface MachineSettings {
  /** Fan comes on above this temperature (°C). */
  fan: number;
  usb: boolean;
  /** Water tank heater target (°C); 0 = off. */
  tankTemp: number;
  /** 0 = normal, 1 = two-tap stop. */
  steamPurgeMode: number;
}

export interface AdvancedSettings {
  heaterPh1Flow: number;
  heaterPh2Flow: number;
  heaterIdleTemp: number;
  heaterPh2Timeout: number;
  /** 120 (110 V region), 230 (220 V region) or -1 (unknown). Shown, never written. */
  heaterVoltage: number;
  /** 2 = auto, 1 = always on, 0 = always off. */
  refillKitSetting: 0 | 1 | 2;
}

export interface WakeSchedule {
  id: string;
  /** "HH:MM", 24-hour. */
  time: string;
  /** ISO weekdays 1 (Mon) … 7 (Sun); empty = every day. */
  daysOfWeek: number[];
  enabled: boolean;
  /** Minutes to stay awake after waking; null = wake only. */
  keepAwakeFor: number | null;
}

export interface Presence {
  enabled: boolean;
  /** 0–240; 0 = never sleep by itself. */
  sleepTimeoutMinutes: number;
  schedules: WakeSchedule[];
}

/** Ranges and steps the controls use (Decaid's own settings screen uses the same). */
export const RANGES = {
  weightFlowMultiplier: { min: 0, max: 5, step: 0.1 },
  volumeFlowMultiplier: { min: 0, max: 2, step: 0.05 },
  hotWaterFlowMultiplier: { min: 0, max: 2, step: 0.05 },
  fan: { min: 0, max: 60, step: 1 },
  tankTemp: { min: 0, max: 60, step: 1 },
  heaterPh1Flow: { min: 0, max: 10, step: 0.1 },
  heaterPh2Flow: { min: 0, max: 10, step: 0.1 },
  heaterIdleTemp: { min: 0, max: 100, step: 0.5 },
  heaterPh2Timeout: { min: 0, max: 300, step: 1 },
  flowMultiplier: { min: 0.13, max: 2, step: 0.01 },
  sleepTimeoutMinutes: { min: 0, max: 240, step: 5 },
  keepAwakeFor: { min: 0, max: 720, step: 15 },
  hotWaterTemp: { min: 40, max: 100, step: 1 },
  hotWaterVolume: { min: 10, max: 500, step: 5 },
  hotWaterDuration: { min: 1, max: 255, step: 1 },
  hotWaterFlow: { min: 1, max: 10, step: 0.5 },
  rinseTemp: { min: 40, max: 100, step: 1 },
  rinseDuration: { min: 1, max: 60, step: 1 },
  rinseFlow: { min: 1, max: 10, step: 0.5 },
} as const;

const obj = (raw: unknown): Record<string, unknown> => (raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {});
const n = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const b = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d);
function pick<T extends string>(v: unknown, allowed: readonly T[], d: T): T {
  return typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : d;
}

export function parseAppSettings(raw: unknown): AppSettings {
  const r = obj(raw);
  const cs = obj(r.chargingState);
  return {
    gatewayMode: pick(r.gatewayMode, ['disabled', 'tracking', 'full'] as const, 'disabled'),
    logLevel: pick(r.logLevel, ['ALL', 'FINEST', 'FINER', 'FINE', 'CONFIG', 'INFO', 'WARNING', 'SEVERE', 'SHOUT', 'OFF'] as const, 'INFO'),
    weightFlowMultiplier: n(r.weightFlowMultiplier, 1),
    volumeFlowMultiplier: n(r.volumeFlowMultiplier, 0.3),
    hotWaterFlowMultiplier: n(r.hotWaterFlowMultiplier, 0.3),
    scalePowerMode: pick(r.scalePowerMode, ['disabled', 'displayOff', 'disconnect'] as const, 'disabled'),
    blockOnNoScale: b(r.blockOnNoScale, false),
    blockTareDuringShot: b(r.blockTareDuringShot, false),
    stopHotWaterAtWeight: b(r.stopHotWaterAtWeight, true),
    automaticUpdateCheck: b(r.automaticUpdateCheck, true),
    chargingMode: pick(r.chargingMode, ['disabled', 'longevity', 'balanced', 'highAvailability'] as const, 'balanced'),
    nightModeEnabled: b(r.nightModeEnabled, false),
    nightModeSleepTime: n(r.nightModeSleepTime, 1320),
    nightModeMorningTime: n(r.nightModeMorningTime, 420),
    lowBatteryBrightnessLimit: b(r.lowBatteryBrightnessLimit, true),
    keepAwake: b(r.keepAwake, true),
    battery: typeof cs.batteryPercent === 'number'
      ? { percent: cs.batteryPercent, phase: typeof cs.currentPhase === 'string' ? cs.currentPhase : 'inactive', usbChargerOn: cs.usbChargerOn === true }
      : null,
  };
}

export function parseMachineSettings(raw: unknown): MachineSettings {
  const r = obj(raw);
  return { fan: n(r.fan, 50), usb: b(r.usb, false), tankTemp: n(r.tankTemp, 0), steamPurgeMode: n(r.steamPurgeMode, 0) };
}

/** The machine settings endpoint wants USB as 'enable' | 'disable'. */
export function machinePatch(p: Partial<MachineSettings>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...p };
  if (p.usb !== undefined) out.usb = p.usb ? 'enable' : 'disable';
  return out;
}

export function parseAdvanced(raw: unknown): AdvancedSettings {
  const r = obj(raw);
  const kit = r.refillKitSetting;
  return {
    heaterPh1Flow: n(r.heaterPh1Flow, 2.5),
    heaterPh2Flow: n(r.heaterPh2Flow, 2.5),
    heaterIdleTemp: n(r.heaterIdleTemp, 99),
    heaterPh2Timeout: n(r.heaterPh2Timeout, 5),
    heaterVoltage: n(r.heaterVoltage, -1),
    refillKitSetting: kit === 0 || kit === 1 || kit === 2 ? kit : 2,
  };
}

export function parseSchedule(raw: unknown): WakeSchedule | null {
  const r = obj(raw);
  if (typeof r.id !== 'string' || typeof r.time !== 'string') return null;
  const days = Array.isArray(r.daysOfWeek) ? r.daysOfWeek.filter((d): d is number => Number.isInteger(d) && d >= 1 && d <= 7) : [];
  const keep = typeof r.keepAwakeFor === 'number' && r.keepAwakeFor > 0 ? r.keepAwakeFor : null;
  return { id: r.id, time: r.time, daysOfWeek: [...new Set(days)].sort(), enabled: r.enabled !== false, keepAwakeFor: keep };
}

export function parsePresence(raw: unknown): Presence {
  const r = obj(raw);
  const schedules = (Array.isArray(r.schedules) ? r.schedules : []).map(parseSchedule).filter((s): s is WakeSchedule => s !== null);
  schedules.sort((a, c) => a.time.localeCompare(c.time));
  return { enabled: b(r.userPresenceEnabled, true), sleepTimeoutMinutes: n(r.sleepTimeoutMinutes, 30), schedules };
}

// ---- time and day wording ----------------------------------------------------

/** 1320 → "22:00". */
export function minutesToClock(m: number): string {
  const v = ((Math.round(m) % 1440) + 1440) % 1440;
  return `${String(Math.floor(v / 60)).padStart(2, '0')}:${String(v % 60).padStart(2, '0')}`;
}
/** "22:00" → 1320; null for anything else. */
export function clockToMinutes(s: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const h = Number(m[1]), mi = Number(m[2]);
  return h < 24 && mi < 60 ? h * 60 + mi : null;
}

export const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

export function daysLabel(days: readonly number[]): string {
  const set = [...new Set(days)].filter((d) => d >= 1 && d <= 7).sort();
  if (set.length === 0 || set.length === 7) return 'Every day';
  const key = set.join('');
  if (key === '12345') return 'Weekdays';
  if (key === '67') return 'Weekends';
  return set.map((d) => DAY_SHORT[d - 1]).join(', ');
}

/** Toggle one weekday; going from "every day" (empty) starts from all seven. Back to all seven = every day (empty). */
export function toggleDay(days: readonly number[], day: number): number[] {
  const base = days.length === 0 ? [1, 2, 3, 4, 5, 6, 7] : [...days];
  const next = base.includes(day) ? base.filter((d) => d !== day) : [...base, day];
  next.sort();
  return next.length === 7 ? [] : next;
}

export function sleepLabel(minutes: number): string {
  if (minutes <= 0) return 'Never';
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60), m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export function voltageLabel(v: number): string {
  return v === 120 ? '110–120 V' : v === 230 ? '220–240 V' : 'Not known yet';
}

// ---- saving ------------------------------------------------------------------

/**
 * Collects quick changes into one write: every `set` merges into the pending
 * patch and restarts the wait; after `delay` ms of quiet the merged patch is
 * sent. Decaid doesn't debounce, so steppers held down must not each write.
 */
export function patchQueue<T extends object>(
  send: (patch: Partial<T>) => Promise<unknown>,
  onResult: (error: unknown | null) => void,
  delay = 600,
  timers: { set: (fn: () => void, ms: number) => unknown; clear: (h: unknown) => void } = {
    set: (fn, ms) => setTimeout(fn, ms),
    clear: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
  },
) {
  let pending: Partial<T> = {};
  let handle: unknown = null;
  let chain: Promise<void> = Promise.resolve();
  const flush = () => {
    handle = null;
    const patch = pending;
    pending = {};
    if (Object.keys(patch).length === 0) return chain;
    // Writes go one after another, never overlapping.
    chain = chain.then(() => send(patch).then(() => onResult(null), (e) => onResult(e)));
    return chain;
  };
  return {
    set(patch: Partial<T>) {
      pending = { ...pending, ...patch };
      if (handle !== null) timers.clear(handle);
      handle = timers.set(flush, delay);
    },
    /** Send anything waiting now (leaving the page). */
    flush() {
      if (handle !== null) { timers.clear(handle); return flush(); }
      return chain;
    },
  };
}
