// Roasters you've bought from before, for the Add a bag roaster field: most
// coffees first (then most recent), matching what's typed so far, the exact
// match left out (nothing left to complete). Case and spacing don't split a
// roaster in two; the most recent spelling is the one shown.

export interface RoasterSource { roaster: string; createdAt?: string | null }

export function roasterSuggestions(beans: readonly RoasterSource[], typed: string, max = 6): string[] {
  const key = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();
  const seen = new Map<string, { name: string; count: number; latest: string }>();
  for (const b of beans) {
    const k = key(b.roaster ?? '');
    if (!k) continue;
    const at = b.createdAt ?? '';
    const e = seen.get(k);
    if (!e) seen.set(k, { name: b.roaster.trim().replace(/\s+/g, ' '), count: 1, latest: at });
    else {
      e.count++;
      if (at > e.latest) { e.latest = at; e.name = b.roaster.trim().replace(/\s+/g, ' '); }
    }
  }
  const q = key(typed);
  return [...seen.entries()]
    .filter(([k]) => k !== q && (q === '' || k.split(' ').some((w) => w.startsWith(q)) || k.startsWith(q) || k.includes(q)))
    // Names that start with what's typed come before ones that only contain it.
    .sort(([ka, a], [kb, b]) => Number(kb.startsWith(q)) - Number(ka.startsWith(q)) || b.count - a.count || b.latest.localeCompare(a.latest) || ka.localeCompare(kb))
    .slice(0, max)
    .map(([, e]) => e.name);
}
