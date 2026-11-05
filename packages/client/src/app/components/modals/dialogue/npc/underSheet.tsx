import { useLayoutEffect, useRef } from 'react';
import styled, { css, FlattenSimpleInterpolation, keyframes } from 'styled-components';

import { Quest } from 'network/shapes/Quest';
import { pixelUrl, QuestListLook } from '../skins';
import { BOTTLE_PLACES, BOTTLE_PLACES_NARROW, BottleBox } from './BottleBox';
import { bottlesIn } from './bottleCabinet';
import { ScrollRod, SEAL, Seal } from './contractSeal';
import { useSettledWindowSize } from './placement';
import { LIST_TITLE, ListKind, QuestItems } from './questList';
import { ScrollBar } from './ScrollBar';
import { B, cssVars, PANEL, TAG_CUT, u, UNDER_OUT } from './theme';
import {
  MAP_COMPASS,
  MAP_X,
  mapIn,
  SIGN_PX,
  tornEdge,
  UNDER_DEEP,
  UnderClip,
  UnderPaper,
  UnderScroll,
} from './underPaper';

// a skin's quest list under the cloud (its questList): it comes out from behind the frame's bottom
// edge, the part still inside hidden, in one of the looks a skin can ask for: a till receipt, a
// leather-edged notice, a sealed contract, a treasure map, a hanging sign or a cabinet of bottles

export const UnderQuestList = ({
  look,
  tag,
  open,
  kind,
  quests,
  narrow,
  scrollColour,
  onPick,
}: {
  look: QuestListLook;
  tag: boolean; // the cloud is a price tag: the list keeps clear of its cut end
  open: boolean; // out, or going back in (it keeps the last list it showed while it goes)
  kind: ListKind;
  quests: Quest[];
  narrow: boolean; // the cloud had to shrink for the screen (a phone): fewer, wider bottles
  scrollColour: string;
  onPick: (quest: Quest) => void;
}) => {
  const windowSize = useSettledWindowSize();
  const clipRef = useRef<HTMLDivElement>(null);
  // a list shows at most UNDER_ROWS quests, then scrolls (mina's receipt runs on to UNDER_MAX).
  // measured when the list or its quests change (and on resize), not on every render: it reads
  // layout
  useLayoutEffect(() => {
    const el = clipRef.current;
    const inner = el?.firstElementChild as HTMLElement | null;
    if (!el || !inner || look.look === 'receipt') return;
    const next = inner.querySelectorAll('button')[UNDER_ROWS];
    if (!next) {
      el.style.maxHeight = 'none';
      return;
    }
    const style = getComputedStyle(inner);
    const cut = next.offsetTop - parseFloat(style.rowGap || '0') + parseFloat(style.paddingBottom);
    el.style.maxHeight = `${cut}px`;
  }, [kind, look, quests, windowSize.width, windowSize.height]);
  const style = { ...sheetVars(look), '--ql-scroll': scrollColour } as React.CSSProperties;
  return (
    <UnderSlot $tag={tag} $deep={look.look === 'contract'}>
      <UnderSheet $look={look.look} $open={open} style={style}>
        {look.look === 'bottles' ? (
          <BottleBox
            key={kind}
            look={look}
            open={open}
            places={narrow ? BOTTLE_PLACES_NARROW : BOTTLE_PLACES}
            title={LIST_TITLE[kind]}
            quests={quests}
            onPick={onPick}
          />
        ) : (
          <UnderPaper $look={look.look}>
            <UnderClip ref={clipRef}>
              <UnderScroll>
                <QuestItems
                  kind={kind}
                  quests={quests}
                  contract={look.look === 'contract'}
                  onPick={onPick}
                />
              </UnderScroll>
            </UnderClip>
            <ScrollBar target={clipRef} watch={kind} />
          </UnderPaper>
        )}
        {look.look === 'contract' && (
          <>
            <Seal $open={open}>
              <img src={look.seal.src} alt='' draggable={false} />
            </Seal>
            <ScrollRod />
          </>
        )}
      </UnderSheet>
    </UnderSlot>
  );
};

// the sheet's css variables: the look's colours, a sign's planks and rope, a map's X and compass
// rose. built once per look and kept (a map's pictures are cached per art object), however often
// the cloud opens
const sheetVarsOf = new WeakMap<QuestListLook, React.CSSProperties>();
const sheetVars = (look: QuestListLook) => {
  let vars = sheetVarsOf.get(look);
  if (!vars) {
    vars = buildSheetVars(look);
    sheetVarsOf.set(look, vars);
  }
  return vars;
};
const buildSheetVars = (look: QuestListLook) =>
  ({
    ...underVars(look),
    ...(look.look === 'sign' && {
      '--ql-plank': `url(${look.plank.src})`,
      '--ql-rope-art': `url(${look.rope.src})`,
      '--ql-title-plank': `url(${look.titlePlank.src})`,
    }),
    ...(look.look === 'map' && {
      '--ql-x-art': pixelUrl({
        rows: MAP_X,
        colours: { o: look.colours.line, x: look.colours.mark },
      }),
      '--ql-compass-art': pixelUrl({
        rows: MAP_COMPASS,
        colours: { c: look.colours.compass, o: look.colours.line },
      }),
    }),
  }) as React.CSSProperties;

