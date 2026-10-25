<script lang="ts">
  import type { ProfileStep, StepExit } from '../../api/types';
  import Stepper from '../../components/Stepper.svelte';
  import Segmented from '../../components/Segmented.svelte';
  import { LIMITS, setPump, setStepTarget, stepTarget } from '../../lib/profileEdit';

  // Every setting of one step, all visible at once. Numbers are typeable
  // (tap the value) as well as nudgeable.

  let {
    step,
    index,
    count,
    onchange,
    onmove,
    onduplicate,
    ondelete,
  }: {
    step: ProfileStep;
    index: number;
    count: number;
    /** `key` names the field, so a held stepper coalesces into one undo. */
    onchange: (next: ProfileStep, key: string) => void;
    onmove: (to: number) => void;
    onduplicate: () => void;
    ondelete: () => void;
  } = $props();

  const set = (key: keyof ProfileStep | string, patch: Partial<ProfileStep>) => onchange({ ...step, ...patch }, `${index}.${key}`);

  const isPressure = $derived(step.pump === 'pressure');
  const limiterOf = $derived(isPressure ? 'flow' : 'pressure');
  const exitKind = $derived<'off' | StepExit['type']>(step.exit && step.exit.value > 0 ? step.exit.type : 'off');

  function setExitKind(kind: 'off' | StepExit['type']) {
    if (kind === 'off') return set('exit', { exit: null });
    const value = step.exit?.type === kind ? step.exit.value : kind === 'pressure' ? 4 : 2;
    set('exit', { exit: { type: kind, condition: step.exit?.condition ?? 'over', value } });
  }
</script>

