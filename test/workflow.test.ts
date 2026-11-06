import { describe, expect, it } from 'vitest';
import {
  addableTemplates, addStep, afterPull, canGoBack, canRemove, fillText, inspectWorkflow, itemsToLines, libraryStep, linesToItems, MAX_STEPS, moveStep,
  normaliseWorkflow, removeStep, STEP_LIBRARY, TEMPLATE_KEYS, timerText, updateStep, validateWorkflow, type Workflow,
} from '../src/lib/workflow';
import { cloneWorkflow, fromTemplates, PRESETS } from '../src/lib/workflowPresets';

const simple = () => cloneWorkflow(PRESETS[0]!.workflow);
const templates = (w: Workflow) => w.steps.map((s) => s.template);

describe('library', () => {
  it('has plain, brand-free copy for every template', () => {
    for (const t of TEMPLATE_KEYS) {
      const l = STEP_LIBRARY[t];
      expect(l.title.length).toBeGreaterThan(0);
      expect(l.label.length).toBeGreaterThan(0);
      expect(l.label.length).toBeLessThanOrEqual(16);
      expect(JSON.stringify(l)).not.toMatch(/bookoo|ikape|weber|timemore|grindenstein/i);
    }
  });
});

describe('shake step', () => {
  it('is a plain template with a 15 s timer from the library, in no preset', () => {
    expect(TEMPLATE_KEYS).toContain('shake');
    expect(STEP_LIBRARY.shake.kind).toBe('Shake it');
    expect(libraryStep('shake')).toMatchObject({ id: 'shake', template: 'shake', title: 'Shake it', label: 'Shake', timer: 15 });
    expect(addableTemplates(simple())).toContain('shake');
    for (const p of PRESETS) expect(templates(p.workflow)).not.toContain('shake');
  });
  it('can be added more than once and survives cleaning, timer included', () => {
    let w = addStep(simple(), 'shake').workflow;
    w = addStep(w, 'shake').workflow;
    expect(templates(w).filter((t) => t === 'shake')).toHaveLength(2);
    const clean = normaliseWorkflow(JSON.parse(JSON.stringify(w)), simple());
    expect(clean.steps.filter((s) => s.template === 'shake').map((s) => s.timer)).toEqual([15, 15]);
  });
});

describe('presets', () => {
  it('are valid as they are, with one pull and done last', () => {
    expect(PRESETS.length).toBeGreaterThanOrEqual(3);
    for (const p of PRESETS) {
      expect(validateWorkflow(p.workflow)).toEqual([]);
      expect(templates(p.workflow).filter((t) => t === 'pull')).toHaveLength(1);
      expect(p.workflow.steps.at(-1)!.template).toBe('done');
      expect(new Set(p.workflow.steps.map((s) => s.id)).size).toBe(p.workflow.steps.length);
      expect(normaliseWorkflow(p.workflow, simple())).toEqual(p.workflow);
    }
  });
  it('come in the agreed order', () => {
    expect(PRESETS.map((p) => p.name)).toEqual(['Simple', 'WDT and puck screen', 'Milk drinks']);
    expect(templates(PRESETS[0]!.workflow)).toEqual(['weigh', 'grinder', 'grind', 'tamp', 'pull', 'rinse', 'done']);
    expect(templates(PRESETS[2]!.workflow)).toContain('steam');
  });
});

