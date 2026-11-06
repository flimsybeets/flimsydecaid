// The personal edition's guide art: the generated frosted-glass scenes, with
// their animation CSS. The generator keys them by the old step names.

import type { SceneSet } from '../features/guide/scenes';

const KEYS: Record<string, string> = { dial: 'grinder', start: 'pull' };

export async function personalScenes(): Promise<SceneSet> {
  const [m] = await Promise.all([import('./guideScenes'), import('./guideArt.css')]);
  return {
    id: 'flimsy',
    COMMON_DEFS: m.COMMON_DEFS,
    SCENES: Object.fromEntries(Object.entries(m.SCENES).map(([k, v]) => [KEYS[k] ?? k, v])),
  };
}
