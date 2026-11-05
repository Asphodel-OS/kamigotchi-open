import styled, { css, FlattenSimpleInterpolation, keyframes } from 'styled-components';

import { QuestListLook } from '../skins';
import { QuestTitle } from './questList';
import { hideScrollbar } from './ScrollBar';
import { accentMix, B, PANEL, runningStitch, u, UNDER_OUT } from './theme';

// the paper a skin's quest list is written on, in its look: a till receipt, a leather-edged notice,
// a sealed contract, a treasure map or a hanging sign (a cabinet of bottles is BottleBox), and the
// box the list scrolls in

export const UNDER_DEEP = u(12); // how much further up under the frame a contract starts
export const SIGN_PX = B; // a pixel of the sign's art: 3 screen pixels in a 1080px room, like the name sign

// a receipt's torn edge: pixel teeth six outline widths across, stepping two deep, run on past the
// right side (the cut ignores what lies outside the box)
const RECEIPT_TEETH = 40;
export const tornEdge = (b: string) => {
  const at = (x: number, depth: number) => `calc(${x} * ${b}) calc(100% - ${depth} * ${b})`;
  const teeth = [...Array(RECEIPT_TEETH)].flatMap((_, k) => {
    const x = k * 6;
    return [
      at(x, 2),
      at(x + 1, 2),
      at(x + 1, 1),
      at(x + 2, 1),
      at(x + 2, 0),
      at(x + 4, 0),
      at(x + 4, 1),
      at(x + 5, 1),
      at(x + 5, 2),
    ];
  });
  return `polygon(0 0, ${teeth.join(', ')}, calc(${RECEIPT_TEETH * 6} * ${b}) 0)`;
};

// a map's X (o outline, x mark) and compass rose (c rose, o its middle), and where the X sits on
// a quest's row
export const MAP_X = ['oo...oo', 'oxo.oxo', '.oxoxo.', '..oxo..', '.oxoxo.', 'oxo.oxo', 'oo...oo'];
export const MAP_COMPASS = [
  '....c....',
  '....c....',
  '...ccc...',
  '..c.c.c..',
  'ccccocccc',
  '..c.c.c..',
  '...ccc...',
  '....c....',
  '....c....',
];
const MAP_X_LEFT = u(2);
const MAP_X_TOP = u(1.25);
const MAP_GUTTER = u(9);

// once a map is out, its trail draws itself from stop to stop, each X landing as it's reached
const MAP_STEP = 0.27; // seconds from one stop to the next
const trailDraw = keyframes`
  from { clip-path: inset(0 0 100% 0); }
  to { clip-path: inset(0); }
`;
const xLand = keyframes`
  0% { scale: 1.8; opacity: 0; }
  100% { scale: 1; opacity: 1; }
`;
export const mapIn = css`
  & button::after {
    animation: ${trailDraw} ${MAP_STEP}s steps(4) both;
    animation-delay: calc(${UNDER_OUT}s + var(--i) * ${MAP_STEP}s);
  }
  & button::before {
    animation: ${xLand} 0.25s steps(4) both;
    animation-delay: calc(${UNDER_OUT + 0.08}s + var(--i) * ${MAP_STEP}s);
  }
`;

const UNDER_MAX = '26cqh';

// the box the list scrolls in: a set height, so opening it never moves the cloud. the list
// inside keeps its own padding and backgrounds, which scroll with it as content (cheaper than
// a background fixed to the box and repainted on every scroll)
export const UnderClip = styled.div`
  position: relative; /* over a notice's stitch */
  max-height: ${UNDER_MAX};
  overflow-y: auto;
  ${hideScrollbar}
`;
export const UnderScroll = styled.div`
  display: flex;
  flex-flow: column nowrap;
  gap: ${u(2)};
  /* room at the bottom for a receipt's torn edge */
  padding: ${u(3)} ${u(4)} ${u(5)};
`;

