// What an illustration set looks like. A set is one lazy chunk of generated
// SVG scenes keyed by step template (src/edition/guideScenes.ts for the
// personal art, genericScenes.ts for the shared art).

export interface GuideScene {
  vb: string;
  /** Static SVG markup; '<!--@-->' marks where the live parts go. */
  svg: string;
  /** Plane transform + position of the scale's left display (live weight). */
  lcd?: string;
  lcdAt?: [number, number];
  /** Where the grind setting readout sits. */
  num?: [number, number];
}

export interface SceneSet {
  /** The root svg gets `set-<id>`, which scopes the set's own animation CSS. */
  id: string;
  /** By step template key. */
  SCENES: Record<string, GuideScene>;
  /** Gradients shared by every scene (rendered once per svg, in <defs>). */
  COMMON_DEFS: string;
}
