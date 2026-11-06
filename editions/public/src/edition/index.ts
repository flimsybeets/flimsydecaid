// Which edition of the skin this is. This is the public FlimsyDecent edition:
// the shared Guide me presets and the generic illustrations, no extra
// screensaver art. Everything else in the code is the same in every edition.

import type { Component } from 'svelte';
import type { SceneSet } from '../features/guide/scenes';
import { PRESETS, type WorkflowPreset } from '../lib/workflowPresets';

export interface Edition {
  id: 'personal' | 'public';
  /** The skin's name, as Decaid shows it (e.g. the back link from Decaid's settings). */
  name: string;
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
  id: 'public',
  name: 'FlimsyDecent',
  guide: { presets: PRESETS },
};
