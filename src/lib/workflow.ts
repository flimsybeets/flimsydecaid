// "Guide me" steps as data: an ordered list of steps, each made from a
// template (a kind of step the guide knows how to show). Smart templates
// have behaviour of their own (the scale, the machine's state); plain ones
// show a title, a body, an optional ordered list and an optional timer.
// Stored in the KV store as one JSON document; this file is the rules for it.

export const SMART_KEYS = ['weigh', 'grinder', 'grind', 'pull', 'rinse', 'steam', 'done'] as const;
export const PLAIN_KEYS = ['spray', 'wdt', 'distribute', 'funnel', 'basket', 'tamp', 'puckscreen', 'paper', 'minerals', 'knock', 'custom'] as const;
export const TEMPLATE_KEYS = [...SMART_KEYS, ...PLAIN_KEYS] as const;
export type TemplateKey = (typeof TEMPLATE_KEYS)[number];

export const WORKFLOW_KEY = 'guideWorkflow';
export const stepPhotoKey = (stepId: string) => `guidePhoto:${stepId}`;

export interface WorkflowStep {
  id: string;
  template: TemplateKey;
  title: string;
  body: string;
  /** Short name on the progress rail. */
  label: string;
  /** An ordered sub-list, e.g. the grind beats. */
  items?: string[];
  /** Seconds. Plain steps only: shows a start / countdown button. */
  timer?: number;
}

export interface Workflow {
  version: 1;
  name: string;
  steps: WorkflowStep[];
}

/** Same thing under a name that doesn't clash with Decaid's own workflow. */
export type GuideWorkflow = Workflow;

export const MAX_STEPS = 30;
export const MAX_ITEMS = 12;
export const MAX_TIMER = 3600;
const LIMITS = { name: 60, title: 80, body: 400, label: 16, item: 120, id: 40 };

/** Smart steps that can appear once at most. Pull and done are exactly once and are handled separately. */
export const ONCE_KEYS: readonly TemplateKey[] = ['weigh', 'grinder', 'grind', 'rinse', 'steam'];
/** Not removable. */
export const REQUIRED_KEYS: readonly TemplateKey[] = ['pull', 'done'];

export const isSmart = (t: TemplateKey) => (SMART_KEYS as readonly string[]).includes(t);
export const isTemplateKey = (v: unknown): v is TemplateKey => typeof v === 'string' && (TEMPLATE_KEYS as readonly string[]).includes(v);

export interface LibraryEntry {
  /** Name of the kind of step, for the "Add a step" list. */
  kind: string;
  title: string;
  body: string;
  label: string;
  items?: string[];
}

/**
 * Defaults per template. In title and body, {dose} (grams), {beans} ("beans
 * of Name"), {coffee}, {grind}, {source} (where the grind setting came from)
 * and {start} ("start", or "press brew" on a group head controller) are
 * filled in by the guide.
 */
export const STEP_LIBRARY: Record<TemplateKey, LibraryEntry> = {
  weigh: { kind: 'Weigh the beans', title: 'Weigh {dose} g', body: 'Dosing cup on the scale and tare, then add {beans}.', label: 'Weigh' },
  grinder: { kind: 'Set the grinder', title: 'Set the grinder to {grind}', body: '{source}', label: 'Grinder' },
  grind: {
    kind: 'Grind', title: 'Grind', body: 'All {dose} g.', label: 'Grind',
    items: ['Turn on the grinder', 'Add the beans', 'Wait for it to finish grinding', 'Turn it off', 'Tap the bellows to push out the last grounds'],
  },
  pull: { kind: 'Pull the shot', title: 'Lock in and {start}', body: 'Lock the portafilter in, and sit the cup on the scales under the portafilter. Then press brew to start.', label: 'Pull' },
  rinse: { kind: 'Rinse the group', title: 'Rinse the group and portafilter', body: 'Press flush and hold the empty portafilter under the water to rinse the basket.', label: 'Rinse' },
  steam: { kind: 'Steam milk', title: 'Steam the milk', body: 'Purge the wand, then press the steam button and heat the milk.', label: 'Steam' },
  done: { kind: 'Summary', title: 'Enjoy', body: '', label: 'Enjoy' },
  spray: { kind: 'Spray the beans', title: 'Spray the beans', body: 'One or two sprays from a distance to gently mist the beans.', label: 'Spray' },
  wdt: { kind: 'Stir with a WDT tool', title: 'Stir with the WDT tool', body: 'Break up clumps with a few slow circles, all the way down.', label: 'Stir' },
  distribute: { kind: 'Level the bed', title: 'Level the bed', body: 'Tap the side of the portafilter, then level the grounds with a gentle sweep.', label: 'Level' },
  funnel: { kind: 'Funnel', title: 'Funnel on, grounds in', body: 'Put the funnel on the portafilter and tip the grounds in.', label: 'Funnel' },
  basket: { kind: 'Check the basket', title: 'Check the basket', body: 'Make sure the right basket is in the portafilter.', label: 'Basket' },
  tamp: { kind: 'Tamp', title: 'Tamp', body: 'Funnel off, then press the tamper down level.', label: 'Tamp' },
  puckscreen: { kind: 'Puck screen', title: 'Puck screen on', body: 'Lay the puck screen flat on the puck.', label: 'Screen' },
  paper: { kind: 'Paper filter', title: 'Paper on top', body: 'Lay a paper filter flat on the tamped puck.', label: 'Paper' },
  minerals: { kind: 'Add minerals', title: 'Add minerals', body: 'Add your minerals to the water or the cup.', label: 'Minerals' },
  knock: { kind: 'Knock out the puck', title: 'Knock out the puck', body: 'Into the knock box, and a wipe of the basket while you are there.', label: 'Knock' },
  custom: { kind: 'Your own step', title: 'New step', body: '', label: 'Step' },
};

