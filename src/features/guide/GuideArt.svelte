<script lang="ts" module>
  import { EDITION } from '../../edition';
  import type { SceneSet } from './scenes';

  // The scene data (~45 kB gzipped for the personal set) is its own chunk,
  // fetched once when the guide first opens: the edition's own art first,
  // the shared generic art behind it.
  let sets = $state<{ edition: SceneSet | null; generic: SceneSet | null } | null>(null);
  let loading: Promise<unknown> | null = null;
  const loadGeneric = (): Promise<SceneSet | null> =>
    Promise.all([import('./genericScenes'), import('./genericArt.css')])
      .then(([m]) => ({ id: (m as { id?: string }).id ?? 'generic', SCENES: m.SCENES, COMMON_DEFS: m.COMMON_DEFS }))
      .catch(() => null);
  const load = () => (loading ??= Promise.all([EDITION.guide.scenes?.().catch(() => null) ?? null, loadGeneric()]).then(([edition, generic]) => (sets = { edition, generic })));
</script>

<script lang="ts">
  import { app } from '../../state/app.svelte';
  import type { WeighState } from '../../lib/guide';
  import type { TemplateKey } from '../../lib/workflow';
  import { dialArc, DIAL_PER, DIAL_START } from '../../lib/dialArc';
  import StepIcon from './StepIcon.svelte';

  // One animated scene per guide step. Which picture: the step's own photo,
  // else the edition's scene for its template, else the shared generic
  // scene, else a plain icon. The static drawings are generated at build
  // time (scripts/guide-art for the personal set, scripts/generic-art for
  // the shared one); their animation CSS is a plain global stylesheet per
  // set, scoped by the `set-<id>` class on the root svg.
  // No filters or drop shadows (weak tablet GPU). Live values (scale weight,
  // grind setting, water running) are drawn here, by what the scene offers
  // (`lcd`, `num`), not by which step it is.

  let {
    sceneKey,
    stepId,
    weight = null,
    weighState = 'empty',
    grind = null,
    active = false,
    still = false,
    photoUrl,
  }: {
    sceneKey: TemplateKey;
    stepId: string;
    weight?: number | null;
    weighState?: WeighState;
    grind?: string | null;
    /** Rinse / steam: the machine is running. */
    active?: boolean;
    /** A static frame (previews, thumbnails): no animation, like reduced motion. */
    still?: boolean;
    /** Use this picture (null = none) instead of the saved one, and don't fetch it: drafts and thumbnails. */
    photoUrl?: string | null;
  } = $props();

  load();
  $effect(() => { if (photoUrl === undefined) void app.loadStepPhoto(stepId); });
  const photo = $derived(photoUrl !== undefined ? photoUrl : (app.stepPhotos[stepId] ?? null));
  const photoKnown = $derived(photoUrl !== undefined || stepId in app.stepPhotos);
  const found = $derived.by(() => {
    if (!sets) return null;
    for (const set of [sets.edition, sets.generic]) {
      const scene = set?.SCENES[sceneKey];
      if (set && scene) return { set, scene };
    }
    return null;
  });
  const scene = $derived(found?.scene);
  const parts = $derived(scene ? scene.svg.split('<!--@-->') : ['']);

  // Live weight in 5x7 dot-matrix digits, like the scale's own display.
  const FONT: Record<string, number[]> = {
    0: [14, 17, 19, 21, 25, 17, 14], 1: [4, 12, 4, 4, 4, 4, 14], 2: [14, 17, 1, 2, 4, 8, 31], 3: [31, 2, 4, 2, 1, 17, 14],
    4: [2, 6, 10, 18, 31, 2, 2], 5: [31, 16, 30, 1, 1, 17, 14], 6: [6, 8, 16, 30, 17, 17, 14], 7: [31, 1, 2, 4, 8, 8, 8],
    8: [14, 17, 17, 14, 17, 17, 14], 9: [14, 17, 17, 15, 1, 2, 12], '-': [0, 0, 0, 31, 0, 0, 0],
  };
  const lcdText = $derived(weight == null ? '-.-' : weight.toFixed(1));
  const lcdDots = $derived.by(() => {
    const cols: number[][] = [];
    for (const ch of lcdText) {
      if (ch === '.') cols.push([6]);
      else {
        const g = FONT[ch];
        if (!g) continue;
        for (let c = 0; c < 5; c++) cols.push(g.flatMap((row, ri) => ((row >> (4 - c)) & 1 ? [ri] : [])));
      }
      cols.push([]);
    }
    cols.pop();
    const [cx, cy] = scene?.lcdAt ?? [0, 0];
    const pitch = Math.min(1.15, 23 / Math.max(1, cols.length - 1));
    const x0 = cx - ((cols.length - 1) * pitch) / 2, y0 = cy - 3 * pitch;
    return { pitch, pts: cols.flatMap((col, i) => col.map((ri) => [x0 + i * pitch, y0 + ri * pitch])) };
  });

  // Grinder dial: 0 (fine) to 90 (coarse) over 300 degrees; the ring turns
  // so the chosen number sits under the fixed pointer, and the glowing arc
  // (drawn in the ring's frame from 0, path length 90) is cut to the setting.
  const arc = $derived(dialArc(grind));
  const gv = $derived(arc ? arc.value : null);
  const dialTo = $derived(arc ? arc.rotate : -DIAL_START - DIAL_PER * 14);
  const dashFrom = $derived(arc ? Math.max(0, arc.dash - 50 / DIAL_PER) : 0);
