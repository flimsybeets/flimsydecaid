import { describe, expect, it, vi } from 'vitest';
import {
  clockToMinutes, daysLabel, machinePatch, minutesToClock, parseAdvanced, parseAppSettings, parseMachineSettings,
  parsePresence, parseSchedule, patchQueue, sleepLabel, toggleDay, voltageLabel,
} from '../src/lib/decaidSettings';

describe('parsers', () => {
  it('fill Decaid defaults for anything missing or wrong', () => {
    const a = parseAppSettings({ gatewayMode: 'nonsense', weightFlowMultiplier: 1.4 });
    expect(a.gatewayMode).toBe('disabled');
    expect(a.weightFlowMultiplier).toBe(1.4);
    expect(a.volumeFlowMultiplier).toBe(0.3);
    expect(a.stopHotWaterAtWeight).toBe(true);
    expect(a.keepAwake).toBe(true);
    expect(a.battery).toBeNull();
    expect(parseAppSettings(null).nightModeSleepTime).toBe(1320);
  });
  it('reads the battery when the tablet reports it', () => {
    const a = parseAppSettings({ chargingState: { batteryPercent: 62, currentPhase: 'normal', usbChargerOn: true } });
    expect(a.battery).toEqual({ percent: 62, phase: 'normal', usbChargerOn: true });
  });
  it('machine and advanced settings', () => {
    expect(parseMachineSettings({ fan: 45, usb: true })).toEqual({ fan: 45, usb: true, tankTemp: 0, steamPurgeMode: 0 });
    expect(parseAdvanced({ refillKitSetting: 7 }).refillKitSetting).toBe(2);
    expect(parseAdvanced({ refillKitSetting: 0, heaterVoltage: 230 })).toMatchObject({ refillKitSetting: 0, heaterVoltage: 230 });
  });
  it('USB goes out as enable/disable', () => {
    expect(machinePatch({ usb: true, fan: 40 })).toEqual({ usb: 'enable', fan: 40 });
    expect(machinePatch({ usb: false })).toEqual({ usb: 'disable' });
  });
  it('presence and schedules', () => {
    const p = parsePresence({ userPresenceEnabled: false, sleepTimeoutMinutes: 45, schedules: [
      { id: 'b', time: '07:30', daysOfWeek: [5, 1, 1, 9], enabled: true, keepAwakeFor: 0 },
      { id: 'a', time: '06:00', daysOfWeek: [], enabled: false, keepAwakeFor: 90 },
      { nope: true },
    ] });
    expect(p.enabled).toBe(false);
    expect(p.sleepTimeoutMinutes).toBe(45);
    expect(p.schedules.map((s) => s.id)).toEqual(['a', 'b']);
    expect(p.schedules[1]).toEqual({ id: 'b', time: '07:30', daysOfWeek: [1, 5], enabled: true, keepAwakeFor: null });
    expect(p.schedules[0]!.keepAwakeFor).toBe(90);
    expect(parseSchedule({ id: 'x' })).toBeNull();
  });
});

describe('wording', () => {
  it('times', () => {
    expect(minutesToClock(1320)).toBe('22:00');
    expect(minutesToClock(65)).toBe('01:05');
    expect(clockToMinutes('7:05')).toBe(425);
    expect(clockToMinutes('24:00')).toBeNull();
    expect(clockToMinutes('x')).toBeNull();
  });
  it('days', () => {
    expect(daysLabel([])).toBe('Every day');
    expect(daysLabel([1, 2, 3, 4, 5])).toBe('Weekdays');
    expect(daysLabel([7, 6])).toBe('Weekends');
    expect(daysLabel([1, 3])).toBe('Mon, Wed');
    expect(toggleDay([], 7)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(toggleDay([1, 2, 3, 4, 5, 6], 7)).toEqual([]);
    expect(toggleDay([1, 3], 3)).toEqual([1]);
  });
  it('sleep and voltage', () => {
    expect(sleepLabel(0)).toBe('Never');
    expect(sleepLabel(45)).toBe('45 min');
    expect(sleepLabel(90)).toBe('1 h 30 min');
    expect(sleepLabel(120)).toBe('2 h');
    expect(voltageLabel(230)).toBe('220–240 V');
    expect(voltageLabel(-1)).toBe('Not known yet');
  });
});

describe('patchQueue', () => {
  it('merges quick changes into one write after a quiet spell', async () => {
    vi.useFakeTimers();
    const sent: unknown[] = [];
    const results: unknown[] = [];
    const q = patchQueue<{ a: number; b: number }>(async (p) => { sent.push(p); }, (e) => results.push(e), 600);
    q.set({ a: 1 });
    vi.advanceTimersByTime(300);
    q.set({ a: 2, b: 3 });
    vi.advanceTimersByTime(599);
    expect(sent).toEqual([]);
    vi.advanceTimersByTime(1);
    await vi.runAllTimersAsync();
    expect(sent).toEqual([{ a: 2, b: 3 }]);
    expect(results).toEqual([null]);
    vi.useRealTimers();
  });
  it('flush sends at once and reports errors', async () => {
    const results: unknown[] = [];
    const q = patchQueue<{ a: number }>(async () => { throw new Error('nope'); }, (e) => results.push(e), 600);
    q.set({ a: 1 });
    await q.flush();
    expect((results[0] as Error).message).toBe('nope');
  });
});
