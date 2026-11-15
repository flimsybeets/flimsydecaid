<script lang="ts">
  import { app } from '../../state/app.svelte';

  // The coffee's stored photo, as a small framed picture in a corner of a dose
  // or grind step's illustration, so whoever follows the guide picks the right
  // bag. Nothing is drawn while it loads or when the coffee has no photo.
  // The parent must be position: relative.
  let { beanId, small = false }: { beanId: string | null | undefined; small?: boolean } = $props();

  $effect(() => { if (beanId) void app.loadBeanPhoto(beanId); });
  const photo = $derived(beanId ? app.beanPhotos[beanId] ?? null : null);
  const bean = $derived(beanId ? app.beans.find((b) => b.id === beanId) ?? null : null);
  const colour = $derived(beanId ? app.coffeeColours[beanId] ?? null : null);
</script>

{#if photo}
  <figure class="coffee-pic" class:small style={colour ? `--edge: ${colour}` : ''}>
    <img src={photo} alt={bean ? `${bean.name}${bean.roaster ? `, ${bean.roaster}` : ''}` : 'The coffee'} />
    {#if bean && !small}<figcaption>{bean.name}</figcaption>{/if}
  </figure>
{/if}

<style>
  .coffee-pic {
    position: absolute; right: 14px; bottom: 14px; z-index: 1; margin: 0;
    width: 34%; max-width: 180px; padding: 6px 6px 4px; border-radius: 16px;
    background: rgb(10 22 26 / 0.86); border: 1px solid rgb(255 255 255 / 0.14);
    box-shadow: inset 4px 0 0 var(--edge, transparent), 0 10px 24px -12px rgb(0 0 0 / 0.7);
    display: grid; gap: 4px; transform: rotate(-2deg);
    animation: pic-in 420ms cubic-bezier(.2, .8, .2, 1);
  }
  .coffee-pic.small { right: 8px; bottom: 8px; width: 30%; padding: 4px; border-radius: 10px; }
  img { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 11px; display: block; }
  .small img { border-radius: 7px; }
  figcaption { font-size: var(--t-xs); font-weight: 650; color: var(--paper); text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding: 0 2px; }
  @keyframes pic-in { from { opacity: 0; transform: translateY(8px) rotate(-2deg); } }
  @media (prefers-reduced-motion: reduce) { .coffee-pic { animation: none; } }
</style>
