<script lang="ts">
  import type { GuideStepId, WeighState } from '../../lib/guide';

  // One animated line-art scene per guide step: thin even strokes in the
  // skin's cream, one accent colour per scene for the moving or important
  // bit, no gradients, filters or shadows (weak tablet GPU). Everything
  // animates with transform, opacity or stroke-dashoffset only. Live values
  // (scale weight, grind setting, rinse running) feed straight into the
  // drawings.

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

  // Each scene is framed to fill the panel. Strokes are non-scaling, so the
  // line weight stays the same whatever the framing.
  const frame = (cx: number, cy: number, w: number) => `${cx - w / 2} ${cy - w * 0.375} ${w} ${w * 0.75}`;
  const VIEWBOX: Record<GuideStepId, string> = {
    weigh: frame(200, 158, 250), spray: frame(206, 185, 330), dial: frame(211, 167, 370), grind: frame(205, 132, 350),
    basket: frame(216, 155, 290), funnel: frame(240, 151, 300), tamp: frame(240, 175, 290), paper: frame(244, 150, 310),
    minerals: frame(194, 186, 330), start: frame(200, 145, 312), knock: frame(226, 164, 300), rinse: frame(200, 145, 312),
    done: frame(218, 193, 300),
  };
  const lcd = $derived(weight == null ? '--.-' : weight.toFixed(1));
  const beans = [0, 1, 2, 3, 4];
  const range = (n: number) => Array.from({ length: n }, (_, i) => i);

  // Grinder dial: 0 (fine) to 90 (coarse) over 300 degrees; the ring turns
  // so the chosen number sits under the fixed pointer at the top.
  const DIAL_START = -150;
  const DIAL_PER = 300 / 90;
  const gv = $derived.by(() => {
    const n = grind == null ? NaN : parseFloat(grind);
    return Number.isFinite(n) && n >= 0 && n <= 90 ? n : null;
  });
  const dialTo = $derived(-DIAL_START - DIAL_PER * (gv ?? 14));
  const dialAngle = (v: number) => DIAL_START + DIAL_PER * v;
  const dialTicks = range(46).map((i) => i * 2);
  const dialLabels = range(10).map((i) => i * 10);
</script>