<section class="inspector" aria-label="Step {index + 1}">
  <header>
    <span class="num">Step {index + 1}<small>of {count}</small></span>
    <input class="name well" aria-label="Step name" value={step.name} oninput={(e) => set('name', { name: e.currentTarget.value })} />
    <div class="tools">
      <button class="glass" aria-label="Move step earlier" disabled={index === 0} onclick={() => onmove(index - 1)}>‹</button>
      <button class="glass" aria-label="Move step later" disabled={index === count - 1} onclick={() => onmove(index + 1)}>›</button>
      <button class="glass text" onclick={onduplicate}>Duplicate</button>
      <button class="glass text danger" disabled={count <= 1} onclick={ondelete}>Delete</button>
    </div>
  </header>

  <div class="grid">
    <div class="group">
      <h3>Pump</h3>
      <Segmented label="Pump control" value={step.pump}
        options={[{ value: 'pressure', label: 'Pressure', tone: 'var(--g-pressure)' }, { value: 'flow', label: 'Flow', tone: 'var(--g-flow)' }]}
        onchange={(p) => onchange(setPump(step, p), `${index}.pump`)} />
      <Stepper compact typeable label={isPressure ? 'Pressure' : 'Flow'} unit={isPressure ? 'bar' : 'ml/s'}
        min={0} max={isPressure ? LIMITS.pressure : 10} step={0.1} decimals={1}
        bind:value={() => stepTarget(step), (v) => onchange(setStepTarget(step, v ?? 0), `${index}.target`)} />
      <Segmented label="Transition" value={step.transition}
        options={[{ value: 'fast', label: 'Fast' }, { value: 'smooth', label: 'Smooth ramp' }]}
        onchange={(t) => set('transition', { transition: t })} />
    </div>

    <div class="group">
      <h3>Time and heat</h3>
      <Stepper compact typeable label="Max time" unit="s" min={0} max={300} step={1} decimals={0}
        bind:value={() => step.seconds, (v) => set('seconds', { seconds: v ?? 0 })} />
      <Stepper compact typeable label="Temperature" unit="°C" min={LIMITS.tempMin} max={LIMITS.tempMax} step={0.5} decimals={1}
        bind:value={() => step.temperature, (v) => set('temperature', { temperature: v ?? 0 })} />
      <Segmented label="Temperature sensor" value={step.sensor}
        options={[{ value: 'coffee', label: 'Coffee', tone: 'var(--g-puck)' }, { value: 'water', label: 'Water', tone: 'var(--g-water)' }]}
        onchange={(s) => set('sensor', { sensor: s })} />
    </div>

    <div class="group">
      <h3>Exit early when</h3>
      <Segmented label="Exit on" value={exitKind}
        options={[{ value: 'off', label: 'Never' }, { value: 'pressure', label: 'Pressure', tone: 'var(--g-pressure)' }, { value: 'flow', label: 'Flow', tone: 'var(--g-flow)' }]}
        onchange={setExitKind} />
      {#if step.exit && exitKind !== 'off'}
        {@const exit = step.exit}
        <div class="pair">
          <Segmented label="Exit direction" value={exit.condition}
            options={[{ value: 'over', label: 'Over' }, { value: 'under', label: 'Under' }]}
            onchange={(c) => set('exit', { exit: { ...exit, condition: c } })} />
          <Stepper compact typeable label="Value" unit={exit.type === 'pressure' ? 'bar' : 'ml/s'} min={0} max={12} step={0.1} decimals={1}
            bind:value={() => exit.value, (v) => set('exit.value', { exit: { ...exit, value: v ?? 0 } })} />
        </div>
      {/if}
    </div>

    <div class="group">
      <h3>Limits</h3>
      <Stepper compact typeable label={isPressure ? 'Max flow' : 'Max pressure'} hint="0 = off" unit={limiterOf === 'flow' ? 'ml/s' : 'bar'}
        min={0} max={limiterOf === 'flow' ? 10 : LIMITS.pressure} step={0.1} decimals={1}
        bind:value={() => step.limiter?.value ?? 0, (v) => set('limiter', { limiter: { range: step.limiter?.range ?? 0.6, value: v ?? 0 } })} />
      {#if (step.limiter?.value ?? 0) > 0}
        <Stepper compact typeable label="Limiter range" unit={limiterOf === 'flow' ? 'ml/s' : 'bar'} min={0} max={5} step={0.1} decimals={1}
          bind:value={() => step.limiter?.range ?? 0.6, (v) => set('limiter.range', { limiter: { value: step.limiter?.value ?? 0, range: v ?? 0 } })} />
      {/if}
      <div class="pair">
        <Stepper compact typeable label="Volume" hint="0 = off" unit="ml" min={0} max={1000} step={1} decimals={0}
          bind:value={() => step.volume ?? 0, (v) => set('volume', { volume: v ?? 0 })} />
        <Stepper compact typeable label="Weight" hint="0 = off" unit="g" min={0} max={500} step={0.5} decimals={1}
          bind:value={() => step.weight ?? 0, (v) => set('weight', { weight: v ?? 0 })} />
      </div>
    </div>
  </div>
</section>

<style>
  .inspector { display: grid; gap: 14px; align-content: start; }
  /* Stays put while the settings scroll under it. */
  header {
    position: sticky;
    top: 0;
    z-index: 1;
    margin: 0 -20px;
    padding: 16px 20px 12px;
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    background: linear-gradient(#122a30 0 82%, rgb(18 42 48 / 0));
    border-radius: 30px 30px 0 0;
  }
  .num { font-size: var(--t-md); font-weight: 700; white-space: nowrap; }
  .num small { font-size: var(--t-xs); color: var(--paper-faint); font-weight: 500; margin-left: 6px; }
  .name {
    flex: 1;
    min-width: 160px;
    min-height: 52px;
    padding: 0 16px;
    border-radius: 14px;
    border: 1px solid rgb(255 255 255 / 0.08);
    font-size: var(--t-md);
    font-weight: 600;
    user-select: text;
  }
  .name:focus { outline: none; border-color: rgb(255 255 255 / 0.45); }
  .tools { display: flex; gap: 6px; }
  .tools button { min-width: 52px; min-height: 52px; padding: 0 14px; border-radius: 14px; font-size: var(--t-md); color: var(--paper); }
  .tools button.text { font-size: var(--t-sm); }
  .tools button.danger { color: #ffb3ab; }
  .tools button:disabled { opacity: 0.35; }

  .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px 20px; }
  .group { display: grid; gap: 10px; align-content: start; }
  h3 { font-size: var(--t-xs); font-weight: 650; text-transform: uppercase; letter-spacing: 0.06em; color: var(--paper-faint); }
  .pair { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 10px; align-items: end; }

  @media (min-width: 1500px) { .grid { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
</style>
