// Which edition of the skin this is. Everything that differs between the
// personal build (this folder, kept out of the public repo) and the public
// FlimsyDecent build lives behind this one object, so the rest of the code is
// shared byte for byte. The public repo has its own copy of this folder
// (editions/public/src/edition in the personal repo).

import type { Component } from 'svelte';
import type { SceneSet } from '../features/guide/scenes';
import { PRESETS, type WorkflowPreset } from '../lib/workflowPresets';
import { FLIMSY_BEETS } from './presets';

export interface Edition {
  id: 'personal' | 'public';
  /** Extra screensaver art shown instead of the clock, with its Settings toggle (theme.halloween); none = no toggle. */
  screensaverExtra?: { label: string; note: string; load: () => Promise<{ default: Component }> };
  guide: {
    /** Ready-made Guide me workflows; the first is what a guide starts as. */
    presets: WorkflowPreset[];
    /** The edition's own illustrations (the shared generic ones fill the gaps). */
    scenes?: () => Promise<SceneSet>;
  };
}

export const EDITION: Edition = {
  id: 'personal',
  screensaverExtra: {
    label: 'Halloween screensaver',
    note: 'Ghosts drift over your screensaver photo instead of the clock.',
    load: () => import('./Ghosts.svelte'),
  },
  guide: {
    presets: [FLIMSY_BEETS, ...PRESETS],
    scenes: () => import('./scenes').then((m) => m.personalScenes()),
  },
};
