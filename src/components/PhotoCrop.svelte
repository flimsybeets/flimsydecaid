<script lang="ts">
  import { untrack } from 'svelte';
  import { clampRect, containBox, dragHandle, initialCrop, moveRect, screenToImage, type Handle, type Rect } from '../lib/crop';
  import { toJpegDataUrl } from '../lib/photo';

  // Crop step for a bag photo: the picture fills the area, a rectangle with
  // draggable corners (and a draggable body) picks the part to keep, and
  // everything outside it is dimmed. Free aspect. "Use photo" crops on a
  // canvas and runs the usual downscale + JPEG. Full screen and opaque, so no
  // blur is needed; it sits above modals and honours the on-screen keyboard.

  let { source, onDone, onCancel }: {
    source: Blob;
    /** The cropped, downscaled JPEG data URL. */
    onDone: (dataUrl: string) => void;
    onCancel: () => void;
  } = $props();

  // svelte-ignore state_referenced_locally
  const url = URL.createObjectURL(source);
  $effect(() => () => URL.revokeObjectURL(url));

  let stage = $state<HTMLDivElement>();
  let area = $state({ w: 0, h: 0 });
  let natural = $state({ w: 0, h: 0 });
  let rect = $state<Rect>({ x: 0, y: 0, w: 0, h: 0 });
  let busy = $state(false);
  let error = $state<string | null>(null);

  const box = $derived(containBox(area, natural));
  const ready = $derived(box.w > 0);

  // Follow the stage size; keep the crop in the same place on the picture when it changes.
  $effect(() => {
    if (!stage) return;
    const el = stage;
    const measure = () => { area = { w: el.clientWidth, h: el.clientHeight }; };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  });

  let lastBox: Rect | null = null;
  $effect(() => {
    const b = box;
    untrack(() => {
      if (b.w === 0) return;
      if (!lastBox || lastBox.w === 0) rect = initialCrop(b);
      else {
        const k = b.w / lastBox.w;
        rect = clampRect({ x: b.x + (rect.x - lastBox.x) * k, y: b.y + (rect.y - lastBox.y) * k, w: rect.w * k, h: rect.h * k }, b);
      }
      lastBox = b;
    });
  });

  function onLoad(e: Event) {
    const img = e.currentTarget as HTMLImageElement;
    natural = { w: img.naturalWidth, h: img.naturalHeight };
  }

  // ---- Dragging ---------------------------------------------------------------
  type Drag = { kind: Handle | 'move'; x: number; y: number; start: Rect };
  let drag: Drag | null = null;

  function down(e: PointerEvent, kind: Drag['kind']) {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag = { kind, x: e.clientX, y: e.clientY, start: { ...rect } };
  }
  function move(e: PointerEvent) {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    rect = drag.kind === 'move' ? moveRect(drag.start, dx, dy, box) : dragHandle(drag.start, drag.kind, dx, dy, box);
  }
  function up() { drag = null; }

  const reset = () => { rect = initialCrop(box); };

  async function use() {
    busy = true;
    error = null;
    try {
      onDone(await toJpegDataUrl(source, 900, 0.78, screenToImage(rect, area, natural)));
    } catch {
      error = "That photo couldn't be cropped. Try another.";
      busy = false;
    }
  }

  const handles: Handle[] = ['nw', 'ne', 'sw', 'se'];
</script>

<!-- Escape cancels only the crop, not the dialog underneath. -->
<svelte:window onkeydowncapture={(e) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); onCancel(); } }} />

