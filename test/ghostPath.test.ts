import { describe, expect, it } from 'vitest';
import { GHOSTS, MAX_OPACITY, ghostOpacity, ghostPose, yawFrame, type GhostSpec } from '../src/lib/ghostPath';

const N = 24;
const plain: GhostSpec = { size: 100, left: 0, top: 0, cycle: 40, offset: 0, ax: 10, ay: 4, px: 12, py: 20, phx: 0, phy: 0, bob: 5, events: [] };

describe('ghost frames', () => {
  it('maps yaw to the nearest frame and wraps', () => {
    expect(yawFrame(0, N)).toBe(0);
    expect(yawFrame(90, N)).toBe(6);
    expect(yawFrame(359, N)).toBe(0);
    expect(yawFrame(-90, N)).toBe(18);
    expect(yawFrame(7, N)).toBe(0);
    expect(yawFrame(8, N)).toBe(1);
  });
});

describe('ghost heading', () => {
  it('faces the way it is moving', () => {
    // x = 10 sin(2pi t / 12): moving right at t=0 (peak speed), left at t=6
    expect(ghostPose(plain, 0, N).yaw).toBeGreaterThan(80);
    expect(ghostPose(plain, 0, N).yaw).toBeLessThan(95);
    const left = ghostPose(plain, 6, N).yaw;
    expect(left).toBeGreaterThan(265);
    expect(left).toBeLessThan(280);
  });
  it('turns through the front when it reverses', () => {
    // at the turning point (t=3) it is not moving sideways, so it faces us
    const p = ghostPose(plain, 3, N);
    expect(Math.min(p.yaw, 360 - p.yaw)).toBeLessThan(5);
    expect(p.frame).toBe(0);
  });
  it('does a full slow turn-around on a spin event', () => {
    const g = { ...plain, ax: 0, events: [{ kind: 'spin' as const, at: 0.25, dur: 8 }] };
    // sample across the spin, unwrapping the yaw: it must advance by about 360
    let prev = ghostPose(g, 9.9, N).yaw;
    let total = 0;
    for (let t = 10; t <= 18.01; t += 0.1) {
      const y = ghostPose(g, t, N).yaw;
      let d = y - prev;
      if (d < -180) d += 360;
      if (d > 180) d -= 360;
      expect(d).toBeGreaterThanOrEqual(-0.01); // never turns back
      total += d;
      prev = y;
    }
    expect(total).toBeGreaterThan(330);
    expect(total).toBeLessThan(375);
  });
  it('turns to the viewer, holds, then turns away', () => {
    const g = { ...plain, events: [{ kind: 'face' as const, at: 0.25, dur: 6 }] };
    const mid = ghostPose(g, 10 + 3, N);
    expect(Math.min(mid.yaw, 360 - mid.yaw)).toBeLessThan(1);
    expect(mid.bob).not.toBeNaN();
    // after the event it is side-on again if it is moving
    const after = ghostPose(g, 10 + 6.5 + 0, N);
    expect(after.yaw).not.toBe(mid.yaw);
  });
  it('always returns a valid frame', () => {
    for (const g of GHOSTS) {
      for (let t = 0; t < 300; t += 0.37) {
        const p = ghostPose(g, t, N);
        expect(p.frame).toBeGreaterThanOrEqual(0);
        expect(p.frame).toBeLessThan(N);
        expect(Number.isFinite(p.x + p.y + p.roll)).toBe(true);
      }
    }
  });
});

describe('ghost fade', () => {
  it('fades in, holds, fades out and rests', () => {
    expect(ghostOpacity(0)).toBe(0);
    expect(ghostOpacity(0.3)).toBe(MAX_OPACITY);
    expect(ghostOpacity(0.68)).toBeGreaterThan(0);
    expect(ghostOpacity(0.68)).toBeLessThan(MAX_OPACITY);
    expect(ghostOpacity(0.9)).toBe(0);
    expect(ghostOpacity(1.3)).toBe(MAX_OPACITY);
  });
  it('keeps one or two ghosts in view, not all or none', () => {
    let sum = 0;
    let max = 0;
    for (let t = 0; t < 1200; t += 1) {
      const n = GHOSTS.filter((g) => ghostPose(g, t, N).opacity > 0.3).length;
      sum += n;
      max = Math.max(max, n);
    }
    expect(sum / 1200).toBeGreaterThan(1);
    expect(sum / 1200).toBeLessThan(3);
    expect(max).toBeLessThanOrEqual(4);
  });
});
