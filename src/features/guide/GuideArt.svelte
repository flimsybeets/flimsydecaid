<script lang="ts">
  import type { GuideStepId, WeighState } from '../../lib/guide';

  // One animated scene per guide step. Line art in the skin's cream with
  // brushed-metal and coffee tones. Live values (scale weight, grind
  // setting, rinse running) feed straight into the drawings.

  let {
    step,
    weight = null,
    weighState = 'empty',
    grind = null,
    ghc = false,
    active = false,
  }: {
    step: GuideStepId;
    weight?: number | null;
    weighState?: WeighState;
    grind?: string | null;
    ghc?: boolean;
    /** Rinse: water running. */
    active?: boolean;
  } = $props();

  const lcd = $derived(weight == null ? '--.-' : weight.toFixed(1));
  const beans = [0, 1, 2, 3, 4, 5];
  const specks = Array.from({ length: 14 }, (_, i) => i);
</script>

<svg viewBox="0 0 400 300" class="art {step}" aria-hidden="true">
  <defs>
    <linearGradient id="metal" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#e3ebe8" /><stop offset="0.45" stop-color="#9aa9ab" /><stop offset="1" stop-color="#55666a" />
    </linearGradient>
    <linearGradient id="metal-h" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#5f6f72" /><stop offset="0.5" stop-color="#d9e2df" /><stop offset="1" stop-color="#5f6f72" />
    </linearGradient>
    <linearGradient id="dark" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#2b3b40" /><stop offset="1" stop-color="#121c1f" />
    </linearGradient>
    <linearGradient id="cup" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#cfc6b6" /><stop offset="0.4" stop-color="#fbf6ee" /><stop offset="1" stop-color="#bdb3a2" />
    </linearGradient>
    <radialGradient id="grounds" cx="0.5" cy="0.4" r="0.6">
      <stop offset="0" stop-color="#7a5236" /><stop offset="1" stop-color="#3e2615" />
    </radialGradient>
    <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="var(--glow, #8fd3c0)" stop-opacity="0.55" /><stop offset="1" stop-color="var(--glow, #8fd3c0)" stop-opacity="0" />
    </radialGradient>
    <symbol id="bean" viewBox="-10 -14 20 28">
      <ellipse rx="9" ry="13" fill="#6b4126" />
      <ellipse rx="9" ry="13" fill="url(#grounds)" opacity="0.5" />
      <path d="M0,-11 C-4,-4 4,4 0,11" stroke="#2a170b" stroke-width="2" fill="none" stroke-linecap="round" />
    </symbol>
  </defs>

  <ellipse cx="200" cy="268" rx="150" ry="14" fill="rgb(0 0 0 / 0.28)" />

  {#if step === 'weigh'}
    <!-- Scale with a dosing cup; beans drop in until the dose is right. Live weight on the display. -->
    <g class:settled={weighState === 'ok'}>
      {#each beans as b (b)}
        <use href="#bean" class="drop" style="--i: {b}; --x: {182 + (b % 3) * 14}px" width="20" height="28" x="-10" y="-14" />
      {/each}
    </g>
    <path d="M150,140 L250,140 L240,212 L160,212 Z" fill="url(#cup)" />
    <ellipse cx="200" cy="140" rx="50" ry="9" fill="#e9e0d1" stroke="#a89d8b" stroke-width="2" />
    <ellipse cx="200" cy="142" rx="40" ry="6" fill="url(#grounds)" opacity={weighState === 'empty' ? 0 : 0.9} />
    <rect x="80" y="212" width="240" height="14" rx="7" fill="url(#metal)" />
    <rect x="70" y="224" width="260" height="38" rx="12" fill="url(#dark)" stroke="rgb(255 255 255 / 0.15)" />
    <rect x="150" y="231" width="100" height="24" rx="6" class="lcd {weighState}" />
    <text x="200" y="249" text-anchor="middle" class="lcd-text {weighState}">{lcd}</text>
    <circle cx="105" cy="243" r="7" fill="#3a4a4e" stroke="rgb(255 255 255 / 0.25)" />
    <circle cx="295" cy="243" r="7" fill="#3a4a4e" stroke="rgb(255 255 255 / 0.25)" />
  {:else if step === 'spray'}
    <!-- A spritz of water on the beans cuts static in the grinder. -->
    <path d="M200,150 L270,150 L262,230 L208,230 Z" fill="url(#cup)" />
    <ellipse cx="235" cy="150" rx="35" ry="7" fill="#e9e0d1" stroke="#a89d8b" stroke-width="2" />
    {#each [0, 1, 2, 3, 4] as b (b)}<use href="#bean" x={215 + b * 9} y={135 + (b % 2) * 6} width="14" height="20" />{/each}
    <g class="bottle">
      <rect x="70" y="120" width="56" height="110" rx="16" fill="rgb(143 211 192 / 0.35)" stroke="var(--paper)" stroke-width="3" />
      <rect x="84" y="96" width="28" height="26" rx="5" fill="url(#metal)" />
      <path d="M112,100 L150,100 L150,112 L112,112 Z" fill="url(#metal)" />
      <path d="M96,122 L96,224" stroke="rgb(255 255 255 / 0.5)" stroke-width="2" />
      <path class="trigger" d="M104,112 Q96,132 108,140" stroke="var(--paper)" stroke-width="5" fill="none" stroke-linecap="round" />
    </g>
    {#each specks as m (m)}
      <circle class="mist" style="--i: {m}; --dx: {40 + (m % 5) * 14}px; --dy: {10 + (m % 4) * 8}px" cx="154" cy="106" r={2 + (m % 3)} fill="#bfe8ff" />
    {/each}
  {:else if step === 'dial'}
    <!-- The grinder's adjustment dial turns to your setting. -->
    <circle cx="200" cy="150" r="118" fill="url(#glow)" />
    <g class="dial-ring">
      <circle cx="200" cy="150" r="96" fill="url(#dark)" stroke="url(#metal-h)" stroke-width="10" />
      {#each Array.from({ length: 40 }, (_, i) => i) as t (t)}
        <line x1="200" y1="62" x2="200" y2={t % 5 === 0 ? 80 : 72} stroke="var(--paper)" stroke-width={t % 5 === 0 ? 3 : 1.5} opacity={t % 5 === 0 ? 0.9 : 0.5} transform="rotate({t * 9} 200 150)" />
      {/each}
    </g>
    <path d="M200,44 L190,26 L210,26 Z" fill="var(--warn)" />
    <circle cx="200" cy="150" r="58" fill="url(#metal)" />
    <text x="200" y={grind ? 168 : 162} text-anchor="middle" class="dial-num" class:small={!grind || grind.length > 4}>{grind ?? '?'}</text>
  {:else if step === 'grind'}
    <!-- Grinder whirring, grounds falling into the cup. -->
    <g class="grinder">
      <path d="M150,30 L250,30 L228,90 L172,90 Z" fill="rgb(255 255 255 / 0.12)" stroke="var(--paper)" stroke-width="3" />
      {#each [0, 1, 2, 3, 4, 5, 6] as b (b)}<use href="#bean" x={168 + b * 9} y={52 + (b % 3) * 7} width="13" height="18" />{/each}
      <rect x="160" y="88" width="80" height="104" rx="14" fill="url(#metal)" />
      <circle cx="200" cy="140" r="22" fill="url(#dark)" />
      <g class="burr"><path d="M200,124 L204,136 L216,140 L204,144 L200,156 L196,144 L184,140 L196,136 Z" fill="#9aa9ab" /></g>
      <path d="M190,192 L210,192 L206,206 L194,206 Z" fill="#55666a" />
    </g>
    {#each specks as m (m)}
      <circle class="fall" style="--i: {m}; --x: {195 + (m % 5) * 2.5}px" r="2.2" cx="0" cy="0" fill="#5a3820" />
    {/each}
    <path d="M168,222 L232,222 L226,262 L174,262 Z" fill="url(#cup)" />
    <ellipse cx="200" cy="222" rx="32" ry="6" fill="#e9e0d1" stroke="#a89d8b" stroke-width="2" />
    <ellipse cx="200" cy="225" rx="24" ry="4" class="fill-up" fill="url(#grounds)" />
  {:else if step === 'funnel'}
    <!-- Funnel on the portafilter; the cup tips the grounds in. -->
    <g class="pour-cup">
      <path d="M-30,-40 L30,-40 L24,30 L-24,30 Z" fill="url(#cup)" transform="translate(250 92)" />
    </g>
    {#each specks as m (m)}
      <circle class="pour" style="--i: {m}; --x: {204 + (m % 4) * 3}px" r="2.4" cx="0" cy="0" fill="#5a3820" />
    {/each}
    <path d="M150,160 L250,160 L238,186 L162,186 Z" fill="url(#metal-h)" opacity="0.95" />
    <path d="M162,186 L238,186 L230,226 Q200,240 170,226 Z" fill="url(#metal)" />
    <rect x="236" y="196" width="112" height="22" rx="11" fill="url(#dark)" stroke="rgb(255 255 255 / 0.2)" />
    <path d="M190,232 L210,232 L206,252 L194,252 Z" fill="#55666a" />
  {:else if step === 'tamp'}
    <!-- Tap to settle, then tamp level. -->
    <g class="pf">
      <path d="M140,170 L260,170 L250,214 Q200,232 150,214 Z" fill="url(#metal)" />
      <ellipse cx="200" cy="170" rx="60" ry="10" fill="url(#grounds)" stroke="url(#metal-h)" stroke-width="4" />
      <rect x="258" y="178" width="104" height="22" rx="11" fill="url(#dark)" stroke="rgb(255 255 255 / 0.2)" />
    </g>
    <g class="tamper">
      <rect x="186" y="40" width="28" height="60" rx="14" fill="#6b4126" stroke="var(--paper)" stroke-width="2" />
      <rect x="194" y="98" width="12" height="22" fill="url(#metal-h)" />
      <rect x="146" y="118" width="108" height="18" rx="4" fill="url(#metal)" />
    </g>
    <text x="200" y="262" text-anchor="middle" class="caption"><tspan class="cap-tap">tap, tap</tspan><tspan class="cap-tamp" x="200">press level</tspan></text>
  {:else if step === 'paper'}
    <!-- Seen from above: a paper filter settles onto the tamped puck. -->
    <circle cx="200" cy="150" r="104" fill="url(#metal-h)" />
    <circle cx="200" cy="150" r="90" fill="url(#grounds)" />
    {#each Array.from({ length: 30 }, (_, i) => i) as g (g)}
      <circle cx={200 + Math.cos(g * 2.39) * (g * 2.8)} cy={150 + Math.sin(g * 2.39) * (g * 2.8)} r="1.6" fill="#2a170b" opacity="0.6" />
    {/each}
    <g class="paper-disc">
      <circle cx="200" cy="150" r="86" fill="rgb(250 248 242 / 0.92)" />
      <circle cx="200" cy="150" r="86" fill="none" stroke="rgb(0 0 0 / 0.08)" stroke-width="6" />
      {#each Array.from({ length: 22 }, (_, i) => i) as f (f)}
        <line x1="130" y1={86 + f * 6} x2="270" y2={80 + f * 6} stroke="rgb(0 0 0 / 0.04)" />
      {/each}
    </g>
  {:else if step === 'start'}
    <!-- Lock the portafilter into the group, then start. -->
    <rect x="100" y="30" width="200" height="70" rx="18" fill="url(#metal)" />
    <rect x="140" y="98" width="120" height="18" rx="4" fill="url(#metal-h)" />
    {#if ghc}
      <circle cx="270" cy="64" r="22" fill="url(#glow)" class="pulse" />
      <circle cx="270" cy="64" r="11" fill="var(--go)" stroke="#fff" stroke-width="2" />
    {/if}
    <g class="lock">
      <path d="M144,118 L256,118 L246,160 Q200,176 154,160 Z" fill="url(#metal)" />
      <rect x="250" y="124" width="116" height="24" rx="12" fill="url(#dark)" stroke="rgb(255 255 255 / 0.2)" />
    </g>
    <path d="M140,212 L200,212 L196,256 L144,256 Z" fill="url(#cup)" />
    <path d="M200,222 Q216,222 216,234 Q216,246 199,246" fill="none" stroke="#cfc6b6" stroke-width="5" />
    {#if !ghc}
      <g class="start-pill">
        <rect x="236" y="214" width="120" height="44" rx="22" fill="var(--go)" />
        <text x="296" y="242" text-anchor="middle" class="pill-text">Start</text>
      </g>
    {/if}
  {:else if step === 'knock'}
    <!-- Knock the puck out. -->
    <rect x="120" y="170" width="160" height="92" rx="14" fill="url(#dark)" stroke="rgb(255 255 255 / 0.18)" />
    <rect x="112" y="166" width="176" height="12" rx="6" fill="#3d2a1c" />
    <g class="knock-pf">
      <path d="M150,80 L250,80 L242,116 Q200,130 158,116 Z" fill="url(#metal)" />
      <rect x="248" y="86" width="104" height="22" rx="11" fill="url(#dark)" stroke="rgb(255 255 255 / 0.2)" />
    </g>
    <ellipse class="puck" cx="200" cy="0" rx="38" ry="10" fill="url(#grounds)" />
  {:else if step === 'rinse'}
    <!-- Flush the group head with the empty portafilter held under it: the
         machine's button pulses until the water runs, then the basket gets
         rinsed (a gentle swirl, water pooling, drips into the tray). -->
    <rect x="100" y="30" width="200" height="80" rx="18" fill="url(#metal)" />
    <rect x="136" y="108" width="128" height="16" rx="4" fill="url(#metal-h)" />
    {#each [0, 1, 2, 3, 4, 5, 6, 7] as w (w)}
      <line class="stream" class:on={active} x1={146 + w * 15} y1="126" x2={146 + w * 15} y2="178" style="--i: {w}" />
    {/each}
    <g class="rinse-pf" class:on={active}>
      <path d="M138,176 L262,176 L252,214 Q200,230 148,214 Z" fill="url(#metal)" />
      <ellipse cx="200" cy="177" rx="62" ry="9" fill="url(#dark)" stroke="url(#metal-h)" stroke-width="4" />
      <ellipse cx="200" cy="179" rx="50" ry="6" class="pool" class:on={active} fill="#8ccaff" />
      <path d="M258,186 L372,214 L366,232 L254,204 Z" fill="url(#dark)" stroke="rgb(255 255 255 / 0.2)" />
      <path d="M190,222 L210,222 L206,236 L194,236 Z" fill="#55666a" />
    </g>
    {#if active}
      {#each [0, 1, 2] as d (d)}
        <circle class="drip" style="--i: {d}" cx={196 + d * 4} cy="238" r="3" fill="#8ccaff" />
      {/each}
    {/if}
    <rect x="110" y="250" width="180" height="14" rx="6" fill="url(#dark)" stroke="rgb(255 255 255 / 0.18)" />
    {#if !active}<circle cx="276" cy="70" r="22" fill="url(#glow)" style="--glow: var(--g-flow)" class="pulse" />{/if}
    <circle cx="276" cy="70" r="11" fill="var(--g-flow)" stroke="#fff" stroke-width="2" />
  {:else}
    <!-- Done: a cup with steam. -->
    <circle cx="200" cy="140" r="120" fill="url(#glow)" />
    {#each [0, 1, 2] as s (s)}
      <path class="steam" style="--i: {s}" d="M{180 + s * 20},128 C{170 + s * 20},108 {195 + s * 20},96 {184 + s * 20},72" stroke="rgb(255 255 255 / 0.5)" stroke-width="4" fill="none" stroke-linecap="round" />
    {/each}
    <ellipse cx="200" cy="232" rx="100" ry="16" fill="#d9d0c0" />
    <path d="M140,140 L260,140 L248,222 Q200,238 152,222 Z" fill="url(#cup)" />
    <ellipse cx="200" cy="140" rx="60" ry="11" fill="#c9a17a" stroke="#efe6d8" stroke-width="4" />
    <ellipse cx="200" cy="141" rx="44" ry="7" fill="#b07a4c" opacity="0.6" />
    <path d="M258,160 Q290,162 286,186 Q282,208 250,204" fill="none" stroke="#efe6d8" stroke-width="10" />
  {/if}
</svg>

<style>
  .art { width: 100%; height: 100%; overflow: visible; }
  text { font-family: var(--font); font-variant-numeric: tabular-nums; }

  /* weigh */
  .drop { animation: drop 1.6s cubic-bezier(.5, 0, .9, .6) infinite; animation-delay: calc(var(--i) * 0.27s); opacity: 0; translate: var(--x) 0; }
  @keyframes drop { 0% { transform: translateY(40px) rotate(0deg); opacity: 0; } 15% { opacity: 1; } 85% { opacity: 1; } 100% { transform: translateY(150px) rotate(200deg); opacity: 0; } }
  /* Dose reached: the beans stop falling. (A paused animation keeps its own opacity, so fade the group.) */
  g:has(> .drop) { transition: opacity 300ms ease; }
  .settled { opacity: 0; }
  .lcd { fill: #0b1f17; stroke: rgb(255 255 255 / 0.15); }
  .lcd.ok { fill: #0e3a24; }
  .lcd-text { font-size: 19px; font-weight: 700; fill: #9fe7c3; letter-spacing: 0.05em; }
  .lcd-text.under { fill: #ffd27a; }
  .lcd-text.over { fill: #ff9a8e; }
  .lcd-text.ok { fill: #8dffb9; filter: drop-shadow(0 0 6px #4cff9a); }

  /* spray */
  .bottle { transform-origin: 98px 230px; animation: tilt 2.4s ease-in-out infinite; }
  @keyframes tilt { 0%, 100% { transform: rotate(0deg); } 40%, 60% { transform: rotate(14deg); } }
  .trigger { animation: squeeze 2.4s ease-in-out infinite; transform-origin: 104px 112px; }
  @keyframes squeeze { 0%, 35%, 70%, 100% { transform: rotate(0); } 45%, 55% { transform: rotate(-12deg); } }
  .mist { opacity: 0; animation: mist 2.4s ease-out infinite; animation-delay: calc(0.9s + var(--i) * 0.03s); }
  @keyframes mist { 0% { opacity: 0; transform: translate(0, 0) scale(0.4); } 15% { opacity: 0.9; } 100% { opacity: 0; transform: translate(var(--dx), var(--dy)) scale(1.4); } }

  /* dial */
  .dial-ring { transform-origin: 200px 150px; animation: dial 1.8s cubic-bezier(.2, .9, .25, 1.15) both; }
  @keyframes dial { from { transform: rotate(-110deg); } to { transform: rotate(0deg); } }
  .dial-num { font-size: 46px; font-weight: 800; fill: var(--ink); }
  .dial-num.small { font-size: 30px; }

  /* grind */
  .grinder { animation: buzz 0.12s linear infinite; }
  @keyframes buzz { 0%, 100% { transform: translateX(0); } 50% { transform: translateX(0.8px); } }
  .burr { transform-origin: 200px 140px; animation: spin 0.5s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .fall { animation: fall 0.9s linear infinite; animation-delay: calc(var(--i) * 0.065s); translate: var(--x) 0; }
  @keyframes fall { from { transform: translateY(206px); opacity: 1; } to { transform: translateY(228px); opacity: 0.2; } }
  .fill-up { transform-origin: 200px 225px; animation: fill 4s ease-out infinite; }
  @keyframes fill { from { transform: scale(0.3); } to { transform: scale(1.1); } }

  /* funnel */
  .pour-cup { transform-origin: 250px 92px; animation: tip 3s ease-in-out infinite; }
  @keyframes tip { 0%, 100% { transform: translate(0, 0) rotate(0deg); } 30%, 75% { transform: translate(-20px, 10px) rotate(-118deg); } }
  .pour { opacity: 0; animation: pour 3s linear infinite; animation-delay: calc(0.9s + var(--i) * 0.08s); translate: var(--x) 0; }
  @keyframes pour { 0% { opacity: 0; transform: translateY(100px); } 5% { opacity: 1; } 35% { opacity: 1; transform: translateY(176px); } 36%, 100% { opacity: 0; transform: translateY(176px); } }

  /* tamp: two taps, then the tamper presses and lifts */
  .pf { animation: tap 3.6s ease-in-out infinite; }
  @keyframes tap { 0%, 30%, 100% { transform: translateY(0); } 6% { transform: translateY(-12px); } 10% { transform: translateY(0); } 16% { transform: translateY(-12px); } 20% { transform: translateY(0); } }
  .tamper { animation: tamp 3.6s cubic-bezier(.4, 0, .2, 1) infinite; }
  @keyframes tamp { 0%, 30% { transform: translateY(-20px); opacity: 0.4; } 50%, 70% { transform: translateY(40px); opacity: 1; } 90%, 100% { transform: translateY(-20px); opacity: 0.4; } }
  .caption { font-size: 18px; font-weight: 700; fill: var(--paper-dim); }
  .cap-tap { animation: cap1 3.6s step-end infinite; }
  .cap-tamp { animation: cap2 3.6s step-end infinite; }
  @keyframes cap1 { 0% { opacity: 1; } 32% { opacity: 0; } }
  @keyframes cap2 { 0% { opacity: 0; } 32% { opacity: 1; } }

  /* paper */
  .paper-disc { transform-origin: 200px 150px; animation: float 3.2s cubic-bezier(.3, .7, .3, 1) infinite; }
  @keyframes float { 0% { transform: translate(-30px, -110px) rotate(-25deg) scale(1.15); opacity: 0; } 15% { opacity: 1; } 70%, 100% { transform: translate(0, 0) rotate(0) scale(1); opacity: 1; } }

  /* start */
  .lock { transform-origin: 200px 118px; animation: lock 2.6s cubic-bezier(.3, .8, .3, 1) infinite; }
  @keyframes lock { 0% { transform: translateY(40px) rotate(-14deg); opacity: 0.4; } 35% { transform: translateY(0) rotate(-14deg); opacity: 1; } 60%, 100% { transform: translateY(0) rotate(0); } }
  .start-pill { transform-origin: 296px 236px; animation: pill 1.4s ease-in-out infinite; }
  @keyframes pill { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.06); } }
  .pill-text { font-size: 20px; font-weight: 800; fill: var(--cat-ink); }
  .pulse { transform-box: fill-box; transform-origin: center; animation: pulse 1.3s ease-in-out infinite; }
  @keyframes pulse { 0%, 100% { transform: scale(0.8); opacity: 0.5; } 50% { transform: scale(1.3); opacity: 1; } }

  /* knock */
  .knock-pf { transform-origin: 300px 97px; animation: whack 1.8s cubic-bezier(.6, 0, .4, 1) infinite; }
  @keyframes whack { 0%, 100% { transform: rotate(0); } 40% { transform: rotate(-8deg) translateY(-14px); } 55% { transform: rotate(4deg) translateY(56px); } 65% { transform: rotate(0) translateY(52px); } }
  .puck { animation: puck 1.8s ease-in infinite; opacity: 0; }
  @keyframes puck { 0%, 55% { transform: translateY(150px); opacity: 0; } 58% { opacity: 1; } 85% { transform: translateY(230px); opacity: 1; } 100% { transform: translateY(232px); opacity: 0; } }

  /* rinse */
  .stream { stroke: #8ccaff; stroke-width: 4; stroke-linecap: round; stroke-dasharray: 10 14; opacity: 0.15; }
  .stream.on { opacity: 0.9; animation: water 0.5s linear infinite; animation-delay: calc(var(--i) * -0.06s); }
  @keyframes water { to { stroke-dashoffset: -24; } }
  .rinse-pf { transform-origin: 200px 200px; }
  .rinse-pf.on { animation: swirl 2.2s ease-in-out infinite; }
  @keyframes swirl { 0%, 100% { transform: rotate(-3deg); } 50% { transform: rotate(3deg) translateX(3px); } }
  .pool { opacity: 0; transition: opacity 600ms ease; }
  .pool.on { opacity: 0.75; }
  .drip { animation: drip 0.7s ease-in infinite; animation-delay: calc(var(--i) * 0.23s); opacity: 0; }
  @keyframes drip { 0% { transform: translateY(0); opacity: 1; } 100% { transform: translateY(14px); opacity: 0; } }

  /* done */
  .steam { animation: steam 2.8s ease-in-out infinite; animation-delay: calc(var(--i) * 0.5s); opacity: 0; }
  @keyframes steam { 0% { opacity: 0; transform: translateY(10px); } 40% { opacity: 0.8; } 100% { opacity: 0; transform: translateY(-24px); } }

  @media (prefers-reduced-motion: reduce) {
    .art * { animation: none !important; }
  }
</style>
