import { describe, expect, it } from 'vitest';
import { clampRect, containBox, dragHandle, initialCrop, moveRect, screenToImage, type Rect } from '../src/lib/crop';

const bounds: Rect = { x: 100, y: 50, w: 400, h: 300 };

describe('clampRect', () => {
  it('pulls a rectangle back inside', () => {
    expect(clampRect({ x: 0, y: 0, w: 100, h: 100 }, bounds)).toEqual({ x: 100, y: 50, w: 100, h: 100 });
    expect(clampRect({ x: 450, y: 340, w: 100, h: 100 }, bounds)).toEqual({ x: 400, y: 250, w: 100, h: 100 });
  });
  it('limits size to the bounds and to the minimum', () => {
    expect(clampRect({ x: 0, y: 0, w: 900, h: 900 }, bounds)).toEqual(bounds);
    expect(clampRect({ x: 200, y: 100, w: 10, h: 10 }, bounds, 48)).toEqual({ x: 200, y: 100, w: 48, h: 48 });
  });
  it('copes with bounds smaller than the minimum', () => {
    expect(clampRect({ x: 0, y: 0, w: 5, h: 5 }, { x: 0, y: 0, w: 20, h: 20 }, 48)).toEqual({ x: 0, y: 0, w: 20, h: 20 });
  });
});

describe('initialCrop', () => {
  it('is the centre 80%', () => {
    expect(initialCrop({ x: 0, y: 0, w: 1000, h: 500 })).toEqual({ x: 100, y: 50, w: 800, h: 400 });
    expect(initialCrop(bounds)).toEqual({ x: 140, y: 80, w: 320, h: 240 });
  });
});

describe('moveRect', () => {
  const r: Rect = { x: 200, y: 100, w: 100, h: 80 };
  it('moves by the drag', () => expect(moveRect(r, 20, -10, bounds)).toEqual({ x: 220, y: 90, w: 100, h: 80 }));
  it('stops at every edge without resizing', () => {
    expect(moveRect(r, -999, -999, bounds)).toEqual({ x: 100, y: 50, w: 100, h: 80 });
    expect(moveRect(r, 999, 999, bounds)).toEqual({ x: 400, y: 270, w: 100, h: 80 });
  });
});

describe('dragHandle', () => {
  const r: Rect = { x: 200, y: 100, w: 100, h: 80 };
  it('moves a corner and keeps the opposite one fixed', () => {
    expect(dragHandle(r, 'nw', -30, -20, bounds)).toEqual({ x: 170, y: 80, w: 130, h: 100 });
    expect(dragHandle(r, 'se', 30, 20, bounds)).toEqual({ x: 200, y: 100, w: 130, h: 100 });
    expect(dragHandle(r, 'ne', 10, -10, bounds)).toEqual({ x: 200, y: 90, w: 110, h: 90 });
    expect(dragHandle(r, 'sw', -10, 10, bounds)).toEqual({ x: 190, y: 100, w: 110, h: 90 });
  });
  it('stops at the bounds', () => {
    expect(dragHandle(r, 'nw', -999, -999, bounds)).toEqual({ x: 100, y: 50, w: 200, h: 130 });
    expect(dragHandle(r, 'se', 999, 999, bounds)).toEqual({ x: 200, y: 100, w: 300, h: 250 });
  });
  it('keeps the minimum size instead of flipping over', () => {
    expect(dragHandle(r, 'nw', 999, 999, bounds, 48)).toEqual({ x: 252, y: 132, w: 48, h: 48 });
    expect(dragHandle(r, 'se', -999, -999, bounds, 48)).toEqual({ x: 200, y: 100, w: 48, h: 48 });
  });
});

describe('containBox', () => {
  it('letterboxes a wide image', () => expect(containBox({ w: 800, h: 600 }, { w: 2000, h: 1000 })).toEqual({ x: 0, y: 100, w: 800, h: 400 }));
  it('pillarboxes a tall image', () => expect(containBox({ w: 800, h: 600 }, { w: 1000, h: 2000 })).toEqual({ x: 250, y: 0, w: 300, h: 600 }));
  it('is empty for nothing', () => expect(containBox({ w: 0, h: 600 }, { w: 10, h: 10 })).toEqual({ x: 0, y: 0, w: 0, h: 0 }));
});

describe('screenToImage', () => {
  const container = { w: 800, h: 600 };
  const image = { w: 2000, h: 1000 }; // box: 0,100 800x400, 2.5 image px per screen px
  it('maps the whole picture to the whole image', () => {
    expect(screenToImage({ x: 0, y: 100, w: 800, h: 400 }, container, image)).toEqual({ x: 0, y: 0, w: 2000, h: 1000 });
  });
  it('maps a rectangle inside it', () => {
    expect(screenToImage({ x: 80, y: 140, w: 400, h: 200 }, container, image)).toEqual({ x: 200, y: 100, w: 1000, h: 500 });
  });
  it('clamps anything outside the picture', () => {
    expect(screenToImage({ x: -50, y: 0, w: 2000, h: 2000 }, container, image)).toEqual({ x: 0, y: 0, w: 2000, h: 1000 });
  });
  it('handles a pillarboxed image', () => {
    // box: 250,0 300x600; 1000/300 image px per screen px
    const r = screenToImage({ x: 250, y: 0, w: 150, h: 300 }, container, { w: 1000, h: 2000 });
    expect(r).toEqual({ x: 0, y: 0, w: 500, h: 1000 });
  });
  it('never returns an empty rectangle', () => {
    const r = screenToImage({ x: 799, y: 499, w: 0, h: 0 }, container, image);
    expect(r.w).toBeGreaterThanOrEqual(1);
    expect(r.h).toBeGreaterThanOrEqual(1);
  });
});
