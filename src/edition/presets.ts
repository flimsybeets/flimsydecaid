// The personal edition's own Guide me routine: exactly the 13 steps the
// guide had before steps became data, with the same wording.

import { libraryStep, type TemplateKey, type Workflow, type WorkflowStep } from '../lib/workflow';
import type { WorkflowPreset } from '../lib/workflowPresets';

const make = (template: TemplateKey, over: Partial<WorkflowStep> = {}): WorkflowStep => libraryStep(template, [], { id: template, ...over });

const flimsyBeets: Workflow = {
  version: 1,
  name: 'FlimsyBeets',
  steps: [
    make('weigh'),
    make('spray'),
    make('grinder'),
    make('grind'),
    make('basket', { title: 'Convex basket in', body: 'Check the IKAPE convex basket is in the portafilter.' }),
    make('funnel', {
      title: 'Funnel, cup, then tap',
      body: 'Funnel on the portafilter, and sit the dosing cup on the funnel. Pull the bell out so the grounds drop in, then tap the portafilter with the funnel still on.',
    }),
    make('tamp', { body: 'Funnel off, then press the tamper down.' }),
    make('paper'),
    make('minerals', { title: 'One drop of minerals', body: 'Shake the bottle, then one drop from the eyedropper into the cup.' }),
    make('pull'),
    make('knock', { body: "Into the knock box, and a wipe of the basket while you're there." }),
    make('rinse'),
    make('done'),
  ],
};

export const FLIMSY_BEETS: WorkflowPreset = {
  id: 'flimsybeets',
  name: 'FlimsyBeets',
  description: 'The full routine with the convex basket, funnel, paper and minerals.',
  workflow: flimsyBeets,
};