// a skin's quest list under the cloud (its questList): it comes out from behind the frame's bottom
// edge, the part still inside hidden. under the frame (z -1 in the cloud's layer group), in from
// its sides, clear of a tag's cut end
const UnderSlot = styled.div<{ $tag?: boolean; $deep?: boolean }>`
  position: absolute;
  z-index: -1;
  /* a contract starts well up behind the frame, so it reads as coming out of the cloud itself */
  top: calc(100% - ${B} - ${({ $deep }) => ($deep ? UNDER_DEEP : '0px')});
  left: ${({ $tag }) => ($tag ? `calc(${TAG_CUT} * ${B} + ${u(2)})` : u(4.5))};
  right: ${u(4.5)};
  /* only its top is cut: what hasn't come out from under the frame yet stays hidden */
  clip-path: inset(0 -50% -200% -50%);
  pointer-events: none;
`;

// a look's colours, as the css variables its styles read (--ql-row-line from rowLine)
const underVars = (look: QuestListLook) => cssVars('ql', 'colours' in look ? look.colours : {});

const SIGN_DROP = u(5); // how far below the frame a sign hangs, on its ropes

// a sign swings to rest once it has dropped
const swing = keyframes`
  0% { rotate: -4deg; }
  25% { rotate: 3deg; }
  50% { rotate: -1.5deg; }
  75% { rotate: 0.75deg; }
  100% { rotate: 0deg; }
`;

// coming out: an animation, not a transition, so it also plays the first time, when the list
// mounts already open (a transition would have nothing to start from)
const comeOut = keyframes`
  from {
    transform: translateY(var(--under-from));
  }
  to {
    transform: none;
  }
`;

// what else plays as a look comes out: the bottles drop into their cabinet, a map draws its trail
const COMING_OUT: Partial<Record<QuestListLook['look'], FlattenSimpleInterpolation>> = {
  bottles: bottlesIn,
  map: mapIn,
};

// each look's shape round the paper: its edge, outline and what hangs off it
const SHEET_LOOKS: Partial<Record<QuestListLook['look'], FlattenSimpleInterpolation>> = {
  /* a receipt: the outline round the paper, cut to its torn edge */
  receipt: css`
    padding: 0 ${B} ${B};
    background: ${PANEL.line};
    clip-path: ${tornEdge(B)};
  `,
  /* a notice: its leather edge down the sides and along the bottom, outlined, and the roll it
  unrolls to, a little wider than it */
  notice: css`
    padding: 0 calc(2 * ${B}) calc(2 * ${B});
    background: var(--ql-leather);
    border: solid ${PANEL.line} ${B};
    border-top: none;
    margin-bottom: ${u(2)};
    &::after {
      content: '';
      position: absolute;
      left: calc(-1 * ${u(3)});
      right: calc(-1 * ${u(3)});
      bottom: calc(-1 * ${u(2.5)});
      height: ${u(4)};
      background: var(--ql-leather);
      border: solid ${PANEL.line} ${B};
      border-radius: ${u(2)};
    }
  `,
  /* a contract: its rod hanging just below it, the seal off the rod */
  contract: css`
    margin-bottom: calc(${SEAL} / 2);
  `,
  /* a map: outlined down its sides and along the bottom */
  map: css`
    border: solid var(--ql-line) ${B};
    border-top: none;
  `,
  /* a sign: planks with a little grain between them, outlined, hung on two ropes from the frame */
  sign: css`
    margin-top: ${SIGN_DROP};
    transform-origin: top center;
    /* the name sign's own planks, one under another, whole planks across */
    background: var(--ql-plank) left top / calc(46 * ${SIGN_PX}) calc(9 * ${SIGN_PX}) round repeat;
    image-rendering: pixelated;
    border: solid var(--ql-outline) ${SIGN_PX};
    border-radius: ${SIGN_PX};
    &::before,
    &::after {
      content: '';
      position: absolute;
      top: calc(-1 * (${SIGN_DROP} + ${B}));
      width: calc(2 * ${SIGN_PX});
      height: calc(${SIGN_DROP} + ${B});
      background: var(--ql-rope-art) left top / 100% calc(7 * ${SIGN_PX}) repeat-y;
      image-rendering: pixelated;
    }
    &::before {
      left: 18%;
    }
    &::after {
      right: 18%;
    }
  `,
};

const UnderSheet = styled.div<{ $look: QuestListLook['look']; $open: boolean }>`
  position: relative;
  /* tucked away under the frame (a sign also hides its ropes) */
  --under-from: ${({ $look }) =>
    $look === 'sign' ? `calc(-100% - ${SIGN_DROP} - ${B})` : '-100%'};
  transform: ${({ $open }) => ($open ? 'none' : 'translateY(var(--under-from))')};
  visibility: ${({ $open }) => ($open ? 'visible' : 'hidden')};
  pointer-events: ${({ $open }) => ($open ? 'auto' : 'none')};
  /* going back in slides; coming out plays comeOut (and a sign then swings to rest) */
  transition:
    transform ${UNDER_OUT}s steps(9),
    visibility 0s ${({ $open }) => ($open ? '0s' : `${UNDER_OUT}s`)};
  ${({ $open, $look }) => $open && COMING_OUT[$look]}
  ${({ $open, $look }) =>
    $open &&
    ($look === 'sign'
      ? css`
          animation:
            ${comeOut} ${UNDER_OUT}s steps(9),
            ${swing} 0.9s steps(8) ${UNDER_OUT}s;
        `
      : css`
          animation: ${comeOut} ${UNDER_OUT}s steps(9);
        `)}
  ${({ $look }) => SHEET_LOOKS[$look]}
`;

const UNDER_ROWS = 5;