</script>

{#if photo}
  <img class="photo" src={photo} alt="" />
{:else if found && scene}
  <svg viewBox={scene.vb} class="art set-{found.set.id} {sceneKey} ws-{weighState}" class:on={active} class:still style="--dial: {dialTo}deg; --arc: {arc ? arc.dash : 0}; --arc-from: {dashFrom}" class:noarc={!arc} aria-hidden="true">
    <defs>{@html found.set.COMMON_DEFS}</defs>
    {@html parts[0]}
    {#if scene.lcd}
      <g transform={scene.lcd} class="lcd {weighState}">
        {#each lcdDots.pts as [x, y], i (i)}<circle cx={x} cy={y} r={lcdDots.pitch * 0.4} />{/each}
      </g>
    {/if}
    {#if scene.num}
      <g class="dial-num" transform="translate({scene.num[0]} {scene.num[1]})">
        <rect x="-22" y="-15" width="44" height="30" rx="15" />
        <text y="1" text-anchor="middle" dominant-baseline="central" class:small={gv === null || (grind ?? '').length > 4}>{gv === null ? (grind ?? '?') : grind}</text>
      </g>
    {/if}
    {#if parts[1] != null}{@html parts[1]}{/if}
  </svg>
{:else if sets && photoKnown}
  <StepIcon kind={sceneKey} />
{/if}

<style>
  .photo { width: 100%; height: 100%; min-height: 0; object-fit: cover; border-radius: 18px; display: block; }
  .art {
    --acc: #8fd3c0;
    width: 100%;
    height: 100%;
    overflow: visible;
  }
  .art :global(text) { font-family: var(--font); font-variant-numeric: tabular-nums; }
  .art :global(path), .art :global(circle), .art :global(ellipse) { stroke-linecap: round; stroke-linejoin: round; }

  /* Live overlays the scenes ask for */
  .lcd circle { fill: var(--paper); }
  .lcd.under circle { fill: var(--warn); }
  .lcd.over circle { fill: var(--stop); }
  .lcd.ok circle { fill: var(--go); }
  .dial-num rect { fill: rgb(4 14 17 / 0.72); stroke: var(--acc); stroke-width: 1.4; }
  .dial-num text { fill: var(--acc); font-size: 17px; font-weight: 800; }
  .dial-num text.small { font-size: 11px; }

  .photo { background: rgb(0 0 0 / 0.2); }
  .art.still :global(*) { animation: none !important; transition: none !important; }
  .art.still :global(.fx) { display: none; }
  @media (prefers-reduced-motion: reduce) {
    .art :global(*) { animation: none !important; transition: none !important; }
    .art :global(.fx) { display: none; }
  }
</style>
