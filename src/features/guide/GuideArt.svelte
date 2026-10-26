<script lang="ts" module>
  import type { GuideScene } from './guideScenes';
  import type { GuideStepId as Step } from '../../lib/guide';

  // The scene data (~45 kB gzipped) is its own chunk, fetched once when the
  // guide first opens.
  type Data = { SCENES: Partial<Record<Step, GuideScene>>; COMMON_DEFS: string };
  let loaded = $state<Data | null>(null);
  let loading: Promise<unknown> | null = null;
  const load = () => (loading ??= import('./guideScenes').then((m) => (loaded = m)));
</script>

<script lang="ts">
  import type { GuideStepId, WeighState } from '../../lib/guide';

  // One animated "frosted glass objects" scene per guide step. The static
  // drawing is generated at build time (scripts/guide-art/build.cjs): real
  // millimetre models in one orthographic 3/4 projection, so the shared
  // objects (scale, cups, portafilter, grinder, DE1) match across scenes.
  // No filters or drop shadows (weak tablet GPU); everything moves with
  // transform or opacity in the CSS below, keyed on the generated k-* classes.
  // Live values (scale weight, grind setting, rinse running) are drawn here.

  let {
    step,
    weight = null,
    weighState = 'empty',
    grind = null,
    active = false,
  }: {
    step: GuideStepId;
    weight?: number | null;
    weighState?: WeighState;
    grind?: string | null;
    /** Rinse: water running. */
    active?: boolean;
  } = $props();

  load();
  const scene = $derived(loaded?.SCENES[step]);
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
    const pitch = Math.min(0.9, 22 / Math.max(1, cols.length - 1));
    const x0 = cx - ((cols.length - 1) * pitch) / 2, y0 = cy - 3 * pitch;
    return { pitch, pts: cols.flatMap((col, i) => col.map((ri) => [x0 + i * pitch, y0 + ri * pitch])) };
  });

  // Grinder dial: 0 (fine) to 90 (coarse) over 300 degrees; the ring turns
  // so the chosen number sits under the fixed pointer.
  const DIAL_START = -150;
  const DIAL_PER = 300 / 90;
  const gv = $derived.by(() => {
    const n = grind == null ? NaN : parseFloat(grind);
    return Number.isFinite(n) && n >= 0 && n <= 90 ? n : null;
  });
  const dialTo = $derived(-DIAL_START - DIAL_PER * (gv ?? 14));
</script>

