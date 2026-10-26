// Crop maths for the bag photo: a rectangle dragged over an image shown with
// object-fit: contain. Everything is pure numbers; the component only moves
// pointers and calls these.

export interface Rect { x: number; y: number; w: number; h: number }
export interface Size { w: number; h: number }
export type Handle = 'nw' | 'ne' | 'sw' | 'se';

/** Smallest crop edge on screen, in px. */
export const MIN_CROP = 48;
/** Where the crop starts: the centre 80% of the picture. */
export const INITIAL_FRACTION = 0.8;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Keep a rectangle inside `bounds`, no smaller than `min` on either edge (or the bounds, if those are smaller). */
export function clampRect(r: Rect, bounds: Rect, min = MIN_CROP): Rect {
  const w = clamp(r.w, Math.min(min, bounds.w), bounds.w);
  const h = clamp(r.h, Math.min(min, bounds.h), bounds.h);
  return {
    x: clamp(r.x, bounds.x, bounds.x + bounds.w - w),
    y: clamp(r.y, bounds.y, bounds.y + bounds.h - h),
    w, h,
  };
}

/** The centred starting rectangle, `fraction` of each edge of `bounds`. */
export function initialCrop(bounds: Rect, fraction = INITIAL_FRACTION): Rect {
  const w = bounds.w * fraction;
  const h = bounds.h * fraction;
  return { x: bounds.x + (bounds.w - w) / 2, y: bounds.y + (bounds.h - h) / 2, w, h };
}

/** Slide the whole rectangle by (dx, dy), stopping at the bounds. `start` is the rectangle when the drag began. */
export function moveRect(start: Rect, dx: number, dy: number, bounds: Rect): Rect {
  return clampRect({ ...start, x: start.x + dx, y: start.y + dy }, bounds, 0);
}

/**
 * Drag one corner by (dx, dy) from where the drag began. The opposite corner
 * stays put; the dragged one stops at the bounds and at `min` from it.
 */
export function dragHandle(start: Rect, handle: Handle, dx: number, dy: number, bounds: Rect, min = MIN_CROP): Rect {
  const west = handle === 'nw' || handle === 'sw';
  const north = handle === 'nw' || handle === 'ne';
  const fx = west ? start.x + start.w : start.x;
  const fy = north ? start.y + start.h : start.y;
  const mw = Math.min(min, bounds.w);
  const mh = Math.min(min, bounds.h);

  let mx = clamp((west ? start.x : start.x + start.w) + dx, bounds.x, bounds.x + bounds.w);
  let my = clamp((north ? start.y : start.y + start.h) + dy, bounds.y, bounds.y + bounds.h);
  mx = west ? Math.min(mx, fx - mw) : Math.max(mx, fx + mw);
  my = north ? Math.min(my, fy - mh) : Math.max(my, fy + mh);

  return { x: Math.min(mx, fx), y: Math.min(my, fy), w: Math.abs(mx - fx), h: Math.abs(my - fy) };
}

/** Where an image of `image` size lands inside `container` with object-fit: contain (centred, scaled to fit). */
export function containBox(container: Size, image: Size): Rect {
  if (image.w <= 0 || image.h <= 0 || container.w <= 0 || container.h <= 0) return { x: 0, y: 0, w: 0, h: 0 };
  const scale = Math.min(container.w / image.w, container.h / image.h);
  const w = image.w * scale;
  const h = image.h * scale;
  return { x: (container.w - w) / 2, y: (container.h - h) / 2, w, h };
}

/**
 * A rectangle in container (screen) coordinates, on an image drawn with
 * object-fit: contain, as whole pixels of the image itself.
 */
export function screenToImage(r: Rect, container: Size, image: Size): Rect {
  const box = containBox(container, image);
  if (box.w === 0) return { x: 0, y: 0, w: image.w, h: image.h };
  const k = image.w / box.w;
  const x0 = clamp(Math.round((r.x - box.x) * k), 0, image.w - 1);
  const y0 = clamp(Math.round((r.y - box.y) * k), 0, image.h - 1);
  const x1 = clamp(Math.round((r.x + r.w - box.x) * k), x0 + 1, image.w);
  const y1 = clamp(Math.round((r.y + r.h - box.y) * k), y0 + 1, image.h);
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