/** Some templates need no more than one of them in a guide. */
export const isOnce = (t: TemplateKey) => ONCE_KEYS.includes(t) || REQUIRED_KEYS.includes(t);

const clip = (v: unknown, max: number): string => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** A fresh id not in `taken`. */
export function freshId(taken: Iterable<string>, base = 's'): string {
  const used = new Set(taken);
  for (let i = 0; i < 1000; i++) {
    const id = `${base}-${Math.random().toString(36).slice(2, 7)}`;
    if (!used.has(id)) return id;
  }
  return `${base}-${used.size + 1}`;
}

/** A step made from the library. Smart and ordinary templates use their name as the id when it is free. */
export function libraryStep(template: TemplateKey, taken: Iterable<string> = [], overrides: Partial<WorkflowStep> = {}): WorkflowStep {
  const lib = STEP_LIBRARY[template];
  const used = new Set(taken);
  const id = overrides.id ?? (template !== 'custom' && !used.has(template) ? template : freshId(used, template === 'custom' ? 's' : template));
  const step: WorkflowStep = { id, template, title: lib.title, body: lib.body, label: lib.label };
  if (lib.items) step.items = [...lib.items];
  return { ...step, ...overrides, id };
}

export interface Inspection {
  /** The cleaned workflow, or null when `raw` is not a workflow at all. */
  workflow: Workflow | null;
  /** Things that were wrong with it and fixed or dropped. */
  notes: string[];
}

/** Clean up anything that claims to be a workflow: drop junk, fill gaps, keep the rules. */
export function inspectWorkflow(raw: unknown): Inspection {
  const notes: string[] = [];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { workflow: null, notes: ['That is not a Guide me workflow.'] };
  const r = raw as Record<string, unknown>;
  if (!Array.isArray(r.steps)) return { workflow: null, notes: ['It has no list of steps.'] };

  const ids = new Set<string>();
  const seen = new Set<TemplateKey>();
  const steps: WorkflowStep[] = [];
  r.steps.forEach((s, n) => {
    const at = `Step ${n + 1}`;
    if (!s || typeof s !== 'object') { notes.push(`${at} was not a step, skipped.`); return; }
    const o = s as Record<string, unknown>;
    if (!isTemplateKey(o.template)) { notes.push(`${at} has an unknown kind${typeof o.template === 'string' ? ` "${o.template.slice(0, 20)}"` : ''}, skipped.`); return; }
    const template = o.template;
    if (isOnce(template) && seen.has(template)) { notes.push(`${at}: only one "${STEP_LIBRARY[template].kind}" step is allowed, skipped.`); return; }
    let id = clip(o.id, LIMITS.id);
    if (!/^[\w-]+$/.test(id) || ids.has(id)) { id = isOnce(template) && !ids.has(template) ? template : freshId(ids, template === 'custom' ? 's' : template); if (typeof o.id === 'string' && o.id) notes.push(`${at} got a new id.`); }
    const lib = STEP_LIBRARY[template];
    const step: WorkflowStep = {
      id,
      template,
      title: clip(o.title, LIMITS.title) || lib.title,
      body: typeof o.body === 'string' ? o.body.trim().slice(0, LIMITS.body) : lib.body,
      label: clip(o.label, LIMITS.label) || lib.label,
    };
    if (Array.isArray(o.items)) {
      const items = o.items.map((i) => clip(i, LIMITS.item)).filter(Boolean).slice(0, MAX_ITEMS);
      if (items.length) step.items = items;
    }
    if (typeof o.timer === 'number' && Number.isFinite(o.timer) && o.timer >= 1 && !isSmart(template)) step.timer = Math.min(MAX_TIMER, Math.round(o.timer));
    ids.add(id);
    seen.add(template);
    steps.push(step);
  });

  // Exactly one pull, and done last.
  const doneAt = steps.findIndex((s) => s.template === 'done');
  const done = doneAt >= 0 ? steps.splice(doneAt, 1)[0]! : libraryStep('done', ids);
  if (doneAt < 0) notes.push('Added the closing "Enjoy" step.');
  if (!steps.some((s) => s.template === 'pull')) {
    const at = steps.findIndex((s) => s.template === 'rinse' || s.template === 'steam' || s.template === 'knock');
    steps.splice(at < 0 ? steps.length : at, 0, libraryStep('pull', ids));
    notes.push('Added the "Pull the shot" step.');
  }
  // Over the limit: the end goes first, never the pull.
  while (steps.length + 1 > MAX_STEPS) {
    let i = steps.length - 1;
    while (i > 0 && steps[i]!.template === 'pull') i--;
    notes.push(`Too many steps (the limit is ${MAX_STEPS}): "${steps[i]!.title}" dropped.`);
    steps.splice(i, 1);
  }
  steps.push(done);

  const name = clip(r.name, LIMITS.name) || 'My guide';
  return { workflow: { version: 1, name, steps }, notes };
}

