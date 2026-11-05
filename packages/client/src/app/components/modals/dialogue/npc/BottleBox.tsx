import { useEffect, useMemo, useRef, useState } from 'react';

import { Quest } from 'network/shapes/Quest';
import { playClick } from 'utils/sounds';
import { QuestListLook } from '../skins';
import {
  Bottle,
  BottlePlace,
  BottleTag,
  BoxBack,
  BoxBase,
  BoxFeet,
  BoxFrame,
  BoxTitle,
  BoxTop,
  Shelf,
  ShelfRow,
  ShelfTrack,
  ShelfView,
  TagString,
} from './bottleCabinet';
import { ScrollThumb } from './ScrollBar';
import { cssVars } from './theme';
import { focusInField } from './useDialogueKeys';

// a cabinet of bottles (questList 'bottles'), drawn from the shelf in her room: its top board and
// its shadow under it, its title, then one shelf of four small bottles in view at a time (so the
// tags hanging below them, out past the cabinet, never meet the next row's), the wheel stepping a
// whole shelf at a time. each
// bottle stands on its shelf's board, held up by a bracket at either end, and its tag hangs from
// its neck on a string
export const BOTTLE_PLACES = 4;
export const BOTTLE_PLACES_NARROW = 2; // on a screen the cloud had to shrink for (a phone): wider tags
const SHELF_STEP_REST = 250; // ms between one wheel step and the next
const SHELF_SWIPE = 28; // screen pixels of drag that move one shelf
export const BottleBox = ({
  look,
  open,
  places,
  title,
  quests,
  onPick,
}: {
  look: Extract<QuestListLook, { look: 'bottles' }>;
  open: boolean; // out: it stays mounted while it goes back in, its keys let go
  places: number; // bottles per shelf
  title: string;
  quests: Quest[];
  onPick: (quest: Quest) => void;
}) => {
  const shelf = look.shelf;
  const rows = [...Array(Math.max(1, Math.ceil(quests.length / places)))].map((_, r) =>
    quests.slice(r * places, (r + 1) * places)
  );
  // one shelf in view, its tags free to hang out below the cabinet: the wheel steps from shelf to
  // shelf (a native scroll would clip them), a short rest between steps so one flick is one shelf
  const [shown, setShown] = useState(0);
  const row = Math.min(shown, rows.length - 1);
  const lastStep = useRef(0);
  const step = (by: number) => {
    const next = Math.max(0, Math.min(rows.length - 1, row + by));
    if (next === row) return;
    playClick();
    setShown(next);
  };
  const onWheel = (e: React.WheelEvent) => {
    if (rows.length < 2 || Math.abs(e.deltaY) < 4) return;
    const now = performance.now();
    if (now - lastStep.current < SHELF_STEP_REST) return;
    lastStep.current = now;
    step(Math.sign(e.deltaY));
  };
  // the bar on the right post can be dragged (or the post clicked) to the shelf wanted: by finger
  // too, so the later shelves are reachable without a wheel
  const rowRef = useRef(row);
  rowRef.current = row;
  const trackRef = useRef<HTMLSpanElement>(null);
  const dragTo = (e: React.PointerEvent) => {
    const el = trackRef.current;
    if (!el) return;
    const { top, height } = el.getBoundingClientRect();
    const next = Math.max(
      0,
      Math.min(rows.length - 1, Math.floor(((e.clientY - top) / height) * rows.length))
    );
    if (next === rowRef.current) return;
    rowRef.current = next;
    playClick();
    setShown(next);
  };
  // the shelf itself drags too: a swipe up or down on the bottles or their tags (a finger, on a
  // phone) steps a shelf each SHELF_SWIPE of travel, in the way the bottles move. a swipe that
  // ends on a tag isn't a tap on it
  const swipe = useRef<{ y: number; moved: boolean }>();
  const onSwipeStart = (e: React.PointerEvent) => {
    if (rows.length < 2 || e.button !== 0) return;
    swipe.current = { y: e.clientY, moved: false };
  };
  const onSwipeMove = (e: React.PointerEvent) => {
    const drag = swipe.current;
    if (!drag || !e.buttons) return;
    const dy = e.clientY - drag.y;
    if (Math.abs(dy) < SHELF_SWIPE) return;
    drag.y = e.clientY;
    drag.moved = true;
    step(dy < 0 ? 1 : -1);
  };
  const onSwipeEnd = () => {
    const drag = swipe.current;
    if (drag?.moved) setTimeout(() => (swipe.current = undefined), 0); /* after the click */
    else swipe.current = undefined;
  };
  const onSwipeClick = (e: React.MouseEvent) => {
    if (!swipe.current?.moved) return;
    e.preventDefault();
    e.stopPropagation();
  };
  // the arrow keys step too while it's out (not while a field has focus)
  const stepRef = useRef(step);
  stepRef.current = step;
  useEffect(() => {
    if (!open || rows.length < 2) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
      if (focusInField()) return;
      e.preventDefault();
      stepRef.current(e.key === 'ArrowUp' ? -1 : 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, rows.length]);
  // each piece's art as --shelf-<piece> (--shelf-base-end from baseEnd), built once per look
  const art = useMemo(() => cssVars('shelf', shelf, (sprite) => `url(${sprite.src})`), [shelf]);
  return (
    <BoxFrame style={art}>
      <BoxBack>
        <BoxTop />
        <BoxTitle>
          <span>{title}</span>
        </BoxTitle>
        <ShelfView
          onWheel={onWheel}
          onPointerDown={onSwipeStart}
          onPointerMove={onSwipeMove}
          onPointerUp={onSwipeEnd}
          onPointerCancel={onSwipeEnd}
          onClickCapture={onSwipeClick}
        >
          <ShelfRow key={row}>
            <Shelf style={{ '--places': places } as React.CSSProperties}>
              {rows[row].map((quest, k) => {
                const i = row * places + k;
                return (
                  <BottlePlace key={i} style={{ '--i': k } as React.CSSProperties}>
                    <Bottle>
                      <img
                        src={look.bottles[quest.index % look.bottles.length].src}
                        alt=''
                        draggable={false}
                      />
                    </Bottle>
                    <TagString />
                    <BottleTag type='button' onClick={() => onPick(quest)}>
                      {quest.name}
                      <small>no. {i + 1}</small>
                    </BottleTag>
                  </BottlePlace>
                );
              })}
            </Shelf>
          </ShelfRow>
        </ShelfView>
        {/* more shelves: the wheel and the arrow keys step between them, and the bar on the
        right post, showing which is out, can be dragged (or the post clicked) to one */}
        {rows.length > 1 && (
          <ShelfTrack
            ref={trackRef}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              dragTo(e);
            }}
            onPointerMove={(e) => {
              if (e.buttons) dragTo(e);
            }}
          >
            <ScrollThumb
              style={{ top: `${(row / rows.length) * 100}%`, height: `${100 / rows.length}%` }}
            />
          </ShelfTrack>
        )}
      </BoxBack>
      <BoxBase />
      <BoxFeet />
    </BoxFrame>
  );
};
