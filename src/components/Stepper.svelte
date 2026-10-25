<script lang="ts">
  // Big −/+ control for wet-hand use. Press and hold to repeat.
  let {
    label,
    value = $bindable(),
    min,
    max,
    step = 1,
    unit = '',
    decimals = 0,
    disabled = false,
    placeholder = '–',
    compact = false,
  }: {
    label: string;
    value: number | undefined;
    min: number;
    max: number;
    step?: number;
    unit?: string;
    decimals?: number;
    disabled?: boolean;
    placeholder?: string;
    compact?: boolean;
  } = $props();

  let repeat: ReturnType<typeof setTimeout> | null = null;

  function nudge(dir: 1 | -1) {
    const base = value ?? (dir > 0 ? min - step : max + step);
    const next = Math.round((base + dir * step) / step) * step;
    value = Number(Math.min(max, Math.max(min, next)).toFixed(decimals));
  }

  function hold(dir: 1 | -1) {
    nudge(dir);
    let delay = 380;
    const again = () => { nudge(dir); delay = Math.max(70, delay * 0.8); repeat = setTimeout(again, delay); };
    repeat = setTimeout(again, delay);
  }
  function release() {
    if (repeat) clearTimeout(repeat);
    repeat = null;
  }

  const shown = $derived(value === undefined ? placeholder : value.toFixed(decimals));
</script>

<div class="stepper" class:disabled class:compact>
  <span class="label">{label}</span>
  <div class="row well">
    <button
      aria-label="Decrease {label}"
      disabled={disabled || (value !== undefined && value <= min)}
      onpointerdown={() => hold(-1)}
      onpointerup={release}
      onpointerleave={release}
      onpointercancel={release}
      onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); nudge(-1); } }}
    >−</button>
    <output aria-live="polite">{shown}<small>{unit}</small></output>
    <button
      aria-label="Increase {label}"
      disabled={disabled || (value !== undefined && value >= max)}
      onpointerdown={() => hold(1)}
      onpointerup={release}
      onpointerleave={release}
      onpointercancel={release}
      onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); nudge(1); } }}
    >+</button>
  </div>
</div>

<style>
  .stepper { display: grid; gap: 6px; }
  .stepper.disabled { opacity: 0.45; }
  .label { color: var(--paper-dim); font-size: var(--t-sm); }
  .row {
    display: grid;
    grid-template-columns: var(--touch) minmax(0, 1fr) var(--touch);
    align-items: center;
    border-radius: 20px;
  }
  button {
    height: var(--touch);
    font-size: var(--t-lg);
    font-weight: 500;
    color: var(--paper);
    border-radius: var(--radius-control);
  }
  button:active:not(:disabled) { background: rgb(255 255 255 / 0.12); }
  button:disabled { color: var(--paper-faint); cursor: default; }
  output {
    text-align: center;
    font-size: var(--t-lg);
    font-weight: 650;
  }
  .compact .row { grid-template-columns: 52px minmax(0, 1fr) 52px; }
  .compact output { font-size: var(--t-md); }
  .compact button { font-size: var(--t-md); }
  output { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  small { font-size: var(--t-sm); font-weight: 500; color: var(--paper-dim); margin-left: 3px; }
</style>