<svg viewBox={VIEWBOX[step]} class="art {step}" aria-hidden="true">
  {#snippet bean(x: number, y: number, r: number)}
    <g transform="translate({x} {y}) rotate({r})">
      <ellipse rx="4.5" ry="6.5" class="l a" />
      <path d="M0,-5 C-3,-2 3,2 0,5" class="l a" />
    </g>
  {/snippet}

  <!-- Pebble dosing cup, origin at the bottom centre; spout up on the left. -->
  {#snippet dosingCup()}
    <path d="M-52,-54 C-34,-44 14,-42 44,-50 C20,-74 -40,-72 -52,-54 Z" class="l t f" />
    <path d="M-52,-54 C-56,-26 -40,0 -4,0 C34,0 54,-16 50,-36 C49,-42 47,-46 44,-50" class="l" />
    <path d="M-52,-54 C-34,-44 14,-42 44,-50" class="l" />
    <path d="M-52,-54 C-40,-72 20,-74 44,-50" class="l" />
  {/snippet}

  <!-- Bookoo Themis Mini: low near-square slab, flat platform, little display and one button. -->
  {#snippet scale(cx: number, top: number)}
    <rect x={cx - 66} y={top} width="132" height="5" rx="2.5" class="l" />
    <rect x={cx - 75} y={top + 5} width="150" height="30" rx="11" class="l" />
    <rect x={cx - 58} y={top + 12} width="60" height="16" rx="4" class="l f" />
    <circle cx={cx + 48} cy={top + 20} r="4.5" class="l" />
  {/snippet}

  <!-- Decent naked portafilter, side view: round holder, open bottom, straight handle. -->
  {#snippet portafilter(x: number, top: number)}
    <path d="M{x - 52},{top} V{top + 36} Q{x - 52},{top + 44} {x - 44},{top + 44} H{x + 44} Q{x + 52},{top + 44} {x + 52},{top + 36} V{top}" class="l" />
    <path d="M{x - 56},{top} H{x + 56}" class="l" />
    <path d="M{x + 52},{top + 10} L{x + 142},{top + 12} Q{x + 154},{top + 17} {x + 154},{top + 23} Q{x + 154},{top + 29} {x + 142},{top + 34} L{x + 52},{top + 36}" class="l" />
  {/snippet}

  <!-- The grinder, origin at the middle of its base on the bench. -->
  {#snippet grinder()}
    <rect x="-66" y="-16" width="174" height="16" rx="8" class="l" />
    <path d="M-40,-16 V-138 M40,-16 V-138" class="l" />
    <path d="M-40,-16 A40,7 0 0 0 40,-16" class="l f" />
    <path d="M-44,-146 V-138 A44,9.5 0 0 0 44,-138 V-146" class="l" />
    <ellipse cy="-146" rx="44" ry="9.5" class="l" />
    <ellipse cy="-146" rx="35" ry="7" class="l f" />
    <circle cx="-20" cy="-100" r="5" class="l" />
    <path d="M17,-146 V-164 M-17,-146 V-164 M-17,-146 A17,3.5 0 0 0 17,-146" class="l" />
    <path d="M40,-130 C70,-136 90,-120 90,-92 V-62 M40,-96 C47,-96 52,-90 52,-82 V-62 M46,-62 H96" class="l" />
    <path d="M46,-62 V-24 Q46,-16 54,-16 H88 Q96,-16 96,-24 V-62" class="l" />
    <path d="M48,-26 H94" class="l f" />
  {/snippet}

  <!-- Bellows (ribbed) with a flat lid, origin on the collar. -->
  {#snippet bellows()}
    <path d="M-17,-164 C-24,-168 -24,-174 -17,-176 C-24,-180 -24,-186 -17,-188 C-24,-192 -24,-198 -17,-200 C-24,-204 -21,-208 -17,-212 M17,-164 C24,-168 24,-174 17,-176 C24,-180 24,-186 17,-188 C24,-192 24,-198 17,-200 C24,-204 21,-208 17,-212" class="l" />
  {/snippet}
  {#snippet lid()}
    <path d="M-22,-216 V-212 A22,5 0 0 0 22,-212 V-216" class="l" />
    <ellipse cy="-216" rx="22" ry="5" class="l" />
  {/snippet}

  <!-- Machine icons (group head controller). -->
  {#snippet icon(kind: 'steam' | 'water' | 'espresso' | 'flush', x: number, on: boolean)}
    <g transform="translate({x} 66)" class="ico" class:on>
      <circle r="14" class="l f" />
      {#if kind === 'steam'}
        <path d="M-5,6 C-8,2 -2,0 -5,-6 M0,6 C-3,2 3,0 0,-6 M5,6 C2,2 8,0 5,-6" class="l" />
      {:else if kind === 'water'}
        <path d="M0,-8 C4,-2 6,1 6,4 A6,6 0 0 1 -6,4 C-6,1 -4,-2 0,-8 Z" class="l" />
      {:else if kind === 'espresso'}
        <path d="M-7,-3 H4 V3 Q4,7 -1.5,7 Q-7,7 -7,3 Z M4,-1 Q9,-1 8.5,2.5 Q8,5 4,4.5 M-4,-7 V-5 M0,-7 V-5" class="l" />
      {:else}
        <path d="M-6,-7 H6 M-4,-3 V6 M0,-3 V6 M4,-3 V6" class="l" />
      {/if}
    </g>
  {/snippet}
  {#snippet machine(lit: 'espresso' | 'flush')}
    <path d="M62,262 V74 Q62,28 108,28 H292 Q338,28 338,74 V262" class="l f" />
    <rect x="112" y="44" width="176" height="44" rx="16" class="l" />
    {@render icon('steam', 142, false)}
    {@render icon('water', 180, false)}
    {@render icon('espresso', 220, lit === 'espresso')}
    {@render icon('flush', 258, lit === 'flush')}
    <path d="M164,88 V104 Q164,112 172,112 H228 Q236,112 236,104 V88" class="l" />
    <path d="M92,262 H308" class="l" />
  {/snippet}

  <path d="M40,262 H360" class="l f ground" />

  {#if step === 'weigh'}
    <!-- Dosing cup on the scale; beans drop in until the dose is right. Live weight on the display. -->
    {@render scale(200, 196)}
    <text x="165" y="221" text-anchor="middle" class="lcd {weighState}">{lcd}</text>
    <g transform="translate(200 196)">{@render dosingCup()}</g>
    <g class="mound" class:show={weighState !== 'empty'}>
      {@render bean(188, 143, 25)}{@render bean(203, 146, -15)}{@render bean(218, 143, 60)}{@render bean(196, 150, -50)}
    </g>
    <g class="fall-group" class:settled={weighState === 'ok'}>
      {#each beans as b (b)}
        <g class="drop fx" style="--i: {b}; --x: {170 + b * 15}px">{@render bean(0, 0, b * 40)}</g>
      {/each}
    </g>
  {:else if step === 'spray'}
    <!-- Spray bottle misting the beans from a distance. -->
    <g transform="translate(300 262)">{@render dosingCup()}</g>
    {@render bean(285, 208, 30)}{@render bean(302, 205, -20)}{@render bean(318, 208, 55)}{@render bean(295, 214, -60)}
    <rect x="64" y="204" width="52" height="56" rx="11" class="t" />
    <rect x="62" y="158" width="56" height="102" rx="16" class="l a" />
    <path d="M82,158 V146 H98 V158 M76,146 V128 Q76,120 84,120 H138 V134 H108 V146" class="l" />
    <path d="M70,204 H110" class="l a f" />
    <g class="trigger"><path d="M110,134 C124,138 124,154 112,162" class="l" /></g>
    {#each range(8) as m (m)}
      <circle class="mist fx s" style="--i: {m}; --dx: {96 + (m % 4) * 17}px; --dy: {26 + (m % 3) * 22}px" cx="142" cy="127" r={1.6 + (m % 3) * 0.6} />
    {/each}
  {:else if step === 'dial'}
    <!-- The grinder's dial, magnified: the ring turns to your setting. -->
    <g transform="translate(105 268)">
      {@render grinder()}
      {@render bellows()}
      {@render lid()}
    </g>
    <path d="M149,118 L226,108 M149,128 L226,192" class="l f" />
    <g transform="translate(300 150)">
      <circle r="84" class="l" />
      <g class="dial-ring" style="--from: {dialTo + 70}deg; --to: {dialTo}deg">
        <circle r="70" class="l f" />
        {#each dialTicks as v (v)}
          <path d="M0,-70 V{v % 10 === 0 ? -57 : -63}" transform="rotate({dialAngle(v)})" class="l" style="stroke-opacity: {v % 10 === 0 ? 0.9 : 0.4}" />
        {/each}
        {#each dialLabels as v (v)}
          <text transform="rotate({dialAngle(v)}) translate(0 -45)" text-anchor="middle" dominant-baseline="central" class="tick-num">{v}</text>
        {/each}
      </g>
      <path d="M0,-52 L-7,-70 H7 Z" class="s pointer" />
      <circle r="27" class="l a t" />
      <text y="2" text-anchor="middle" dominant-baseline="central" class="dial-num" class:small={gv === null || (grind ?? '').length > 4}>{gv === null ? (grind ?? '?') : grind}</text>
    </g>
  {:else if step === 'grind'}
    <!-- Grinder loop: on, beans in, grinding, off, tap the bellows. -->
    <g transform="translate(235 268)">
      {@render grinder()}
      <circle cx="-20" cy="-100" r="5" class="s power" />
      <path d="M-50,-92 Q-56,-100 -50,-108 M-58,-88 Q-68,-100 -58,-112" class="l a fx vib" />
      <g class="bellows">{@render bellows()}</g>
      <g class="lid">{@render lid()}</g>
      <!-- grounds fall inside the chute and pile up in the catch cup -->
      <rect x="48" y="-62" width="46" height="44" rx="4" class="t pile" />
      {#each range(6) as m (m)}
        <circle class="grain fx s" style="--i: {m}; --x: {60 + (m % 3) * 12}px" cx="0" cy="-92" r="1.8" />
      {/each}
      {#each range(4) as m (m)}
        <circle class="puff fx s" style="--i: {m}; --x: {62 + m * 8}px" cx="0" cy="-92" r="1.8" />
      {/each}
      <g class="finger"><rect x="-8" y="-46" width="16" height="46" rx="8" transform="translate(6 -224) rotate(22)" class="l" /></g>
    </g>
    <g class="pour-cup">
      <g transform="translate(168 98) scale(-1 1)">{@render dosingCup()}</g>
    </g>
    {#each range(6) as b (b)}
      <g class="pour-bean fx" style="--i: {b}; --x: {214 + (b % 3) * 7}px">{@render bean(0, 0, b * 50)}</g>
    {/each}
  {:else if step === 'basket'}
    <!-- Convex basket dropping into the naked portafilter (shown in section). -->
    <path d="M98,144 V196 Q98,206 108,206 H128 M242,144 V196 Q242,206 232,206 H212 M112,144 V198 M228,144 V198" class="l" />
    <path d="M92,144 H112 M228,144 H248" class="l" />
    <path d="M242,160 L318,158 Q336,164 336,174 Q336,184 318,190 L242,188" class="l" />
    <g class="basket-in">
      <path d="M108,126 H232 M114,128 V176 Q114,182 120,182 M226,128 V176 Q226,182 220,182 M120,182 C140,150 200,150 220,182" class="l a" />
      <path d="M120,182 C140,150 200,150 220,182 L114,182" class="t" />
      {#each [138, 156, 170, 184, 202] as hx, i (hx)}<circle cx={hx} cy={178 - (i % 2 === 0 ? 10 : 24) + (hx > 150 && hx < 190 ? -4 : 6)} r="1.4" class="s dot" />{/each}
    </g>
    <path d="M232,102 L240,110 L254,92" class="l a tick fx" />
  {:else if step === 'funnel'}
    <!-- Funnel on the portafilter, cup on the funnel; the bell lifts out, grounds drop in, tap to settle. -->
    <g class="pf-stack">
      {@render portafilter(200, 204)}
      <path d="M156,204 V190 L132,158 H268 L244,190 V204 M128,158 H272" class="l" />
    </g>
    <g class="cup-w">
      <path d="M150,84 V158 M250,84 V158 M146,84 H254" class="l" />
      <path d="M152,138 H248 V114 Q200,102 152,114 Z" class="t heap" />
      <g class="bell">
        <path d="M200,142 V56 M156,158 V148 Q156,138 176,138 H224 Q244,138 244,148 V158 H156" class="l a" />
        <circle cx="200" cy="48" r="8" class="l a" />
      </g>
    </g>
    {#each range(8) as m (m)}
      <circle class="drop-g fx s" style="--i: {m}; --x: {188 + (m % 4) * 8}px" cx="0" cy="164" r="2" />
    {/each}
    <path d="M150,262 H250" class="l a f tapfx fx" />
  {:else if step === 'tamp'}
    <!-- Funnel off, then the impact tamper presses down and its spring compresses. -->
    <g class="pf-t">{@render portafilter(200, 206)}</g>
    <path d="M156,206 V192 L132,160 H268 L244,192 V206 M128,160 H272" class="l funnel-off" />
    <g class="tamper">
      <path d="M154,206 V198 Q154,172 200,172 Q246,172 246,198 V206 Z" class="l" />
      <path d="M200,172 V160" class="l f" />
      <g class="spring"><path d="M200,172 L190,164 L210,156 L190,148 L210,140 L190,132 L200,128" class="l a spring-line" /></g>
      <g class="cap"><rect x="168" y="102" width="64" height="26" rx="13" class="l" /></g>
    </g>
    <path d="M142,204 L130,198 M258,204 L270,198 M140,214 L126,214 M260,214 L274,214" class="l a fx hit" />
  {:else if step === 'paper'}
    <!-- A paper disc settles onto the tamped puck. -->
    <path d="M104,152 L108,222 Q110,236 128,236 H272 Q290,236 292,222 L296,152" class="l" />
    <ellipse cx="200" cy="152" rx="96" ry="24" class="l" />
    <ellipse cx="200" cy="154" rx="80" ry="18" class="l f" />
    <path d="M292,196 L372,204 Q384,208 382,216 Q380,224 368,224 L286,220" class="l" />
    <g class="paper-disc">
      <ellipse cx="200" cy="152" rx="76" ry="16" class="l a t" />
      <ellipse cx="200" cy="152" rx="40" ry="8" class="l a f" />
    </g>
  {:else if step === 'minerals'}
    <!-- Shake the bottle, lift the eyedropper out, squeeze: one drop into the cup. -->
    <g class="bottle-s">
      <path d="M76,208 H124 V252 Q124,262 114,262 H86 Q76,262 76,252 Z" class="t" />
      <path d="M90,170 V182 Q70,188 70,206 V252 Q70,262 82,262 H118 Q130,262 130,252 V206 Q130,188 110,182 V170" class="l" />
      <path d="M72,208 H128" class="l a f" />
      <ellipse cx="100" cy="170" rx="10" ry="2.6" class="l" />
      <path d="M52,186 L44,190 M52,206 L42,206 M148,186 L156,190 M148,206 L158,206" class="l f fx shake-lines" />
    </g>
    <g class="dropper">
      <path d="M100,242 V182" class="l" />
      <path d="M88,176 H112 V168 H88 Z" class="l" />
      <g class="bulb"><path d="M93,168 C84,148 90,128 100,120 C110,128 116,148 107,168" class="l a t" /></g>
    </g>
    <path d="M254,222 H326 V234 Q326,262 290,262 Q254,262 254,234 Z M326,230 Q344,230 342,244 Q340,256 322,254" class="l" />
    <ellipse cx="290" cy="222" rx="36" ry="5" class="l f" />
    <g class="drip-drop"><path d="M290,176 C294,184 296,188 296,192 A6,6 0 0 1 284,192 C284,188 286,184 290,176 Z" class="a t l" /></g>
    <ellipse cx="290" cy="250" rx="12" ry="2.5" class="l a ripple fx" />
  {:else if step === 'start'}
    <!-- Portafilter locked in, cup on the scale; the brew button on the group head pulses. -->
    {@render machine('espresso')}
    <g class="lock-in">
      <rect x="156" y="112" width="88" height="24" rx="8" class="l" />
      <path d="M244,118 L322,136 Q332,139 330,146 Q327,153 318,151 L244,132" class="l" />
    </g>
    <path d="M164,176 H236 V198 Q236,222 200,222 Q164,222 164,198 Z M236,184 Q254,184 254,198 Q254,210 234,208" class="l" />
    {@render scale(200, 222)}
  {:else if step === 'knock'}
    <!-- Knock the puck out on the bar; it drops in with its paper. -->
    <path d="M126,190 L274,190 L290,202 L110,202 Z" class="l" />
    <path d="M110,202 V262 H290 V202" class="l" />
    <path d="M134,190 V170 M266,190 V170" class="l" />
    <rect x="128" y="168" width="144" height="8" rx="4" class="l a" />
    <g class="knock-pf">
      <path d="M160,100 V134 H240 V100 M164,100 H236 M156,100 H244" class="l" />
      <path d="M240,108 L330,110 Q342,115 342,121 Q342,127 330,130 L240,132" class="l" />
    </g>
    <clipPath id="box-clip"><rect x="90" y="0" width="220" height="200" /></clipPath>
    <g clip-path="url(#box-clip)"><g class="puck-fall">
      <rect x="164" y="138" width="72" height="16" rx="5" class="l a t" />
      <path d="M166,158 H234" class="l f" />
    </g></g>
  {:else if step === 'rinse'}
    <!-- Flush on the group head controller; water onto the empty portafilter held under it. -->
    {@render machine('flush')}
    {#each [0, 1, 2, 3, 4] as w (w)}
      <path class="stream" class:on={active} d="M{176 + w * 12},116 V168" style="--i: {w}" />
    {/each}
    <g class="rinse-pf" class:on={active}>
      {@render portafilter(200, 170)}
      <path d="M160,174 Q200,186 240,174" class="l a pool" class:on={active} />
    </g>
    {#if active}
      {#each [0, 1, 2] as d (d)}
        <circle class="drip fx s" style="--i: {d}" cx={188 + d * 12} cy="220" r="2.2" />
      {/each}
    {/if}
  {:else}
    <!-- Done: an iced latte shaken in a cobbler shaker, poured into a glass without the ice. -->
    <g class="shaker">
      <g transform="translate(130 262)">
        <path d="M-23,0 L-32,-92 H32 L23,0 Z" class="l" />
        <path d="M-27.5,-30 H27.5 L23,0 H-23 Z" class="t" />
        <path d="M-32,-92 L-26,-120 H26 L32,-92" class="l" />
        <path d="M-9,-106 H-8 M0,-106 H1 M9,-106 H10" class="l f" />
        <g class="ice"><rect x="-14" y="-24" width="12" height="12" rx="3" class="l f" transform="rotate(-12 -8 -18)" /></g>
        <g class="ice b"><rect x="3" y="-40" width="12" height="12" rx="3" class="l f" transform="rotate(18 9 -34)" /></g>
        <g class="ice c"><rect x="-8" y="-62" width="12" height="12" rx="3" class="l f" transform="rotate(6 -2 -56)" /></g>
        <g class="cap-s"><path d="M-12,-120 V-130 Q-12,-138 0,-138 Q12,-138 12,-130 V-120" class="l" /></g>
      </g>
    </g>
    <path d="M293,176 V228" class="l a stream-l fx" />
    <path d="M276,200 L282,262 H334 L340,200" class="l" />
    <path d="M282,262 L278.2,222 H337.8 L334,262 Z" class="t liquid" />
    <path d="M278.2,222 L276.7,207 C282,203 288,208 294,204 C300,200 306,208 312,204 C318,200 324,208 330,204 C334,203 337,205 339.3,207 L337.8,222" class="l a foam" />
  {/if}
</svg>

<style>
  .art {
    --acc: #8fd3c0;
    --coffee: #e2a86c;
    width: 100%;
    height: 100%;
    overflow: visible;
  }
  text { font-family: var(--font); font-variant-numeric: tabular-nums; }

  /* Line language: one stroke weight, rounded; the accent only where it matters. */
  .l { vector-effect: non-scaling-stroke; fill: none; stroke: var(--paper); stroke-opacity: 0.92; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  .l.f { stroke-opacity: 0.38; }
  .l.a { stroke: var(--acc); stroke-opacity: 1; }
  .l.a.f { stroke-opacity: 0.55; }
  .t { fill: var(--acc); fill-opacity: 0.12; stroke: none; }
  .l.t { stroke: var(--paper); }
  .l.a.t { stroke: var(--acc); }
  .s { fill: var(--acc); stroke: none; }
  .l.f.t { fill-opacity: 0.08; }

  .art.weigh { --acc: rgb(var(--accent)); }
  .art.spray, .art.minerals, .art.rinse { --acc: var(--g-flow); }
  .art.dial { --acc: var(--warn); }
  .art.grind, .art.funnel, .art.knock, .art.done { --acc: var(--coffee); }
  .art.basket, .art.tamp, .art.paper { --acc: var(--go); }
  .art.start { --acc: var(--go); }
  .ground { stroke-opacity: 0.22; }

  /* weigh */
  .lcd { font-size: 14px; font-weight: 700; fill: var(--paper); letter-spacing: 0.03em; }
  .lcd.under { fill: var(--warn); }
  .lcd.over { fill: var(--stop); }
  .lcd.ok { fill: var(--go); }
  .mound { opacity: 0; transition: opacity 300ms ease; }
  .mound.show { opacity: 1; }
  .drop { animation: drop 1.7s cubic-bezier(.5, 0, .9, .6) infinite; animation-delay: calc(var(--i) * 0.31s); opacity: 0; translate: var(--x) 0; }
  @keyframes drop { 0% { transform: translateY(40px); opacity: 0; } 15% { opacity: 1; } 80% { opacity: 1; } 100% { transform: translateY(116px) rotate(120deg); opacity: 0; } }
  /* Dose reached: the beans stop falling. */
  .fall-group { transition: opacity 300ms ease; }
  .fall-group.settled { opacity: 0; }

  /* spray */
  .trigger { transform-origin: 110px 134px; animation: squeeze 2.6s ease-in-out infinite; }
  @keyframes squeeze { 0%, 30%, 75%, 100% { transform: rotate(0); } 42%, 62% { transform: rotate(-10deg); } }
  .mist { opacity: 0; animation: mist 2.6s ease-out infinite; animation-delay: calc(0.8s + var(--i) * 0.05s); }
  @keyframes mist { 0% { opacity: 0; transform: translate(0, 0) scale(0.5); } 15% { opacity: 1; } 100% { opacity: 0; transform: translate(var(--dx), var(--dy)) scale(1.3); } }

  /* dial */
  .dial-ring { transform-origin: 0 0; animation: dial 5s cubic-bezier(.2, .9, .25, 1.1) infinite; }
  @keyframes dial { 0% { transform: rotate(var(--from)); } 35%, 100% { transform: rotate(var(--to)); } }
  .tick-num { font-size: 10px; font-weight: 700; fill: var(--paper); fill-opacity: 0.8; }
  .dial-num { font-size: 26px; font-weight: 800; fill: var(--acc); }
  .dial-num.small { font-size: 15px; }
  .pointer { animation: none; }

  /* grind: one 10 s loop in five beats, matching the list on screen */
  .power { opacity: 0; animation: power 10s linear infinite; }
  @keyframes power { 0%, 3% { opacity: 0; } 6%, 60% { opacity: 1; } 64%, 100% { opacity: 0; } }
  .vib { opacity: 0; animation: vib 10s linear infinite; }
  @keyframes vib { 0%, 6% { opacity: 0; transform: translateX(0); } 8% { opacity: 1; } 12%, 56% { opacity: 1; } 60% { opacity: 0; } 100% { opacity: 0; } }
  .vib { animation-name: vib, wob; animation-duration: 10s, 0.25s; animation-timing-function: linear, ease-in-out; animation-iteration-count: infinite, infinite; }
  @keyframes wob { 0%, 100% { transform: translateX(0); } 50% { transform: translateX(-2px); } }
  .pour-cup { transform-origin: 218px 44px; animation: tip 10s ease-in-out infinite; }
  @keyframes tip { 0%, 18% { transform: translate(-6px, 24px) rotate(0deg); opacity: 0.55; } 24% { transform: translate(0, 0) rotate(0deg); opacity: 1; } 31%, 39% { transform: translate(0, 0) rotate(52deg); opacity: 1; } 46% { transform: translate(0, 0) rotate(0deg); opacity: 1; } 52%, 100% { transform: translate(-6px, 24px) rotate(0deg); opacity: 0.55; } }
  .pour-bean { opacity: 0; animation: pbean 10s linear infinite; animation-delay: calc(var(--i) * 0.14s); translate: var(--x) 0; }
  @keyframes pbean { 0%, 28% { opacity: 0; transform: translateY(30px); } 30% { opacity: 1; } 36% { opacity: 1; transform: translateY(58px); } 37%, 100% { opacity: 0; transform: translateY(66px); } }
  .lid { animation: lid 10s ease-in-out infinite; transform-origin: 0 -216px; }
  @keyframes lid { 0%, 18% { transform: translate(0, 0) rotate(0); } 24%, 44% { transform: translate(34px, -30px) rotate(14deg); } 50%, 78% { transform: translate(0, 0) rotate(0); } 83%, 88% { transform: translate(0, 10px); } 93%, 100% { transform: translate(0, 0); } }
  .bellows { transform-origin: 0 -164px; animation: squash 10s ease-in-out infinite; }
  @keyframes squash { 0%, 78% { transform: scaleY(1); } 83%, 88% { transform: scaleY(0.8); } 93%, 100% { transform: scaleY(1); } }
  .finger { opacity: 0; animation: finger 10s ease-in-out infinite; }
  @keyframes finger { 0%, 74% { opacity: 0; transform: translate(10px, -26px); } 79% { opacity: 1; transform: translate(0, -8px); } 83%, 88% { opacity: 1; transform: translate(0, 2px); } 93% { opacity: 1; transform: translate(0, -8px); } 97%, 100% { opacity: 0; transform: translate(10px, -26px); } }
  .grain { opacity: 0; animation: grain 0.7s linear infinite; animation-delay: calc(var(--i) * 0.11s); translate: var(--x) 0; }
  @keyframes grain { 0% { transform: translateY(0); opacity: 0; } 20% { opacity: 1; } 100% { transform: translateY(30px); opacity: 1; } }
  /* grounds only fall while the grinder is running and for the last puff */
  .grain { animation-name: grain, grainwin; animation-duration: 0.7s, 10s; animation-iteration-count: infinite, infinite; animation-delay: calc(var(--i) * 0.11s), 0s; }
  @keyframes grainwin { 0%, 34% { visibility: hidden; } 35%, 60% { visibility: visible; } 61%, 100% { visibility: hidden; } }
  .puff { opacity: 0; animation: puff 10s ease-in infinite; animation-delay: calc(var(--i) * 0.08s); translate: var(--x) 0; }
  @keyframes puff { 0%, 83% { opacity: 0; transform: translateY(0); } 85% { opacity: 1; } 92% { opacity: 1; transform: translateY(30px); } 93%, 100% { opacity: 0; transform: translateY(30px); } }
  .pile { transform-origin: 71px -18px; animation: pile 10s ease-out infinite; }
  @keyframes pile { 0%, 34% { transform: scaleY(0.04); opacity: 0; } 36% { opacity: 1; } 60% { transform: scaleY(0.75); } 92% { transform: scaleY(0.9); opacity: 1; } 99%, 100% { transform: scaleY(0.9); opacity: 0; } }

  /* basket: the convex basket drops in and seats; a check confirms it */
  .basket-in { animation: seat 4.5s cubic-bezier(.3, .7, .3, 1) infinite; }
  @keyframes seat { 0% { transform: translateY(-74px); opacity: 0; } 18% { opacity: 1; } 50%, 62% { transform: translateY(14px); } 70%, 90% { transform: translateY(14px); opacity: 1; } 100% { transform: translateY(14px); opacity: 0; } }
  .tick { opacity: 0; animation: check 4.5s linear infinite; }
  @keyframes check { 0%, 52% { opacity: 0; } 60%, 88% { opacity: 1; } 96%, 100% { opacity: 0; } }

  /* funnel */
  .bell { animation: bell 9s ease-in-out infinite; }
  @keyframes bell { 0%, 14% { transform: translateY(0); } 26%, 42% { transform: translateY(-34px); } 52%, 100% { transform: translateY(0); } }
  .heap { transform-origin: 200px 138px; animation: heap 9s ease-in infinite; }
  @keyframes heap { 0%, 15% { transform: scaleY(1); opacity: 1; } 34% { transform: scaleY(0.1); opacity: 0.2; } 36%, 90% { transform: scaleY(0.1); opacity: 0; } 98%, 100% { transform: scaleY(1); opacity: 1; } }
  .cup-w { animation: cupaway 9s ease-in-out infinite; }
  @keyframes cupaway { 0%, 46% { transform: translateY(0); opacity: 1; } 56%, 90% { transform: translateY(-70px); opacity: 0; } 100% { transform: translateY(0); opacity: 1; } }
  .drop-g { opacity: 0; animation: dropg 9s linear infinite; animation-delay: calc(var(--i) * 0.1s); translate: var(--x) 0; }
  @keyframes dropg { 0%, 16% { opacity: 0; transform: translateY(0); } 18% { opacity: 1; } 28% { opacity: 1; transform: translateY(46px); } 29%, 100% { opacity: 0; transform: translateY(46px); } }
  .pf-stack { animation: taps 9s ease-in-out infinite; }
  @keyframes taps { 0%, 58%, 76%, 100% { transform: translateY(0); } 64% { transform: translateY(-14px); } 69% { transform: translateY(0); } 70% { transform: translateY(0); } 73% { transform: translateY(-14px); } }
  .tapfx { opacity: 0; animation: tapfx 9s linear infinite; }
  @keyframes tapfx { 0%, 66% { opacity: 0; } 69%, 70% { opacity: 1; } 72%, 77% { opacity: 0; } 78% { opacity: 1; } 82%, 100% { opacity: 0; } }

  /* tamp: funnel lifts off, tamper presses, spring compresses */
  .funnel-off { animation: funoff 5.5s ease-in-out infinite; }
  @keyframes funoff { 0%, 8% { transform: translateY(0); opacity: 1; } 24%, 92% { transform: translateY(-60px); opacity: 0; } 100% { transform: translateY(0); opacity: 1; } }
  .tamper { animation: arrive 5.5s cubic-bezier(.3, .7, .3, 1) infinite; }
  @keyframes arrive { 0%, 20% { transform: translateY(-80px); opacity: 0; } 38%, 78% { transform: translateY(0); opacity: 1; } 94%, 100% { transform: translateY(-80px); opacity: 0; } }
  .cap { animation: press 5.5s ease-in-out infinite; }
  @keyframes press { 0%, 44% { transform: translateY(0); } 56% { transform: translateY(22px); } 62%, 66% { transform: translateY(22px); } 76%, 100% { transform: translateY(0); } }
  .spring { transform-origin: 200px 172px; animation: coil 5.5s ease-in-out infinite; }
  @keyframes coil { 0%, 44% { transform: scaleY(1); } 56%, 66% { transform: scaleY(0.44); } 76%, 100% { transform: scaleY(1); } }
  .pf-t { animation: settle 5.5s ease-in-out infinite; }
  @keyframes settle { 0%, 54%, 100% { transform: translateY(0); } 58% { transform: translateY(2px); } 64% { transform: translateY(0); } }
  .hit { opacity: 0; animation: hit 5.5s linear infinite; }
  @keyframes hit { 0%, 54% { opacity: 0; } 58%, 62% { opacity: 1; } 70%, 100% { opacity: 0; } }

  /* paper */
  .paper-disc { animation: float 3.4s cubic-bezier(.3, .7, .3, 1) infinite; }
  @keyframes float { 0% { transform: translate(-20px, -110px) rotate(-8deg); opacity: 0; } 15% { opacity: 1; } 60%, 88% { transform: translate(0, 0) rotate(0); opacity: 1; } 100% { transform: translate(0, 0); opacity: 0; } }

  /* minerals: shake, lift the dropper out, squeeze, one drop, put it back */
  .bottle-s { transform-origin: 100px 262px; animation: shake 8s linear infinite; }
  @keyframes shake { 0%, 24%, 100% { transform: rotate(0); } 2% { transform: translateY(-8px) rotate(8deg); } 4% { transform: translateY(2px) rotate(-8deg); } 6% { transform: translateY(-8px) rotate(8deg); } 8% { transform: translateY(2px) rotate(-8deg); } 10% { transform: translateY(-8px) rotate(8deg); } 12% { transform: translateY(2px) rotate(-8deg); } 14% { transform: translateY(-8px) rotate(6deg); } 16% { transform: translateY(0) rotate(-4deg); } 18% { transform: translateY(0) rotate(0); } }
  .shake-lines { opacity: 0; animation: shl 8s linear infinite; }
  @keyframes shl { 0%, 1% { opacity: 0; } 3%, 16% { opacity: 1; } 19%, 100% { opacity: 0; } }
  .dropper { animation: lift 8s ease-in-out infinite; }
  @keyframes lift { 0%, 20% { transform: translate(0, 0); } 28% { transform: translate(0, -64px); } 40%, 78% { transform: translate(190px, -64px); } 90%, 100% { transform: translate(0, 0); } 86% { transform: translate(0, -64px); } }
  .bulb { transform-origin: 100px 168px; animation: squeeze2 8s ease-in-out infinite; }
  @keyframes squeeze2 { 0%, 46% { transform: scaleY(1); } 54%, 58% { transform: scaleY(0.78); } 66%, 100% { transform: scaleY(1); } }
  .drip-drop { transform-box: fill-box; opacity: 0; animation: drop2 8s cubic-bezier(.5, 0, .9, .6) infinite; }
  @keyframes drop2 { 0%, 54% { opacity: 0; transform: translateY(0) scale(0.2); } 58% { opacity: 1; transform: translateY(0) scale(1); } 74% { opacity: 1; transform: translateY(54px) scale(1); } 75%, 100% { opacity: 0; transform: translateY(54px); } }
  .ripple { opacity: 0; transform-origin: 290px 250px; animation: ripple 8s ease-out infinite; }
  @keyframes ripple { 0%, 74% { opacity: 0; transform: scale(0.3); } 76% { opacity: 1; } 90%, 100% { opacity: 0; transform: scale(1.6); } }

  /* start: portafilter locks in, brew button pulses */
  .lock-in { transform-origin: 160px 124px; animation: lock 3.2s cubic-bezier(.3, .8, .3, 1) infinite; }
  @keyframes lock { 0% { transform: translateY(26px) rotate(-18deg); opacity: 0.3; } 35% { transform: translateY(0) rotate(-18deg); opacity: 1; } 60%, 100% { transform: translateY(0) rotate(0); opacity: 1; } }
  .ico.on :global(.l) { stroke: var(--acc); stroke-opacity: 1; }
  .ico.on :global(circle.l) { fill: var(--acc); fill-opacity: 0.14; animation: pulse 1.4s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
  @keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.22); } }

  /* knock */
  .knock-pf { animation: knock 4s cubic-bezier(.6, 0, .4, 1) infinite; }
  @keyframes knock { 0%, 8%, 100% { transform: translateY(-34px); } 22% { transform: translateY(34px); } 30% { transform: translateY(8px); } 42% { transform: translateY(34px); } 60% { transform: translateY(-34px); } }
  .puck-fall { opacity: 0; animation: puck 4s ease-in infinite; }
  @keyframes puck { 0%, 40% { opacity: 0; transform: translateY(0); } 42% { opacity: 1; transform: translateY(0); } 70% { opacity: 1; transform: translateY(96px); } 71%, 100% { opacity: 0; transform: translateY(96px); } }

  /* rinse */
  .stream { fill: none; stroke: var(--acc); stroke-width: 2; stroke-linecap: round; stroke-dasharray: 6 9; opacity: 0.15; }
  .stream.on { opacity: 1; animation: water 0.5s linear infinite; animation-delay: calc(var(--i) * -0.07s); }
  @keyframes water { to { stroke-dashoffset: -15; } }
  .rinse-pf.on { animation: swirl 2.2s ease-in-out infinite; }
  @keyframes swirl { 0%, 100% { transform: translateX(-3px); } 50% { transform: translateX(3px); } }
  .pool { opacity: 0; transition: opacity 500ms ease; }
  .pool.on { opacity: 1; }
  .drip { opacity: 0; animation: drip 0.7s ease-in infinite; animation-delay: calc(var(--i) * 0.23s); }
  @keyframes drip { 0% { transform: translateY(0); opacity: 1; } 100% { transform: translateY(30px); opacity: 0; } }

  /* done: shake with ice, pour, foam */
  .shaker { transform-origin: 130px 193px; animation: shaker 8s ease-in-out infinite; }
  @keyframes shaker {
    0%, 2% { transform: translate(0, 0) rotate(0); }
    4% { transform: translate(6px, -14px) rotate(8deg); } 6% { transform: translate(-4px, 4px) rotate(-6deg); }
    8% { transform: translate(6px, -14px) rotate(8deg); } 10% { transform: translate(-4px, 4px) rotate(-6deg); }
    12% { transform: translate(6px, -14px) rotate(8deg); } 14% { transform: translate(-4px, 4px) rotate(-6deg); }
    16% { transform: translate(6px, -14px) rotate(8deg); } 18% { transform: translate(-4px, 4px) rotate(-6deg); }
    22%, 30% { transform: translate(0, 0) rotate(0); }
    40%, 66% { transform: translate(105px, -47px) rotate(112deg); }
    78%, 100% { transform: translate(0, 0) rotate(0); }
  }
  .ice { animation: ice 0.4s ease-in-out infinite alternate; }
  .ice.b { animation-delay: -0.15s; } .ice.c { animation-delay: -0.3s; }
  @keyframes ice { to { transform: translate(2px, -4px); } }
  .cap-s { animation: capoff 8s ease-in-out infinite; }
  @keyframes capoff { 0%, 28% { transform: translate(0, 0); opacity: 1; } 38%, 70% { transform: translate(8px, -26px); opacity: 0; } 82%, 100% { transform: translate(0, 0); opacity: 1; } }
  .stream-l { stroke-dasharray: 5 7; opacity: 0; animation: pourline 8s linear infinite; }
  @keyframes pourline { 0%, 42% { opacity: 0; stroke-dashoffset: 0; } 46% { opacity: 1; } 62% { opacity: 1; stroke-dashoffset: -48; } 66%, 100% { opacity: 0; stroke-dashoffset: -60; } }
  .liquid { transform-origin: 310px 262px; animation: fillup 8s ease-out infinite; }
  @keyframes fillup { 0%, 44% { transform: scaleY(0.05); opacity: 0; } 46% { opacity: 1; } 64%, 94% { transform: scaleY(1); opacity: 1; } 100% { transform: scaleY(1); opacity: 0; } }
  .foam { animation: foam 8s ease-out infinite; }
  @keyframes foam { 0%, 62% { opacity: 0; } 70%, 94% { opacity: 1; } 100% { opacity: 0; } }

  @media (prefers-reduced-motion: reduce) {
    .art * { animation: none !important; transition: none !important; }
    .art .fx { display: none; }
  }
</style>