<div class="crop" role="dialog" aria-modal="true" aria-label="Crop photo">
  <div class="stage" bind:this={stage}>
    <img src={url} alt="" draggable="false" onload={onLoad} />
    {#if ready}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="rect"
        style="left:{rect.x}px; top:{rect.y}px; width:{rect.w}px; height:{rect.h}px"
        onpointerdown={(e) => down(e, 'move')}
        onpointermove={move}
        onpointerup={up}
        onpointercancel={up}
      >
        {#each handles as h (h)}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            class="handle {h}"
            data-handle={h}
            onpointerdown={(e) => down(e, h)}
            onpointermove={move}
            onpointerup={up}
            onpointercancel={up}
          ><span></span></div>
        {/each}
      </div>
    {/if}
  </div>
  <div class="bar">
    <p class="hint">{error ?? 'Drag the corners, or the whole frame.'}</p>
    <button class="glass" disabled={busy || !ready} onclick={reset}>Reset</button>
    <button class="glass" disabled={busy} onclick={onCancel}>Cancel</button>
    <button class="glass solid" disabled={busy || !ready} onclick={use}>{busy ? 'Saving…' : 'Use photo'}</button>
  </div>
</div>

<style>
  .crop {
    position: fixed; left: 0; right: 0; top: 0; bottom: var(--kb);
    z-index: 62;
    display: grid;
    grid-template-rows: minmax(0, 1fr) auto;
    gap: 10px;
    padding: var(--gutter);
    background: var(--ink);
    overflow: clip;
  }
  .stage { position: relative; min-height: 0; }
  .stage img { border-radius: 12px; position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; user-select: none; -webkit-user-drag: none; }

  /* The frame. The huge outer shadow dims everything outside it. */
  .rect {
    position: absolute;
    box-shadow: 0 0 0 9999px rgb(5 12 14 / 0.62);
    outline: 2px solid var(--paper);
    outline-offset: -1px;
    cursor: move;
    touch-action: none;
  }
  /* Thirds, to help line things up. */
  .rect::before, .rect::after { content: ''; position: absolute; inset: 0; pointer-events: none; }
  .rect::before { background: linear-gradient(to right, transparent calc(33.3% - 0.5px), rgb(255 255 255 / 0.28) 33.3%, transparent calc(33.3% + 0.5px), transparent calc(66.6% - 0.5px), rgb(255 255 255 / 0.28) 66.6%, transparent calc(66.6% + 0.5px)); }
  .rect::after { background: linear-gradient(to bottom, transparent calc(33.3% - 0.5px), rgb(255 255 255 / 0.28) 33.3%, transparent calc(33.3% + 0.5px), transparent calc(66.6% - 0.5px), rgb(255 255 255 / 0.28) 66.6%, transparent calc(66.6% + 0.5px)); }

  /* 48px touch targets centred on the corners; the visible corner mark is smaller. */
  .handle {
    position: absolute;
    width: var(--touch); height: var(--touch);
    display: grid; place-items: center;
    touch-action: none;
  }
  .handle span { width: 22px; height: 22px; border: 0 solid var(--paper); pointer-events: none; }
  .handle.nw { left: calc(var(--touch) / -2); top: calc(var(--touch) / -2); cursor: nwse-resize; }
  .handle.ne { right: calc(var(--touch) / -2); top: calc(var(--touch) / -2); cursor: nesw-resize; }
  .handle.sw { left: calc(var(--touch) / -2); bottom: calc(var(--touch) / -2); cursor: nesw-resize; }
  .handle.se { right: calc(var(--touch) / -2); bottom: calc(var(--touch) / -2); cursor: nwse-resize; }
  .handle.nw span { border-width: 4px 0 0 4px; transform: translate(11px, 11px); }
  .handle.ne span { border-width: 4px 4px 0 0; transform: translate(-11px, 11px); }
  .handle.sw span { border-width: 0 0 4px 4px; transform: translate(11px, -11px); }
  .handle.se span { border-width: 0 4px 4px 0; transform: translate(-11px, -11px); }

  .bar { position: relative; z-index: 1; display: flex; align-items: center; gap: 9px; }
  .hint { flex: 1; min-width: 0; color: var(--paper-dim); font-size: var(--t-sm); }
  .bar button { min-height: var(--touch); padding: 0 20px; border-radius: var(--radius-control); font-weight: 650; color: var(--paper); }
  .bar button.solid { color: var(--ink); }
  .bar button:disabled { opacity: 0.45; }
  :global(html.kb-open) .bar button { min-height: 40px; }
</style>
