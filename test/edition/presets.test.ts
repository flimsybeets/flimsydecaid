import { describe, expect, it } from 'vitest';
import { EDITION } from '../../src/edition';
import { FLIMSY_BEETS } from '../../src/edition/presets';
import { PRESETS } from '../../src/lib/workflowPresets';
import { normaliseWorkflow, validateWorkflow } from '../../src/lib/workflow';

describe('personal guide presets', () => {
  const w = FLIMSY_BEETS.workflow;
  it('keeps the 13 steps the guide always had, in order', () => {
    expect(w.steps.map((s) => s.template)).toEqual(['weigh', 'spray', 'grinder', 'grind', 'basket', 'funnel', 'tamp', 'paper', 'minerals', 'pull', 'knock', 'rinse', 'done']);
    expect(w.steps.map((s) => s.label)).toEqual(['Weigh', 'Spray', 'Grinder', 'Grind', 'Basket', 'Funnel', 'Tamp', 'Paper', 'Minerals', 'Pull', 'Knock', 'Rinse', 'Enjoy']);
  });
  it('keeps the old wording', () => {
    const by = (id: string) => w.steps.find((s) => s.id === id)!;
    expect(by('basket')).toMatchObject({ title: 'Convex basket in', body: 'Check the IKAPE convex basket is in the portafilter.' });
    expect(by('funnel').title).toBe('Funnel, cup, then tap');
    expect(by('tamp').body).toBe('Funnel off, then press the tamper down.');
    expect(by('minerals').title).toBe('One drop of minerals');
    expect(by('spray').body).toBe('One or two sprays from a distance to gently mist the beans.');
    expect(by('grind').items).toEqual(['Turn on the grinder', 'Add the beans', 'Wait for it to finish grinding', 'Turn it off', 'Tap the bellows to push out the last grounds']);
    expect(by('weigh').title).toBe('Weigh {dose} g');
  });
  it('is valid, and the personal edition starts on it', () => {
    expect(validateWorkflow(w)).toEqual([]);
    expect(normaliseWorkflow(w, w)).toEqual(w);
    expect(EDITION.guide.presets[0]).toBe(FLIMSY_BEETS);
    expect(EDITION.guide.presets.slice(1)).toEqual(PRESETS);
  });
});