/** Problems found in `raw` (empty = fine as it is). */
export function validateWorkflow(raw: unknown): string[] {
  return inspectWorkflow(raw).notes;
}

/** Parse a stored workflow, or give `fallback` when there is none or it is junk. */
export function normaliseWorkflow(raw: unknown, fallback: Workflow): Workflow {
  return inspectWorkflow(raw).workflow ?? fallback;
}

/** Steps up to and including the pull can be revisited; after the shot the order follows the machine. */
export function canGoBack(w: Workflow, index: number): boolean {
  const pull = w.steps.findIndex((s) => s.template === 'pull');
  return index > 0 && index <= pull;
}

/** The step to go to when the shot ends: the one after the pull. */
export function afterPull(w: Workflow): number {
  const pull = w.steps.findIndex((s) => s.template === 'pull');
  return Math.min(w.steps.length - 1, pull + 1);
}

/** Templates the "Add a step" list offers: ordinary ones always, once-only ones while missing. */
export function addableTemplates(w: Workflow): TemplateKey[] {
  return TEMPLATE_KEYS.filter((t) => !isOnce(t) || !w.steps.some((s) => s.template === t));
}

const doneIndex = (w: Workflow) => w.steps.findIndex((s) => s.template === 'done');

/** Add a step (from the library) before the closing one, or at `at`. Once-only kinds already present are refused. */
export function addStep(w: Workflow, template: TemplateKey, at?: number): { workflow: Workflow; id: string | null } {
  if (isOnce(template) && w.steps.some((s) => s.template === template)) return { workflow: w, id: null };
  if (w.steps.length >= MAX_STEPS) return { workflow: w, id: null };
  const step = libraryStep(template, w.steps.map((s) => s.id));
  const pos = Math.max(0, Math.min(at ?? doneIndex(w), doneIndex(w)));
  const steps = [...w.steps];
  steps.splice(pos, 0, step);
  return { workflow: { ...w, steps }, id: step.id };
}

export function canRemove(step: WorkflowStep): boolean {
  return !REQUIRED_KEYS.includes(step.template);
}

export function removeStep(w: Workflow, id: string): Workflow {
  const s = w.steps.find((x) => x.id === id);
  if (!s || !canRemove(s)) return w;
  return { ...w, steps: w.steps.filter((x) => x.id !== id) };
}

/** Move a step one place earlier (-1) or later (+1). The closing step stays last. */
export function moveStep(w: Workflow, id: string, by: -1 | 1): Workflow {
  const i = w.steps.findIndex((x) => x.id === id);
  const j = i + by;
  if (i < 0 || w.steps[i]!.template === 'done' || j < 0 || j >= doneIndex(w)) return w;
  const steps = [...w.steps];
  [steps[i], steps[j]] = [steps[j]!, steps[i]!];
  return { ...w, steps };
}

export function updateStep(w: Workflow, id: string, patch: Partial<Omit<WorkflowStep, 'id' | 'template'>>): Workflow {
  return { ...w, steps: w.steps.map((s) => (s.id === id ? { ...s, ...patch } : s)) };
}

/** Fill {tokens} in a step's title or body. Unknown tokens are left as typed. */
export function fillText(text: string, vars: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m);
}

/** m:ss for a countdown. */
export function timerText(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Photos are keyed by step id: ids of the steps that went away have photos nobody can reach. */
export function orphanedStepIds(before: Workflow, after: Workflow): string[] {
  const keep = new Set(after.steps.map((s) => s.id));
  return before.steps.filter((s) => !keep.has(s.id)).map((s) => s.id);
}

/** Sub-list as one item per line, for the editor, and back. */
export const itemsToLines = (items?: string[]) => (items ?? []).join('\n');
export function linesToItems(text: string): string[] | undefined {
  const items = text.split('\n').map((l) => l.trim().slice(0, LIMITS.item)).filter(Boolean).slice(0, MAX_ITEMS);
  return items.length ? items : undefined;
}

export const workflowEquals = (a: Workflow, b: Workflow) => JSON.stringify(a) === JSON.stringify(b);
