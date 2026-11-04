import { describe, expect, it } from 'vitest';

import { fitBubble, placeBubble, TOP_MARGIN } from './bubble';

// how far a cloud may reach on a 16:9 screen, in room units: onto the wallpaper either side
const SCREEN = { maxRight: 175, minLeft: -47 };
const place = (anchor: Parameters<typeof placeBubble>[0], options = {}) =>
  placeBubble(anchor, SCREEN.maxRight, { minLeft: SCREEN.minLeft, ...options });

describe('placeBubble', () => {
  it('sits right of an npc on the left of the room, at full width', () => {
    // alaina, room 64
    const p = place({ x1: 6, y1: 2, x2: 58, y2: 108 });
    expect(p.tail).toBe('left');
    expect(p.left).toBeGreaterThan(58);
    expect(p.width).toBe(66);
    expect(p.left + p.width).toBeLessThanOrEqual(SCREEN.maxRight);
  });

  it('sits left of an npc on the right of the room', () => {
    const p = place({ x1: 90, y1: 40, x2: 120, y2: 100 });
    expect(p.tail).toBe('right');
    expect(p.left + p.width).toBeLessThan(90);
  });

  it('never narrows: beside a wide npc it reaches onto the wallpaper', () => {
    // zevana, room 3: only 42 room units free inside the room on her right
    const p = place({ x1: 10, y1: 30, x2: 80, y2: 132 });
    expect(p.tail).toBe('left');
    expect(p.width).toBe(66);
    expect(p.left + p.width).toBeGreaterThan(128);
  });

  it('falls back to the top of the room when nothing fits beside the npc', () => {
    expect(placeBubble({ x1: 5, y1: 0, x2: 120, y2: 128 }).tail).toBe('none');
    expect(placeBubble(null).tail).toBe('none');
  });

  it('stays inside its reach', () => {
    // mina, room 13, allowed only up to x 102
    const p = placeBubble({ x1: 33, y1: 12, x2: 63, y2: 68 }, 102);
    expect(p.left + p.width).toBeLessThanOrEqual(102);
  });

  it('places a wide cloud at its own width, beside the npc when it fits', () => {
    // dimidiatus' two-column line, room 19 (his click box, nudged)
    const p = place({ x1: 3, y1: 40, x2: 53, y2: 150 }, { width: 105.6 });
    expect(p.tail).toBe('left');
    expect(p.width).toBe(105.6);
    expect(p.left + p.width).toBeLessThanOrEqual(SCREEN.maxRight);
  });

  it('keeps a wide cloud whole on a 4:3 screen', () => {
    const p = placeBubble({ x1: 3, y1: 40, x2: 53, y2: 150 }, 141, { minLeft: -19, width: 105.6 });
    expect(p.width).toBe(105.6);
    expect(p.left).toBeGreaterThanOrEqual(-19);
    expect(p.left + p.width).toBeLessThanOrEqual(141);
  });

  it('stays inside its reach when the npc is past it', () => {
    // an npc beyond the right edge of a narrow screen
    const p = placeBubble({ x1: 110, y1: 40, x2: 125, y2: 90 }, 95, { minLeft: -40 });
    expect(p.left).toBeGreaterThanOrEqual(-40);
    expect(p.left + p.width).toBeLessThanOrEqual(95);
  });

  it('is pinned by its top edge, clear of the top menu', () => {
    const p = place({ x1: 6, y1: 2, x2: 58, y2: 108 });
    expect(p.top).toBeGreaterThanOrEqual(TOP_MARGIN);
    expect(p.bottom).toBeUndefined();
  });

  it('never drops into the bottom of the screen: a tall cloud moves up', () => {
    const p = place({ x1: 0, y1: 70, x2: 20, y2: 128 });
    expect(fitBubble(p, 30) + 30).toBeLessThanOrEqual(86);
  });

  it('keeps a pinned cloud where it is when it fits', () => {
    const p = place({ x1: 6, y1: 20, x2: 58, y2: 108 });
    expect(fitBubble(p, 25)).toBe(p.top);
  });

  it('keeps a cloud above a face pinned by its bottom, on screen', () => {
    const face = { x1: 6, y1: 37, x2: 23, y2: 56 };
    const p = place(face, { prefer: 'above' });
    expect(fitBubble(p, 20) + 20).toBe(p.bottom);
    expect(fitBubble(p, 45)).toBeGreaterThanOrEqual(TOP_MARGIN);
  });

  it('sits above a face with no room beside it, tail pointing down at it', () => {
    // dimidiatus' happy white face, at the room's left edge
    const face = { x1: 6, y1: 37, x2: 23, y2: 56 };
    const p = place(face, { prefer: 'above', focus: true });
    expect(p.tail).toBe('down');
    expect(p.bottom).toBeLessThan(face.y1);
    const tipX = p.left + (p.tailX ?? 0);
    expect(tipX).toBeGreaterThanOrEqual(face.x1);
    expect(tipX).toBeLessThanOrEqual(face.x2);
  });

  it('lines a focused side cloud up with the face', () => {
    // dimidiatus' sad black face
    const face = { x1: 37, y1: 40, x2: 55, y2: 60 };
    const p = place(face, { focus: true });
    expect(p.tail).toBe('left');
    expect(p.left).toBeGreaterThan(face.x2);
    // the tail, under the header, points at the face's middle
    expect((p.top ?? 0) + 9.2).toBeCloseTo((face.y1 + face.y2) / 2);
  });

  it('goes left of a face past the room edge when the screen has room', () => {
    // a wide screen leaves ~75 room units of wallpaper on the left
    const face = { x1: 6, y1: 37, x2: 23, y2: 56 };
    const p = placeBubble(face, SCREEN.maxRight, { prefer: 'left', focus: true, minLeft: -75 });
    expect(p.tail).toBe('right');
    expect(p.left + p.width).toBeLessThan(face.x1);
    expect(p.left).toBeGreaterThanOrEqual(-75);
  });

  it('falls back above the face when the full cloud would not fit to its left', () => {
    // 16:9: only ~50 units of wallpaper, less than the cloud's 66
    const face = { x1: 6, y1: 37, x2: 23, y2: 56 };
    expect(place(face, { prefer: 'left' }).tail).toBe('down');
  });
});
