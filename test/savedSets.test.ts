import { describe, expect, it } from 'vitest';
import { parseSavedSets, withSavedSet, withoutSavedSet, MAX_SAVED_SETS } from '../src/lib/workflow';
import { PRESETS } from '../src/lib/workflowPresets';

const wf = PRESETS[0]!.workflow;

describe('saved sets', () => {
  it('parses junk safely and cleans workflows', () => {
    expect(parseSavedSets(null)).toEqual([]);
    expect(parseSavedSets({ sets: [{ id: 'a', name: ' Mine ', savedAt: 'x', workflow: wf }, { id: 'b' }, 7] })).toHaveLength(1);
  });
  it('replaces a set with the same name, newest first', () => {
    let sets = withSavedSet([], wf, 'Weekend', '2026-01-01T00:00:00Z');
    sets = withSavedSet(sets, wf, 'Weekday', '2026-01-02T00:00:00Z');
    const again = withSavedSet(sets, { ...wf, steps: wf.steps.slice(1) }, '  weekend ', '2026-01-03T00:00:00Z');
    expect(again.map((s) => s.name)).toEqual(['weekend', 'Weekday']);
    expect(again[0]!.id).toBe(sets[1]!.id);
    expect(again[0]!.workflow.name).toBe('weekend');
    expect(withoutSavedSet(again, again[1]!.id).map((s) => s.name)).toEqual(['weekend']);
  });
  it('keeps at most the limit', () => {
    let sets: ReturnType<typeof withSavedSet> = [];
    for (let i = 0; i < MAX_SAVED_SETS + 3; i++) sets = withSavedSet(sets, wf, `S${i}`, `2026-01-01T00:00:${String(i).padStart(2, '0')}Z`);
    expect(sets).toHaveLength(MAX_SAVED_SETS);
    expect(sets[0]!.name).toBe(`S${MAX_SAVED_SETS + 2}`);
  });
});