describe('normalising', () => {
  it('gives the fallback for junk', () => {
    for (const raw of [null, undefined, 3, 'x', [], {}, { steps: 'no' }]) expect(normaliseWorkflow(raw, simple())).toEqual(simple());
  });
  it('drops unknown kinds and non-steps, and says so', () => {
    const r = inspectWorkflow({ steps: [{ template: 'weigh' }, { template: 'laser' }, 4, null, { template: 'tamp' }] });
    expect(templates(r.workflow!)).toEqual(['weigh', 'tamp', 'pull', 'done']);
    expect(r.notes.join(' ')).toMatch(/unknown kind/);
  });
  it('fills missing words from the library and trims and caps strings', () => {
    const w = normaliseWorkflow({ name: '  Mine  ', steps: [{ template: 'tamp', title: '   ', body: undefined, label: 'x'.repeat(50) }, { template: 'custom', title: 'T'.repeat(200), body: ' hi ' }] }, simple());
    expect(w.name).toBe('Mine');
    expect(w.steps[0]!.title).toBe(STEP_LIBRARY.tamp.title);
    expect(w.steps[0]!.body).toBe(STEP_LIBRARY.tamp.body);
    expect(w.steps[0]!.label).toHaveLength(16);
    expect(w.steps[1]!.title).toHaveLength(80);
    expect(w.steps[1]!.body).toBe('hi');
  });
  it('keeps at most one of each smart kind, one pull and a last done', () => {
    const w = normaliseWorkflow({
      steps: [{ template: 'done' }, { template: 'weigh' }, { template: 'weigh', id: 'w2' }, { template: 'grind' }, { template: 'grind' }, { template: 'rinse' }, { template: 'rinse' }, { template: 'steam' }, { template: 'steam' }, { template: 'pull' }, { template: 'pull', id: 'p2' }, { template: 'done', id: 'd2' }],
    }, simple());
    const t = templates(w);
    for (const k of ['weigh', 'grind', 'rinse', 'steam', 'pull', 'done']) expect(t.filter((x) => x === k)).toHaveLength(1);
    expect(t.at(-1)).toBe('done');
  });
  it('adds a missing pull before the rinse', () => {
    const w = normaliseWorkflow({ steps: [{ template: 'weigh' }, { template: 'rinse' }] }, simple());
    expect(templates(w)).toEqual(['weigh', 'pull', 'rinse', 'done']);
  });
  it('makes ids unique and safe', () => {
    const w = normaliseWorkflow({ steps: [{ template: 'custom', id: 'a' }, { template: 'custom', id: 'a' }, { template: 'custom', id: 'bad id!' }, { template: 'custom' }] }, simple());
    const ids = w.steps.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[\w-]+$/);
  });
  it('cleans items and timers (timers only on plain steps)', () => {
    const w = normaliseWorkflow({ steps: [
      { template: 'tamp', items: [' a ', '', 3, 'b'], timer: 30.4 },
      { template: 'custom', items: [], timer: -1 },
      { template: 'weigh', timer: 10 },
      { template: 'knock', timer: 99999 },
    ] }, simple());
    expect(w.steps[0]).toMatchObject({ items: ['a', 'b'], timer: 30 });
    expect(w.steps[1]!.items).toBeUndefined();
    expect(w.steps[1]!.timer).toBeUndefined();
    expect(w.steps[2]!.timer).toBeUndefined();
    expect(w.steps.find((x) => x.template === 'knock')!.timer).toBe(3600);
  });
  it('limits the number of steps without losing pull or done', () => {
    const many = Array.from({ length: 60 }, () => ({ template: 'custom' }));
    const w = normaliseWorkflow({ steps: [...many, { template: 'pull' }] }, simple());
    expect(w.steps.length).toBe(MAX_STEPS);
    expect(templates(w).filter((t) => t === 'pull')).toHaveLength(1);
    expect(w.steps.at(-1)!.template).toBe('done');
  });
  it('is idempotent', () => {
    const once = normaliseWorkflow({ steps: [{ template: 'weigh' }, { template: 'custom', title: 'x' }, { template: 'weigh' }] }, simple());
    expect(normaliseWorkflow(once, simple())).toEqual(once);
    expect(validateWorkflow(once)).toEqual([]);
  });
});

describe('going back', () => {
  it('lets you revisit steps up to and including the pull', () => {
    const w = simple();
    const pull = templates(w).indexOf('pull');
    expect(canGoBack(w, 0)).toBe(false);
    for (let i = 1; i <= pull; i++) expect(canGoBack(w, i)).toBe(true);
    for (let i = pull + 1; i < w.steps.length; i++) expect(canGoBack(w, i)).toBe(false);
  });
  it('carries on after the pull', () => {
    const w = simple();
    expect(w.steps[afterPull(w)]!.template).toBe('rinse');
  });
});

