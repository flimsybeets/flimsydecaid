// Finding the scale without a tap. Decaid connects a remembered scale by
// itself, but its background watch can stall on Android (scan throttling),
// leaving the scale unconnected until someone scans. So once the machine is
// up and awake with no scale, the skin asks for one quick "connect the
// preferred scale as soon as it's seen" scan, then a few more, spaced out,
// and then stops. Android swallows more than 5 scan starts in 30 s, so these
// stay far apart.

/** Waits before each automatic scan, ms. The first leaves Decaid's own watch time to work. */
export const HUNT_DELAYS = [8_000, 30_000, 60_000, 120_000, 300_000] as const;

/** Delay before automatic scan number `attempt` (0-based), or null to stop trying. */
export function huntDelay(attempt: number): number | null {
  return HUNT_DELAYS[attempt] ?? null;
}

/** Whether the skin should be looking for the scale at all. */
export function shouldHunt(s: { machineConnected: boolean; asleep: boolean; scaleConnected: boolean; shotActive: boolean }): boolean {
  return s.machineConnected && !s.asleep && !s.scaleConnected && !s.shotActive;
}
