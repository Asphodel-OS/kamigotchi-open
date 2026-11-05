import styled, { css, FlattenSimpleInterpolation, keyframes } from 'styled-components';

import { B, PANEL, staircase, STEPPED, u, UNDER_OUT } from './theme';

// the cabinet of bottles' woodwork (see BottleBox): its posts, boards, feet and plaque, the bottles
// on their shelf with their tags, and the way they drop in once it's out

// a pixel of the cabinet's art: the room's own pixel (its art is 128 across the room's height), so
// the cabinet is as chunky as the shelf in her room
const SHELF_PX = 'calc(100cqh / 128)';
const px = (n: number) => `calc(${n} * ${SHELF_PX})`;
const BOARD_TOP = u(13.75); // where a shelf's board runs, just under its bottles' feet
const SHELF_ROW = BOARD_TOP; // the shelf ends at the bottles' feet: they stand on the base board

export const BoxFrame = styled.div`
  image-rendering: pixelated;
  /* its scrollbar: cream, outlined, down the right post */
  --ql-scroll: var(--ql-paper);
  --ql-scroll-outline: ${u(0.5)};
  --ql-scroll-right: ${u(1.25)};
`;
// the right post as the bar's track: the whole post takes the press, for an easy grab
export const ShelfTrack = styled.span`
  position: absolute;
  z-index: 4;
  top: 0;
  right: 0;
  bottom: 0;
  width: ${px(5)};
  cursor: pointer;
  touch-action: none;
`;
// a piece's two ends: the same picture at either side, mirrored on the right. `body` sizes and
// paints it
const mirroredEnds = (body: FlattenSimpleInterpolation) => css`
  &::before,
  &::after {
    content: '';
    position: absolute;
    ${body}
  }
  &::before {
    left: 0;
  }
  &::after {
    right: 0;
    scale: -1 1;
  }
`;