// each look's paper, and how its title and rows are lettered on it
const PAPER_LOOKS: Partial<Record<QuestListLook['look'], FlattenSimpleInterpolation>> = {
  /* a receipt's paper, faintly ruled like a till roll */
  receipt: css`
    background:
      repeating-linear-gradient(
        180deg,
        transparent 0 ${u(5.5)},
        color-mix(in srgb, ${PANEL.line} 6%, transparent) ${u(5.5)} ${u(5.75)}
      ),
      ${PANEL.fill};
    clip-path: ${tornEdge(B)};
    /* its title printed as a band across the receipt, in her red with cream letters, a dashed
    tear line under it */
    & ${QuestTitle} {
      margin: 0 calc(-1 * ${u(4)});
      padding: ${u(1.25)} ${u(4)};
      text-align: center;
      font-size: 1.4222cqh;
      letter-spacing: 0.2667cqh;
      color: ${PANEL.fill};
      background: var(--ql-title, ${accentMix(85, 'black')});
      border-bottom: dashed ${u(0.5)} ${PANEL.fill};
    }
  `,
  /* a notice's parchment, its stitch running just inside the leather */
  notice: css`
    background: ${PANEL.fill};
    &::before {
      content: '';
      position: absolute;
      inset: 0 ${u(1)} ${u(1)};
      pointer-events: none;
      ${runningStitch('var(--ql-stitch)', { noTop: true })}
    }
    /* its title lettered like a notice's heading: in her ink, a diamond either side, a
    double line ruled under it */
    & ${QuestTitle} {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: ${u(2.5)};
      padding-bottom: ${u(1.5)};
      font-size: 1.4222cqh;
      letter-spacing: 0.3556cqh;
      color: var(--ql-title, ${accentMix(90, 'black')});
      border-bottom: double ${u(1.25)} color-mix(in srgb, var(--ql-leather) 75%, transparent);
    }
    & ${QuestTitle}::before, & ${QuestTitle}::after {
      content: '';
      width: ${u(2)};
      height: ${u(2)};
      background: var(--ql-leather);
      rotate: 45deg;
    }
  `,
  /* a contract's black paper, gold down its sides and along the bottom with a fainter plaque line
  just inside, both running on up under the frame (no line across the top, so it reads as part of
  the cloud), its clauses lettered in gold */
  contract: css`
    --ql-title: var(--ql-ink);
    background: var(--ql-paper);
    border: solid var(--ql-plaque) ${B};
    border-top: none;
    &::before {
      content: '';
      position: absolute;
      inset: 0 ${u(1)} ${u(1)};
      border: solid color-mix(in srgb, var(--ql-plaque) 55%, transparent) ${u(0.5)};
      border-top: none;
      pointer-events: none;
    }
    & ${UnderScroll} {
      padding-top: calc(${u(3)} + ${UNDER_DEEP}); /* clear of the frame it starts behind */
      padding-bottom: ${u(9)}; /* room for the seal */
    }
    /* its title in larger white letters, like the clause numbers, a gold rule running out
    either side */
    & ${QuestTitle} {
      display: flex;
      align-items: center;
      gap: ${u(3)};
      text-align: center;
      color: var(--ql-numeral);
      font-size: 1.4222cqh;
      letter-spacing: 0.2667cqh;
      white-space: nowrap;
    }
    & ${QuestTitle}::before, & ${QuestTitle}::after {
      content: '';
      flex: 1;
      height: ${u(0.5)};
      background: var(--ql-plaque);
    }
    & button {
      display: flex;
      align-items: baseline;
      gap: ${u(2.5)};
      background: transparent;
      border: none;
      border-radius: 0;
      color: var(--ql-ink);
    }
    & button:hover:not(:disabled) {
      background: color-mix(in srgb, var(--ql-ink) 14%, transparent);
    }
  `,
  /* a map's old paper, browned at its edge and stained, a compass rose in its corner; each quest a
  stop on the trail, its X on the trail and its name beside it */
  map: css`
    --ql-title: var(--ql-ink);
    background:
      radial-gradient(
        circle at 82% 70%,
        color-mix(in srgb, var(--ql-edge) 30%, transparent) 0 ${u(6)},
        transparent ${u(6)}
      ),
      radial-gradient(
        circle at 12% 18%,
        color-mix(in srgb, var(--ql-edge) 22%, transparent) 0 ${u(4)},
        transparent ${u(4)}
      ),
      var(--ql-paper);
    box-shadow:
      inset 0 0 0 ${B} color-mix(in srgb, var(--ql-edge) 70%, transparent),
      inset 0 0 0 calc(2 * ${B}) color-mix(in srgb, var(--ql-edge) 35%, transparent);
    &::after {
      content: '';
      position: absolute;
      top: ${u(2)};
      right: ${u(2.5)};
      width: calc(9 * ${B});
      height: calc(9 * ${B});
      background: var(--ql-compass-art) center / 100% 100%;
      image-rendering: pixelated;
      pointer-events: none;
    }
    /* its title centred, in from the edges enough to clear the compass rose */
    & ${QuestTitle} {
      margin: 0 calc(9 * ${B} + ${u(2)});
      text-align: center;
      font-size: 1.4222cqh;
      letter-spacing: 0.2667cqh;
    }
    & button {
      position: relative;
      padding-left: ${MAP_GUTTER};
      background: transparent;
      border: none;
      border-radius: 0;
      color: var(--ql-ink);
    }
    & button:hover:not(:disabled) {
      background: color-mix(in srgb, var(--ql-edge) 30%, transparent);
      color: var(--ql-mark);
    }
    /* the X */
    & button::before {
      content: '';
      position: absolute;
      z-index: 1;
      left: ${MAP_X_LEFT};
      top: ${MAP_X_TOP};
      width: calc(7 * ${B});
      height: calc(7 * ${B});
      background: var(--ql-x-art) center / 100% 100%;
      image-rendering: pixelated;
    }
    /* the trail, from this stop on to the next: from the first X, up to the last */
    & button::after {
      content: '';
      position: absolute;
      left: calc(${MAP_X_LEFT} + 3 * ${B});
      width: ${B};
      top: 0;
      bottom: calc(-1 * ${u(2)});
      background: repeating-linear-gradient(
        180deg,
        var(--ql-trail) 0 calc(2 * ${B}),
        transparent calc(2 * ${B}) calc(4 * ${B})
      );
      pointer-events: none;
    }
    & button:first-of-type::after {
      top: calc(${MAP_X_TOP} + 3.5 * ${B});
    }
    & button:last-of-type::after {
      bottom: auto;
      height: calc(${MAP_X_TOP} + 3.5 * ${B});
    }
    & button:only-of-type::after {
      display: none;
    }
  `,
  /* a sign's quests on boards of their own colours */
  sign: css`
    /* the title and each quest on a plank of its own, lined up with the planks' seams */
    & ${UnderScroll} {
      gap: 0;
      padding: 0 ${u(3)};
      /* the planks scroll with the quests on them, lined up under the title's taller plank */
      background: var(--ql-plank) left 0 top calc(12 * ${SIGN_PX}) / calc(46 * ${SIGN_PX})
        calc(9 * ${SIGN_PX}) round repeat;
      image-rendering: pixelated;
    }
    /* a whole plank at a time */
    & ${UnderClip} {
      scroll-snap-type: y mandatory;
      scroll-padding-top: calc(12 * ${SIGN_PX}); /* rows snap in under the title's plank */
    }
    & button {
      scroll-snap-align: start;
    }
    & ${QuestTitle}, & button {
      display: flex;
      align-items: center;
      height: calc(9 * ${SIGN_PX});
      padding: 0 ${u(2)} ${SIGN_PX};
      text-shadow: ${SIGN_PX} ${SIGN_PX} 0 var(--ql-outline);
    }
    /* the title on a plank of its own that stays put, a line of the outline under it */
    & ${QuestTitle} {
      position: sticky;
      top: 0;
      z-index: 1;
      height: calc(12 * ${SIGN_PX}); /* a taller plank: room above and below */
      background: var(--ql-title-plank) left top / calc(46 * ${SIGN_PX}) 100% round no-repeat;
      margin: 0 calc(-1 * ${u(3)});
      padding: 0 calc(${u(3)} + ${u(5)}) ${SIGN_PX};
      box-shadow: 0 ${SIGN_PX} 0 var(--ql-outline);
      justify-content: center;
      font-size: 1.4222cqh;
      letter-spacing: 0.1778cqh;
      /* outlined all round, so it reads on the wood */
      text-shadow:
        ${SIGN_PX} 0 0 var(--ql-outline),
        calc(-1 * ${SIGN_PX}) 0 0 var(--ql-outline),
        0 ${SIGN_PX} 0 var(--ql-outline),
        0 calc(-1 * ${SIGN_PX}) 0 var(--ql-outline),
        ${SIGN_PX} ${SIGN_PX} 0 var(--ql-outline);
    }
    & button {
      background: transparent;
      border: none;
      border-radius: 0;
      color: var(--ql-text);
    }
    & button:hover:not(:disabled) {
      background: color-mix(in srgb, var(--ql-hover) 70%, transparent);
      color: var(--ql-text);
    }
  `,
};

export const UnderPaper = styled.div<{ $look: QuestListLook['look'] }>`
  position: relative;
  ${({ $look }) => PAPER_LOOKS[$look]}
`;
