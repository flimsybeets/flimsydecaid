// Ready-made Guide me workflows. The first one is the public edition's
// default; the personal edition brings its own (src/edition/presets.ts).

import { libraryStep, type TemplateKey, type Workflow } from './workflow';

export interface WorkflowPreset {
  id: string;
  name: string;
  /** One line for the chooser. */
  description: string;
  workflow: Workflow;
}

/** A workflow made of library steps, in this order (ids are the template names). */
export function fromTemplates(name: string, keys: TemplateKey[]): Workflow {
  const ids: string[] = [];
  const steps = keys.map((k) => {
    const s = libraryStep(k, ids);
    ids.push(s.id);
    return s;
  });
  return { version: 1, name, steps };
}

export const PRESETS: WorkflowPreset[] = [
  {
    id: 'simple',
    name: 'Simple',
    description: 'Weigh, grind, tamp, pull, rinse.',
    workflow: fromTemplates('Simple', ['weigh', 'grinder', 'grind', 'tamp', 'pull', 'rinse', 'done']),
  },
  {
    id: 'wdt',
    name: 'WDT and puck screen',
    description: 'Adds spraying, stirring, levelling, a puck screen and knocking out.',
    workflow: fromTemplates('WDT and puck screen', ['weigh', 'spray', 'grinder', 'grind', 'wdt', 'distribute', 'tamp', 'puckscreen', 'pull', 'knock', 'rinse', 'done']),
  },
  {
    id: 'milk',
    name: 'Milk drinks',
    description: 'The simple routine, then steaming the milk.',
    workflow: fromTemplates('Milk drinks', ['weigh', 'grinder', 'grind', 'tamp', 'pull', 'rinse', 'steam', 'done']),
  },
];

/** A copy that can be edited without touching the preset. */
export const cloneWorkflow = (w: Workflow): Workflow => JSON.parse(JSON.stringify(w)) as Workflow;
