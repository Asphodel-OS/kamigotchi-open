import { DialogueAnchor } from 'app/stores/selected';

// layer over the room art that npc speech clouds portal into
export const ROOM_OVERLAY_ID = 'room-overlay';

// rooms are 128x128 pixel art
export const ROOM_SIZE = 128;
// ~29vw on 16:9: room for the line, two columns of choices and the footer
export const BUBBLE_WIDTH = 66;
const GAP = 3;
const EDGE = 3;
// pinned by its top edge (a bubble above a face by its bottom), so longer lines grow it downward.
// the top stays clear of the menu buttons, with room for the ritual / quest tabs above it
export const TOP_MARGIN = 13;
const MAX_BOTTOM = 86; // keeps the bubble clear of the dock along the bottom
const TAIL_FROM_TOP = 9.2; // room units from a top-pinned cloud's top to its tail's tip (just under the header)

export type BubblePlacement = {
  left: number; // room units
  top?: number; // room y of the pinned top edge (most bubbles)
  bottom?: number; // room y of the pinned bottom edge (a bubble above a face)
  width: number;
  tail: 'left' | 'right' | 'down' | 'none'; // which side the tail points out of, toward the npc
  tailX?: number; // for a 'down' tail: room units from the bubble's left edge
};

// where a speaker wants their bubble: beside them (default), to their left even past the room's
// edge onto the wallpaper (minLeft, room units, can be negative), or above them. focus aims the
// tail at a face rather than the whole npc
export type BubbleOptions = {
  prefer?: 'side' | 'left' | 'above';
  focus?: boolean;
  minLeft?: number;
  width?: number; // the cloud's full width (default BUBBLE_WIDTH); it never narrows beside an npc
};

// beside the npc if there's room on either side, else across the top of the room. maxRight /
// minLeft: how far the cloud may reach (room units, past the room's edges when allowed); it always
// stays within them
export const placeBubble = (
  anchor: DialogueAnchor | null,
  maxRight = ROOM_SIZE - EDGE,
  options: BubbleOptions = {}
): BubblePlacement => {
  const minLeft = options.minLeft ?? EDGE;
  const p = placeNear(anchor, maxRight, options);
  const width = Math.min(p.width, maxRight - minLeft);
  return { ...p, width, left: Math.max(minLeft, Math.min(p.left, maxRight - width)) };
};

const placeNear = (
  anchor: DialogueAnchor | null,
  maxRight: number,
  { prefer = 'side', focus = false, minLeft = EDGE, width: want = BUBBLE_WIDTH }: BubbleOptions
): BubblePlacement => {
  const limit = maxRight;
  const fullWidth = Math.min(want, limit - minLeft);
  const centered = {
    left: Math.max(minLeft, Math.min((ROOM_SIZE - fullWidth) / 2, limit - fullWidth)),
    top: TOP_MARGIN,
    width: fullWidth,
    tail: 'none' as const,
  };
  if (!anchor) return centered;

  if (prefer === 'left') {
    if (anchor.x1 - GAP - minLeft >= want) {
      const top = Math.max((anchor.y1 + anchor.y2) / 2 - TAIL_FROM_TOP, TOP_MARGIN);
      return { left: anchor.x1 - GAP - want, top, width: want, tail: 'right' };
    }
    prefer = 'above'; // not enough screen to its left (narrow display)
  }

  if (prefer === 'above') {
    const width = fullWidth;
    const centerX = (anchor.x1 + anchor.x2) / 2;
    const left = Math.max(minLeft, Math.min(centerX - width / 4, limit - width));
    const tailX = Math.max(4, Math.min(centerX - left, width - 4));
    return { left, bottom: anchor.y1 - GAP, width, tail: 'down', tailX };
  }

  // a focused face lines the tail (near the bubble's top) up with the face's middle
  const top = Math.max(
    focus ? (anchor.y1 + anchor.y2) / 2 - TAIL_FROM_TOP : anchor.y1 + 4,
    TOP_MARGIN
  );
  if (limit - (anchor.x2 + GAP) >= want) {
    return { left: anchor.x2 + GAP, top, width: want, tail: 'left' };
  }
  if (Math.min(anchor.x1, limit) - GAP - minLeft >= want) {
    return { left: anchor.x1 - GAP - want, top, width: want, tail: 'right' };
  }
  return centered;
};

// the pinned edge holds unless a long line would push the bubble off its limit: a top-pinned
// bubble moves up just enough to keep its bottom clear of the dock, a bottom-pinned one moves
// down just enough to keep its top on screen. returns the bubble's top
export const fitBubble = (placement: BubblePlacement, height: number) => {
  if (placement.top !== undefined) {
    return Math.max(TOP_MARGIN, Math.min(placement.top, MAX_BOTTOM - height));
  }
  const bottom = Math.min(Math.max(placement.bottom ?? 0, TOP_MARGIN + height), ROOM_SIZE - EDGE);
  return bottom - height;
};

// room units to a percentage of the room overlay the bubble is drawn in
export const roomPct = (units: number) => `${(units * 100) / ROOM_SIZE}%`;

// the room is a square the full height of the screen, centered; returns the room x
// (0-128) at a given fraction of the screen width
export const screenXToRoom = (fraction: number) => {
  const { innerWidth: w, innerHeight: h } = window;
  return ((fraction * w - (w - h) / 2) * ROOM_SIZE) / h;
};
