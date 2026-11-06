// Which edition of the skin this is. Everything that differs between the
// personal build (this folder, kept out of the public repo) and the public
// FlimsyDecent build lives behind this one object, so the rest of the code is
// shared byte for byte. The public repo has its own copy of this folder
// (editions/public/src/edition in the personal repo).

import type { Component } from 'svelte';

export interface Edition {
  id: 'personal' | 'public';
  /** Extra screensaver art shown instead of the clock, with its Settings toggle (theme.halloween); none = no toggle. */
  screensaverExtra?: { label: string; note: string; load: () => Promise<{ default: Component }> };
}

export const EDITION: Edition = {
  id: 'personal',
  screensaverExtra: {
    label: 'Halloween screensaver',
    note: 'Ghosts drift over your screensaver photo instead of the clock.',
    load: () => import('./Ghosts.svelte'),
  },
};