{#if scene}
  <svg viewBox={scene.vb} class="art {step} ws-{weighState}" class:on={active} style="--dial: {dialTo}deg" aria-hidden="true">
    <defs>{@html loaded?.COMMON_DEFS ?? ''}</defs>
    {@html parts[0]}
    {#if step === 'weigh' && scene.lcd}
      <g transform={scene.lcd} class="lcd {weighState}">
        {#each lcdDots.pts as [x, y], i (i)}<circle cx={x} cy={y} r={lcdDots.pitch * 0.36} />{/each}
      </g>
    {:else if step === 'dial' && scene.num}
      <g class="dial-num" transform="translate({scene.num[0]} {scene.num[1]})">
        <rect x="-22" y="-15" width="44" height="30" rx="15" />
        <text y="1" text-anchor="middle" dominant-baseline="central" class:small={gv === null || (grind ?? '').length > 4}>{gv === null ? (grind ?? '?') : grind}</text>
      </g>
    {/if}
    {#if parts[1] != null}{@html parts[1]}{/if}
  </svg>
{/if}

<style>
  .art {
    --acc: #8fd3c0;
    width: 100%;
    height: 100%;
    overflow: visible;
  }
  .art :global(text) { font-family: var(--font); font-variant-numeric: tabular-nums; }
  .art :global(path), .art :global(circle), .art :global(ellipse) { stroke-linecap: round; stroke-linejoin: round; }
  .art :global(.bp) { stroke: rgb(238 243 239 / 0.42); stroke-width: 1; fill: none; }
  .art :global(.bs) { stroke: rgb(238 243 239 / 0.2); stroke-width: 0.9; fill: none; }
  .art :global(.bh) { stroke: rgb(255 255 255 / 0.62); stroke-width: 1.6; fill: none; }
  .art :global(.ic) { fill: none; stroke: rgb(238 243 239 / 0.8); stroke-width: 1.1; vector-effect: non-scaling-stroke; }
  .art :global(.as) { fill: none; stroke: var(--acc); stroke-width: 1.4; }
  .art :global(.af) { fill: var(--acc); }

  .art.weigh { --acc: rgb(var(--accent)); }
  .art.spray, .art.minerals, .art.rinse { --acc: var(--g-flow); }
  .art.dial { --acc: var(--warn); }
  .art.grind, .art.funnel, .art.knock, .art.done { --acc: #e2a86c; }
  .art.basket, .art.tamp, .art.paper, .art.start { --acc: var(--go); }

  /* weigh: beans fall in until the dose is right; live weight on the display */
  .lcd circle { fill: var(--paper); }
  .lcd.under circle { fill: var(--warn); }
  .lcd.over circle { fill: var(--stop); }
  .lcd.ok circle { fill: var(--go); }
  .art :global(.k-beans) { opacity: 0; transition: opacity 300ms ease; }
  .art:not(.ws-empty) :global(.k-beans) { opacity: 1; }
  .art.ws-ok :global(.k-fall) { opacity: 0; }
  .art :global(.k-drop) { opacity: 0; animation: k-drop 2.2s cubic-bezier(.5, 0, .9, .6) infinite; }
  .art :global(.k-drop.d1) { animation-delay: 0.4s; }
  .art :global(.k-drop.d2) { animation-delay: 0.8s; }
  .art :global(.k-drop.d3) { animation-delay: 1.2s; }
  .art :global(.k-drop.d4) { animation-delay: 1.6s; }
  @keyframes k-drop { 0% { translate: 0 0; opacity: 0; } 12% { opacity: 1; } 75% { opacity: 1; } 100% { translate: 0 150px; opacity: 0; } }

  /* spray: two pumps, a soft mist drifts onto the beans */
  .art :global(.k-pump) { animation: k-pump 5s ease-in-out infinite; }
  @keyframes k-pump { 0%, 8%, 16%, 22%, 30%, 100% { translate: 0 0; } 11%, 25% { translate: 0 3px; } }
  .art :global(.k-mist circle) { opacity: 0; transform-box: fill-box; transform-origin: center; animation: k-mist 5s cubic-bezier(.2, .6, .4, 1) infinite; animation-delay: calc(var(--i) * 0.07s); }
  @keyframes k-mist { 0%, 10% { opacity: 0; transform: translate(0, 0) scale(0.3); } 16% { opacity: 1; } 50% { opacity: 0; transform: translate(var(--dx), var(--dy)) scale(1.5); } 100% { opacity: 0; transform: translate(var(--dx), var(--dy)) scale(1.5); } }
  .art :global(.k-dew) { animation: k-dew 5s ease infinite; }
  @keyframes k-dew { 0%, 30% { opacity: 0; } 45%, 90% { opacity: 1; } 100% { opacity: 0; } }

  /* dial: the ring turns until the setting sits under the pointer */
  .art :global(.k-dial) { transform: rotate(var(--dial)); animation: k-dial 6s cubic-bezier(.45, 0, .2, 1) infinite; }
  @keyframes k-dial { 0%, 8% { transform: rotate(calc(var(--dial) + 50deg)); } 45%, 100% { transform: rotate(var(--dial)); } }
  .dial-num rect { fill: rgb(4 14 17 / 0.72); stroke: var(--acc); stroke-width: 1.4; }
  .dial-num text { fill: var(--acc); font-size: 17px; font-weight: 800; }
  .dial-num text.small { font-size: 11px; }

  /* grind: lid off, beans in, lid on, power on, grinding, off, tap the bellows */
  .art :global(.k-lid) { animation: k-lid 12s ease-in-out infinite; }
  @keyframes k-lid { 0%, 3% { transform: translate(0, 0) rotate(0); } 9%, 27% { transform: translate(34px, -30px) rotate(14deg); } 33%, 74% { transform: translate(0, 0) rotate(0); } 77%, 79% { transform: translate(0, 8px); } 81% { transform: translate(0, 0); } 84%, 86% { transform: translate(0, 8px); } 89%, 100% { transform: translate(0, 0); } }
  .art :global(.k-bellows) { animation: k-bellows 12s ease-in-out infinite; }
  @keyframes k-bellows { 0%, 74%, 81%, 89%, 100% { transform: scaleY(1); } 77%, 79%, 84%, 86% { transform: scaleY(0.82); } }
  .art :global(.k-pour) { opacity: 0; animation: k-pour 12s ease-in-out infinite; }
  @keyframes k-pour { 0%, 6% { opacity: 0; transform: translate(-30px, -16px) rotate(0); } 10% { opacity: 1; transform: translate(0, 0) rotate(0); } 15%, 22% { opacity: 1; transform: rotate(-58deg); } 27% { opacity: 1; transform: rotate(0); } 31%, 100% { opacity: 0; transform: translate(-30px, -16px); } }
  .art :global(.k-in g) { opacity: 0; animation: k-in 12s ease-in infinite; }
  .art :global(.k-in .b1) { animation-delay: 0.25s; } .art :global(.k-in .b2) { animation-delay: 0.5s; }
  .art :global(.k-in .b3) { animation-delay: 0.75s; } .art :global(.k-in .b4) { animation-delay: 1s; }
  @keyframes k-in { 0%, 15% { opacity: 0; translate: 0 0; } 16% { opacity: 1; } 21% { opacity: 1; translate: 0 26px; } 22%, 100% { opacity: 0; translate: 0 30px; } }
  .art :global(.k-power) { opacity: 0; animation: k-power 12s ease infinite; }
  @keyframes k-power { 0%, 35% { opacity: 0; } 37%, 66% { opacity: 1; } 68%, 100% { opacity: 0; } }
  .art :global(.k-vib) { opacity: 0; animation: k-power 12s ease infinite, k-wob 0.18s linear infinite alternate; }
  @keyframes k-wob { to { translate: -2px 0; } }
  .art :global(.k-grains) { opacity: 0; animation: k-grains 12s linear infinite; }
  @keyframes k-grains { 0%, 39% { opacity: 0; } 41%, 65% { opacity: 1; } 67%, 100% { opacity: 0; } }
  .art :global(.k-grains circle) { animation: k-grain 0.6s linear infinite; }
  .art :global(.k-grains .g1), .art :global(.k-grains .g4) { animation-delay: -0.2s; }
  .art :global(.k-grains .g2), .art :global(.k-grains .g5) { animation-delay: -0.4s; }
  @keyframes k-grain { from { translate: 0 0; } to { translate: 0 14px; } }

  /* basket: the convex basket drops into the holder, then the tick */
  .art :global(.k-basket) { animation: k-basket 5s cubic-bezier(.3, .7, .3, 1) infinite; }
  @keyframes k-basket { 0%, 6% { opacity: 0; translate: 0 -70px; } 14% { opacity: 1; } 40%, 90% { opacity: 1; translate: 0 0; } 97%, 100% { opacity: 0; translate: 0 0; } }
  .art :global(.k-check) { animation: k-check 5s ease infinite; }
  @keyframes k-check { 0%, 42% { opacity: 0; transform: scale(0.4); } 50% { opacity: 1; transform: scale(1.1); } 54%, 88% { opacity: 1; transform: scale(1); } 94%, 100% { opacity: 0; transform: scale(1); } }

  /* funnel: the bell lifts out, the cup comes off, two taps to settle */
  .art :global(.k-bell) { animation: k-bell 9s cubic-bezier(.45, 0, .3, 1) infinite; }
  @keyframes k-bell { 0%, 10% { translate: 0 0; } 26%, 88% { translate: 0 -46px; } 92%, 100% { translate: 0 0; } }
  .art :global(.k-cup) { animation: k-cup 9s cubic-bezier(.45, 0, .3, 1) infinite; }
  @keyframes k-cup { 0%, 32% { opacity: 1; translate: 0 0; } 44% { opacity: 0; translate: 0 -50px; } 88% { opacity: 0; translate: 0 -50px; } 96%, 100% { opacity: 1; translate: 0 0; } }
  .art :global(.k-stack) { animation: k-stack 9s ease-in infinite; }
  @keyframes k-stack { 0%, 52%, 57%, 61%, 66%, 100% { translate: 0 0; } 54.5%, 63.5% { translate: 0 -9px; } }
  .art :global(.k-tapline) { opacity: 0; animation: k-tapline 9s linear infinite; }
  @keyframes k-tapline { 0%, 56% { opacity: 0; } 57% { opacity: 1; } 59%, 65% { opacity: 0; } 66% { opacity: 1; } 68%, 100% { opacity: 0; } }

  /* tamp: funnel off, tamper on, press, lift away */
  .art :global(.k-funnel) { animation: k-funnel 8s ease-in-out infinite; }
  @keyframes k-funnel { 0%, 4% { opacity: 1; translate: 0 0; } 14%, 90% { opacity: 0; translate: 0 -50px; } 98%, 100% { opacity: 1; translate: 0 0; } }
  .art :global(.k-tamper) { animation: k-tamper 8s cubic-bezier(.4, 0, .3, 1) infinite; }
  @keyframes k-tamper { 0%, 14% { opacity: 0; translate: 0 -90px; } 18% { opacity: 1; } 30%, 66% { opacity: 1; translate: 0 0; } 78%, 100% { opacity: 0; translate: 0 -90px; } }
  .art :global(.k-press) { animation: k-press 8s cubic-bezier(.6, 0, .2, 1) infinite; }
  @keyframes k-press { 0%, 38% { translate: 0 0; } 46%, 52% { translate: 0 9px; } 58%, 100% { translate: 0 0; } }
  .art :global(.k-hit) { opacity: 0; animation: k-hit 8s linear infinite; }
  @keyframes k-hit { 0%, 45% { opacity: 0; } 46.5% { opacity: 1; } 54%, 100% { opacity: 0; } }
  .art :global(.k-loose) { animation: k-loose 8s linear infinite; }
  @keyframes k-loose { 0%, 46% { opacity: 1; } 47%, 95% { opacity: 0; } 98%, 100% { opacity: 1; } }
  .art :global(.k-tamped) { animation: k-tamped 8s linear infinite; }
  @keyframes k-tamped { 0%, 46% { opacity: 0; } 47%, 95% { opacity: 1; } 98%, 100% { opacity: 0; } }

  /* paper: floats down onto the puck */
  .art :global(.k-paper) { animation: k-paper 5s cubic-bezier(.3, .5, .3, 1) infinite; }
  @keyframes k-paper { 0%, 4% { opacity: 0; transform: translate(-8px, -80px); } 12% { opacity: 1; } 30% { transform: translate(7px, -42px); } 48% { transform: translate(-3px, -10px); } 58%, 92% { opacity: 1; transform: translate(0, 0); } 98%, 100% { opacity: 0; transform: translate(0, 0); } }

  /* minerals: shake, dropper out and over the cup, squeeze, one drop */
  .art :global(.k-shake) { animation: k-shake 10s ease-in-out infinite; }
  @keyframes k-shake { 0%, 2%, 16%, 100% { rotate: 0deg; } 4%, 8%, 12% { rotate: -6deg; } 6%, 10%, 14% { rotate: 6deg; } }
  .art :global(.k-dropper) { animation: k-dropper 10s cubic-bezier(.45, 0, .3, 1) infinite; }
  @keyframes k-dropper { 0%, 18% { translate: var(--dx) var(--dy); } 27% { translate: var(--dx) calc(var(--dy) - 92px); } 36% { translate: 0 -12px; } 41%, 72% { translate: 0 0; } 78% { translate: 0 -12px; } 86% { translate: var(--dx) calc(var(--dy) - 92px); } 94%, 100% { translate: var(--dx) var(--dy); } }
  .art :global(.k-bulb) { animation: k-bulb 10s ease-in-out infinite; }
  @keyframes k-bulb { 0%, 46%, 58%, 100% { scale: 1 1; } 50%, 53% { scale: 1.1 0.8; } }
  .art :global(.k-drip) { transform-box: fill-box; transform-origin: 50% 0; animation: k-drip 10s cubic-bezier(.5, 0, 1, .6) infinite; }
  @keyframes k-drip { 0%, 49% { opacity: 0; transform: scale(0.2); } 53% { opacity: 1; transform: scale(1); } 54% { transform: translateY(0); } 61% { opacity: 1; transform: translateY(84px); } 62%, 100% { opacity: 0; transform: translateY(84px); } }
  .art :global(.k-ripple) { opacity: 0; animation: k-ripple 10s ease-out infinite; }
  @keyframes k-ripple { 0%, 61% { opacity: 0; transform: scale(0.3); } 63% { opacity: 1; } 74%, 100% { opacity: 0; transform: scale(1.4); } }
  .art.minerals :global(.k-pool) { animation: k-pool 10s ease infinite; }
  @keyframes k-pool { 0%, 61% { opacity: 0; } 64%, 96% { opacity: 1; } 100% { opacity: 0; } }

  /* pull + rinse: the button to press glows on the group head */
  .art :global(.k-lit) { animation: k-lit 2.4s ease-in-out infinite; }
  @keyframes k-lit { 0%, 100% { opacity: 0.55; transform: scale(0.85); } 50% { opacity: 1; transform: scale(1.2); } }
  .art :global(.k-ring) { opacity: 0; animation: k-ripple2 2.4s ease-out infinite; }
  @keyframes k-ripple2 { 0% { opacity: 0.9; transform: scale(0.9); } 70%, 100% { opacity: 0; transform: scale(2.2); } }
  .art.rinse.on :global(.k-lit) { animation: none; opacity: 1; }
  .art.rinse.on :global(.k-ring) { animation: none; opacity: 0; }
  .art :global(.k-water) { opacity: 0; transition: opacity 400ms ease; }
  .art.on :global(.k-water) { opacity: 1; animation: k-water 0.45s linear infinite; }
  @keyframes k-water { to { stroke-dashoffset: -13; } }
  .art.rinse :global(.k-pool) { opacity: 0; transition: opacity 600ms ease; }
  .art.rinse.on :global(.k-pool) { opacity: 1; }

  /* knock: upturned portafilter knocks on the bar, the puck drops in */
  .art :global(.k-knock) { animation: k-knock 4s cubic-bezier(.6, 0, .4, 1) infinite; }
  @keyframes k-knock { 0%, 8%, 100% { translate: 0 0; } 20% { translate: 0 var(--hit); } 28% { translate: 0 calc(var(--hit) - 14px); } 36% { translate: 0 var(--hit); } 60% { translate: 0 0; } }
  .art :global(.k-puck) { opacity: 0; animation: k-puck 4s cubic-bezier(.5, 0, 1, .6) infinite; }
  @keyframes k-puck { 0%, 19% { opacity: 0; translate: 0 var(--hit, 51px); } 20% { opacity: 1; translate: 0 var(--hit, 51px); } 44% { opacity: 1; translate: 0 calc(var(--hit, 51px) + 110px); } 45%, 100% { opacity: 0; translate: 0 calc(var(--hit, 51px) + 110px); } }

  /* enjoy: shake the iced latte, cap off, pour into the glass, foam on top */
  .art :global(.k-shaker) { animation: k-shaker 10s ease-in-out infinite; }
  @keyframes k-shaker {
    0%, 2% { transform: translate(0, 0) rotate(0); }
    5% { transform: translate(4px, -12px) rotate(9deg); } 8% { transform: translate(-3px, 4px) rotate(-7deg); }
    11% { transform: translate(4px, -12px) rotate(9deg); } 14% { transform: translate(-3px, 4px) rotate(-7deg); }
    17% { transform: translate(4px, -12px) rotate(9deg); } 20% { transform: translate(-3px, 4px) rotate(-7deg); }
    24%, 44% { transform: translate(0, 0) rotate(0); }
    54%, 74% { transform: translate(var(--tx), var(--ty)) rotate(118deg); }
    84%, 100% { transform: translate(0, 0) rotate(0); }
  }
  .art :global(.k-cap) { animation: k-cap 10s ease-in-out infinite; }
  @keyframes k-cap { 0%, 30% { opacity: 1; translate: 0 0; } 38%, 86% { opacity: 0; translate: -10px -30px; } 92%, 100% { opacity: 1; translate: 0 0; } }
  .art :global(.k-shadow) { animation: k-shadow 10s ease-in-out infinite; }
  @keyframes k-shadow { 0%, 44%, 84%, 100% { opacity: 1; } 54%, 74% { opacity: 0; } }
  .art :global(.k-stream) { opacity: 0; animation: k-stream 10s linear infinite; }
  @keyframes k-stream { 0%, 54% { opacity: 0; stroke-dashoffset: 80; } 56% { opacity: 1; } 72% { opacity: 1; stroke-dashoffset: 0; } 76%, 100% { opacity: 0; stroke-dashoffset: -60; } }
  .art :global(.k-fill) { animation: k-fill 10s ease-out infinite; }
  @keyframes k-fill { 0%, 55% { transform: scaleY(0.03); opacity: 0; } 57% { opacity: 1; } 74%, 95% { transform: scaleY(1); opacity: 1; } 100% { transform: scaleY(1); opacity: 0; } }
  .art :global(.k-foam) { animation: k-foam 10s ease infinite; }
  @keyframes k-foam { 0%, 68% { opacity: 0; } 76%, 95% { opacity: 1; } 100% { opacity: 0; } }

  @media (prefers-reduced-motion: reduce) {
    .art :global(*) { animation: none !important; transition: none !important; }
    .art :global(.k-dial) { transform: rotate(var(--dial)); }
    .art :global(.fx) { display: none; }
  }
</style>
