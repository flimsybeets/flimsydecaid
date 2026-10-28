// Finding the scale without a tap. Decaid connects a remembered scale by
// itself, but its background watch can stall on Android (scan throttling),
// leaving the scale unconnected until someone scans. So while the machine is
// up and awake with no scale, the skin keeps asking for a "connect the
// preferred scale as soon as it's seen" scan: 5 s, then doubling, capped at
// 5 minutes, for as long as it takes (Bestpresso does the same and connects
// reliably). Android swallows more than 5 scan starts in 30 s, so the early
// ones stay spaced out too.

export const HUNT_FIRST_MS = 5_000;
export const HUNT_MAX_MS = 5 * 60_000;

/** Delay before automatic scan number `attempt` (0-based): 5 s, 10 s, 20 s … then every 5 min. */
export function huntDelay(attempt: number): number {
  return Math.min(HUNT_MAX_MS, HUNT_FIRST_MS * 2 ** Math.min(16, Math.max(0, Math.floor(attempt))));
}

/** Whether the skin should be looking for the scale at all. */
export function shouldHunt(s: { machineConnected: boolean; asleep: boolean; scaleConnected: boolean; shotActive: boolean }): boolean {
  return s.machineConnected && !s.asleep && !s.scaleConnected && !s.shotActive;
}