// the cabinet's inside, a wooden post down either side
export const BoxBack = styled.div`
  position: relative;
  background: var(--shelf-wall) left top / ${px(21)} ${px(10)} repeat;
  ${mirroredEnds(css`
    z-index: 2;
    top: 0;
    bottom: 0;
    width: ${px(5)};
    background: var(--shelf-post) left top / 100% ${px(8)} repeat-y;
    pointer-events: none;
  `)}
`;
// the base board it stands on, reaching past the posts, its ends stepped
export const BoxBase = styled.div`
  position: relative;
  height: ${px(5)};
  margin: 0 calc(-1 * ${px(1)});
  padding: 0 ${px(3)};
  background: var(--shelf-base) left top / ${px(24)} 100% repeat-x content-box;
  ${mirroredEnds(css`
    top: 0;
    width: ${px(3)};
    height: 100%;
    background: var(--shelf-base-end) center / 100% 100%;
  `)}
`;
// a foot under each post, the scalloped apron hanging between them
export const BoxFeet = styled.div`
  position: relative;
  height: ${px(5)};
  padding: 0 ${px(5)};
  background: var(--shelf-apron) left top / ${px(9)} ${px(4)} round no-repeat content-box;
  ${mirroredEnds(css`
    top: 0;
    width: ${px(5)};
    height: 100%;
    background: var(--shelf-foot) center / 100% 100%;
  `)}
`;
// the cabinet's top board, its shadow under it
export const BoxTop = styled.div`
  height: ${px(5)};
  background: var(--shelf-top) left top / ${px(24)} 100% repeat-x;
  image-rendering: pixelated;
`;
// the title on a cream plaque nailed to the middle of the top board, outlined, its corners
// stepped like the frame's, a nail at either end
export const BoxTitle = styled.div`
  position: absolute;
  z-index: 3;
  left: 50%;
  top: calc(${px(5)} / 2);
  translate: -50% -50%;
  padding: ${B};
  background: var(--ql-line);
  clip-path: ${staircase(B, STEPPED)};
  white-space: nowrap;
  & span {
    display: block;
    position: relative;
    padding: ${u(1.5)} ${u(6.5)};
    background: var(--ql-paper);
    clip-path: ${staircase(B, STEPPED)};
    font-size: 1.0667cqh;
    letter-spacing: 0.0889cqh;
    text-transform: uppercase;
    color: var(--ql-line);
  }
  & span::before,
  & span::after {
    content: '';
    position: absolute;
    top: calc(50% - ${B} / 2);
    width: ${B};
    height: ${B};
    background: var(--ql-line);
  }
  & span::before {
    left: ${u(2.5)};
  }
  & span::after {
    right: ${u(2.5)};
  }
`;
// the one shelf in view (its scrollbar runs the whole height of the cabinet's right post)
export const ShelfView = styled.div`
  position: relative;
  touch-action: none; /* a finger's drag steps the shelves, never scrolls the page */
`;
// one shelf: its bottles, standing on the base board below it (their tags hang on past it)
export const ShelfRow = styled.div`
  position: relative;
  height: ${SHELF_ROW};
`;
export const Shelf = styled.div`
  display: grid;
  grid-template-columns: repeat(var(--places), 1fr);
  column-gap: ${u(3)};
  padding: 0 calc(${px(5)} + ${u(2)}); /* clear of the posts */
`;
export const BottlePlace = styled.div`
  position: relative;
  display: grid;
  justify-items: center;
  padding-top: ${u(2.25)};
`;
// a potion drawn at 2 screen pixels per pixel (in a 1080px room), standing on the board
export const Bottle = styled.span`
  position: relative;
  z-index: 1;
  & img {
    display: block;
    width: ${u(13)}; /* its 26px picture at 2 screen pixels per pixel */
    height: ${u(13)};
    image-rendering: pixelated;
  }
`;
export const TagString = styled.span`
  position: absolute;
  z-index: 3;
  top: ${u(5.25)}; /* from the potion's neck */
  left: calc(50% - ${u(0.25)});
  width: ${u(0.5)};
  height: ${u(15.75)};
  background: var(--ql-string);
  pointer-events: none;
`;
// a paper tag with its corners cut and a hole for the string
export const BottleTag = styled.button`
  position: absolute;
  z-index: 3;
  top: ${u(21)};
  left: calc(-1 * ${u(1.25)}); /* wider than its place, nearly meeting the next tag */
  right: calc(-1 * ${u(1.25)});
  transform-origin: 50% calc(-1 * ${u(13.5)});
  min-height: ${u(18)};
  padding: ${u(4.125)} ${u(0.75)} ${u(2.25)};
  font-size: 1cqh; /* a little under the rows' size: the tags are narrow */
  line-height: 1.3889cqh;
  text-align: center;
  color: ${PANEL.text};
  background: var(--ql-paper);
  border: solid ${PANEL.line} ${u(0.75)};
  border-radius: ${u(0.75)};
  clip-path: polygon(
    ${u(3.375)} 0,
    calc(100% - ${u(3.375)}) 0,
    100% ${u(3.375)},
    100% 100%,
    0 100%,
    0 ${u(3.375)}
  );
  /* wraps only between words, never inside one */
  overflow-wrap: normal;
  word-break: keep-all;
  hyphens: none;
  cursor: pointer;
  &::before {
    content: '';
    position: absolute;
    top: ${u(1.5)};
    left: calc(50% - ${u(1.125)});
    width: ${u(2.25)};
    height: ${u(2.25)};
    border-radius: 50%;
    background: ${PANEL.line};
  }
  & small {
    display: block;
    margin-top: ${u(1.125)};
    font-size: 0.8333cqh;
    color: var(--ql-number);
  }
  &:hover {
    background: color-mix(in srgb, var(--ql-paper) 60%, white);
  }
`;

// the bottles drop into the box one after another once it's out, and their tags swing to rest
const BOTTLE_STEP = 0.14; // seconds between one bottle and the next
const bottleDrop = keyframes`
  0% { translate: 0 calc(-1 * ${u(18)}); opacity: 0; }
  15% { opacity: 1; }
  70% { translate: 0 ${u(0.75)}; }
  85% { translate: 0 calc(-1 * ${u(0.5)}); }
  100% { translate: 0 0; opacity: 1; }
`;
const tagSwing = keyframes`
  0% { rotate: -9deg; }
  30% { rotate: 6deg; }
  55% { rotate: -3deg; }
  80% { rotate: 1.5deg; }
  100% { rotate: 0deg; }
`;
export const bottlesIn = css`
  & ${Bottle}, & ${TagString} {
    animation: ${bottleDrop} 0.35s steps(6) both;
    animation-delay: calc(${UNDER_OUT}s + var(--i) * ${BOTTLE_STEP}s);
  }
  & ${BottleTag} {
    animation:
      ${bottleDrop} 0.35s steps(6) both,
      ${tagSwing} 0.8s steps(8) both;
    animation-delay:
      calc(${UNDER_OUT}s + var(--i) * ${BOTTLE_STEP}s),
      calc(${UNDER_OUT + 0.35}s + var(--i) * ${BOTTLE_STEP}s);
  }
`;
