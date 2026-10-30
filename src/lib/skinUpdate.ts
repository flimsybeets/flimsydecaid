// Settings → Check for skin updates: Decaid re-fetches every installed skin
// from its source (POST /webui/skins/update), then we compare the version it
// now has installed for this skin with the one that's running.

/** -1, 0 or 1, comparing dot-separated numeric versions ("0.2.10" > "0.2.9"). */
export function compareVersions(a: string, b: string): number {
  const pa = a.replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d > 0 ? 1 : -1;
  }
  return 0;
}

export type SkinUpdateResult =
  | { kind: 'updated'; installed: string }
  | { kind: 'current'; installed: string }
  | { kind: 'failed'; message: string };

export function skinUpdateResult(running: string, installed: string | null): SkinUpdateResult {
  if (!installed) return { kind: 'current', installed: running };
  return compareVersions(installed, running) > 0 ? { kind: 'updated', installed } : { kind: 'current', installed: running };
}

/** Decaid answers a failed check with a plain-language message, sometimes wrapped in JSON. */
export function updateErrorText(body: string | undefined): string {
  if (!body) return "Couldn't check for updates.";
  try {
    const j = JSON.parse(body) as { error?: string; message?: string };
    return j.error || j.message || body;
  } catch { return body; }
}
