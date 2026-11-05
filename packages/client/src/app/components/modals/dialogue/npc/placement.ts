import { useDebounceValue, useWindowSize } from 'usehooks-ts';

import { DialogueAnchor } from 'app/stores/selected';
import {
  BUBBLE_WIDTH,
  BubblePlacement,
  fitBubble,
  placeBubble,
  ROOM_SIZE,
  roomPct,
  screenXToRoom,
} from '../bubble';
import { NpcSkin, skinVars } from '../skins';
import { CLOUD_NUDGE } from '../speakers';

// where the npc's cloud goes and how big: beside what was clicked, shrunk as a whole on a screen
// too narrow for it

// the quest tabs stand out past the cloud's right edge by u(13), in room units
const TABS_OUT = (((13 * 400) / 1080) * ROOM_SIZE) / 100;
const MIN_FIT = 0.6; // the least a narrow screen shrinks the cloud to (see `fit`)

// the cloud sits beside what was clicked, at its final width (a two-column line is wider), and
// may leave the room onto the wallpaper, to 1% from the screen's edges.
// the cloud is sized by the room's height, the rest of the ui by the screen's width: the same
// on a 16:9 screen, but on a narrower one (a phone held upright: the room is a square as tall
// as the screen, so wider than it) the cloud would come out far bigger than everything else,
// and wider than the screen. there it keeps its shape and shrinks as a whole: laid out at full
// size and scaled down by `fit`: towards the size a 16:9 screen of that width would give it
// (its text then matches the other components'), but never below MIN_FIT, so it stays
// readable on a phone; and within the screen's width in any case
export const placeCloud = (
  npcKey: string,
  anchor: DialogueAnchor | null,
  twoColumn: boolean,
  window: { width: number; height: number }
) => {
  const nudge = CLOUD_NUDGE[npcKey.trim().toLowerCase()] ?? 0;
  const nudged =
    anchor && nudge ? { ...anchor, x1: anchor.x1 + nudge, x2: anchor.x2 + nudge } : anchor;
  const maxRight = screenXToRoom(0.99) - TABS_OUT;
  const minLeft = screenXToRoom(0.01);
  const fullWidth = BUBBLE_WIDTH * (twoColumn ? 1.6 : 1);
  const widthFit = (maxRight - minLeft) / fullWidth;
  const aspectFit = window.width / (window.height || 1) / (16 / 9);
  const fit = Math.max(0.1, Math.min(1, widthFit, Math.max(aspectFit, MIN_FIT)));
  const placement = placeBubble(nudged, maxRight, { minLeft, width: fullWidth * fit });
  return { fit, placement };
};

// the placement is of the cloud as seen (scaled); its box is laid out at full size, so where
// the scale's origin isn't its top left (a tail on the right, or a tail down from a bottom-pinned
// cloud), the box is set off so the seen part lands where placed. with it, the cloud's colours
export const cloudStyle = (
  p: BubblePlacement,
  height: number, // the cloud's, in room units, as measured
  fit: number,
  accent: string,
  skin?: NpcSkin
) =>
  ({
    left: roomPct(p.left + (p.tail === 'right' ? p.width - p.width / fit : 0)),
    top: roomPct(fitBubble(p, height * fit) + (p.tail === 'down' ? height * fit - height : 0)),
    width: roomPct(p.width / fit),
    ...(fit < 1 && { scale: `${fit}` }),
    '--accent': accent,
    ...skinVars(skin),
    // a skin drops the default cloud's stitch round the inside of the frame
    ...(skin && { '--npc-border': 'none' }),
  }) as React.CSSProperties;

// the window's size once it has settled: a drag-resize fires every frame, and the cloud only
// needs placing and measuring again when it stops (its sizes follow the room in css meanwhile)
export const useSettledWindowSize = () => useDebounceValue(useWindowSize(), 100)[0];