describe('editing', () => {
  it('adds a step before the closing one, with a fresh id', () => {
    const { workflow, id } = addStep(simple(), 'spray');
    expect(id).toBeTruthy();
    expect(templates(workflow).at(-1)).toBe('done');
    expect(workflow.steps.at(-2)!.id).toBe(id);
    const again = addStep(workflow, 'custom');
    const twice = addStep(again.workflow, 'custom');
    expect(new Set(twice.workflow.steps.map((s) => s.id)).size).toBe(twice.workflow.steps.length);
  });
  it('refuses a second smart step', () => {
    const w = simple();
    for (const t of ['weigh', 'grinder', 'grind', 'rinse', 'steam', 'pull', 'done'] as const) {
      const r = addStep(w, t);
      if (t === 'steam') expect(r.id).toBeTruthy();
      else expect(r.id).toBeNull();
    }
    expect(addableTemplates(w)).not.toContain('weigh');
    expect(addableTemplates(w)).toContain('steam');
    expect(addableTemplates(w)).toContain('custom');
    expect(addableTemplates(w)).toContain('tamp');
  });
  it('refuses to go past the limit', () => {
    let w = simple();
    for (let i = 0; i < 40; i++) w = addStep(w, 'custom').workflow;
    expect(w.steps.length).toBe(MAX_STEPS);
  });
  it('removes steps except pull and done', () => {
    const w = simple();
    expect(canRemove(w.steps.find((s) => s.template === 'pull')!)).toBe(false);
    expect(removeStep(w, 'pull')).toBe(w);
    expect(removeStep(w, 'done')).toBe(w);
    expect(templates(removeStep(w, 'tamp'))).not.toContain('tamp');
    expect(removeStep(w, 'nope')).toBe(w);
  });
  it('moves a step, keeping the closing step last', () => {
    const w = simple();
    const moved = moveStep(w, 'tamp', -1);
    expect(templates(moved).slice(0, 4)).toEqual(['weigh', 'grinder', 'tamp', 'grind']);
    expect(moveStep(w, 'weigh', -1)).toBe(w);
    expect(moveStep(w, 'done', -1)).toBe(w);
    const last = w.steps.at(-2)!;
    expect(moveStep(w, last.id, 1)).toBe(w);
  });
  it('updates one step only', () => {
    const w = updateStep(simple(), 'tamp', { title: 'Press', timer: 5 });
    expect(w.steps.find((s) => s.id === 'tamp')).toMatchObject({ title: 'Press', timer: 5 });
    expect(w.steps.find((s) => s.id === 'weigh')!.title).toBe(STEP_LIBRARY.weigh.title);
  });
  it('turns lists into lines and back', () => {
    expect(itemsToLines(['a', 'b'])).toBe('a\nb');
    expect(linesToItems(' a \n\n b ')).toEqual(['a', 'b']);
    expect(linesToItems('  \n ')).toBeUndefined();
  });
});

describe('text', () => {
  it('fills known words and leaves the rest', () => {
    expect(fillText('Weigh {dose} g of {nothing}', { dose: '18.0' })).toBe('Weigh 18.0 g of {nothing}');
  });
  it('formats a countdown', () => {
    expect(timerText(30)).toBe('0:30');
    expect(timerText(29.2)).toBe('0:30');
    expect(timerText(125)).toBe('2:05');
    expect(timerText(-3)).toBe('0:00');
  });
  it('builds a workflow from library steps', () => {
    const w = fromTemplates('x', ['custom', 'custom', 'pull', 'done']);
    expect(new Set(w.steps.map((s) => s.id)).size).toBe(4);
    expect(libraryStep('tamp').id).toBe('tamp');
  });
});
