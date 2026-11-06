// Which edition of the skin this is. Everything that differs between the
// personal build (this folder, kept out of the public repo) and the public
// FlimsyDecent build lives behind this one object, so the rest of the code is
// shared byte for byte. The public repo has its own copy of this folder
// (editions/public/src/edition in the personal repo).

import type { Component } from 'svelte';

export interface Edition {
  id: 'personal' | 'public';
  /** Extra screensaver art behind the Halloween toggle; the toggle is hidden without it. */
  screensaverExtra?: () => Promise<{ default: Component }>;
}

export const EDITION: Edition = {
  id: 'personal',
  screensaverExtra: () => import('./Ghosts.svelte'),
};
