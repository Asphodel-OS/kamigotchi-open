import { useMemo } from 'react';
import styled, { css, keyframes } from 'styled-components';

import { BubblePlacement } from '../bubble';
import { NpcSkin, PixelSprite } from '../skins';
import { PixelGrid } from './PixelGrid';
import {
  accentMix,
  B,
  BEVEL_CUT,
  Corners,
  PALE,
  PANEL,
  runningStitch,
  staircase,
  STEPPED,
  TAG_CUT,
  u,
  VINE_DARK,
} from './theme';

// the cloud itself: a plum stepped outline round a cream stepped inside, and the art a skin puts
// inside the frame (scenery, a corner patch, brackets, a tag's tear line and hole) or the default
// cloud's flower in its corner

/////////////////
// THE CLOUD

// the cloud springs out of its tail
const pop = keyframes`
  0% { transform: scale(0.85); opacity: 0; }
  60% { transform: scale(1.03); opacity: 1; }
  100% { transform: scale(1); }
`;

export const Cloud = styled.div<{ $open: boolean; $tail: BubblePlacement['tail'] }>`
  position: absolute; /* inside the room overlay: above the art, under the ui modals */
  isolation: isolate; /* its own layer group, so the second outline (z -1) stays above the room art */
  /* phones inflate small text on their own (font boosting), which breaks the cloud's shape: its
  text is sized by the room like everything else in it, and the player zooms in to read */
  -webkit-text-size-adjust: none;
  text-size-adjust: none;
  transform-origin: ${({ $tail }) =>
    $tail === 'down' ? 'left bottom' : `${$tail === 'right' ? 'right' : 'left'} top`};
  animation: ${pop} 0.28s cubic-bezier(0.2, 0.8, 0.2, 1.2);
  opacity: ${({ $open }) => ($open ? 1 : 0)};
  pointer-events: ${({ $open }) => ($open ? 'auto' : 'none')};
  transition: opacity 0.25s ease;
`;

// an opening (see getOpening): the stitch sewn on from the top-left corner, a widening triangle
// uncovering it
const sewOn = keyframes`
  from {
    clip-path: polygon(0 0, 0 0, 0 0);
  }
  to {
    clip-path: polygon(0 0, 300% 0, 0 300%);
  }
`;

// the frame's corners: a tag's left ones cut away in TAG_CUT steps, a bevelled frame's all in
// BEVEL_CUT, else the default two. the inside, one outline width in, takes one step fewer
const corners = (tag?: boolean, bevel?: boolean, inset = 0): Corners =>
  tag
    ? [TAG_CUT - inset, 2, 2, TAG_CUT - inset]
    : bevel
      ? [BEVEL_CUT - inset, BEVEL_CUT - inset, BEVEL_CUT - inset, BEVEL_CUT - inset]
      : STEPPED;

export const Outline = styled.div<{ $tag?: boolean; $bevel?: boolean }>`
  padding: ${B};
  background: ${PANEL.line};
  clip-path: ${({ $tag, $bevel }) => staircase(B, corners($tag, $bevel))};
  /* a tag's hole is punched right through, the room showing in it: the inside of TagHole's ring,
  three pixels square, cut out of the whole frame */
  ${({ $tag }) =>
    $tag &&
    css`
      mask:
        linear-gradient(#000 0 0) calc(5 * ${B}) center / calc(3 * ${B}) calc(3 * ${B}) no-repeat,
        linear-gradient(#000 0 0);
      mask-composite: exclude;
    `}
`;

export const Inner = styled.div<{ $tag?: boolean; $bevel?: boolean; $sew?: boolean }>`
  position: relative;
  background: ${PANEL.fill};
  clip-path: ${({ $tag, $bevel }) => staircase(B, corners($tag, $bevel, 1))};
  /* a tag leaves room on the left for its hole */
  padding-left: ${({ $tag }) => ($tag ? u(6) : 0)};
  /* a running stitch of the npc's colour just inside the edge: dashes one outline width long,
  with the same gap, along each side */
  &::after {
    content: '';
    position: absolute;
    inset: ${u(1.25)};
    pointer-events: none;
    /* an opening: the stitch is sewn on in steps, from the top-left corner outwards */
    ${({ $sew }) =>
      $sew &&
      css`
        animation: ${sewOn} 2.4s steps(24) 0.15s both;
      `}
    /* a skin brings its own pattern (--npc-border) */
    ${runningStitch(accentMix(55), { skinnable: true })}
  }
`;

/////////////////
// A SKIN'S ART INSIDE THE FRAME

// under the text and buttons: a skin's scenery, its patch of colour in the top-right corner, a
// bracket in each corner and (on a tag) the tear line by its hole
export const InsideArt = ({ skin, tag }: { skin?: NpcSkin; tag: boolean }) => {
  if (!skin) return null;
  return (
    <>
      {skin.scenery && <Scenery items={skin.scenery} />}
      {skin.patch && (
        <Patch>
          <PixelSprite art={skin.patch} cell={B} />
        </Patch>
      )}
      {skin.brackets && <Brackets art={skin.brackets} />}
      {tag && skin.tearLine && <TearLine $colour={skin.tearLine} />}
    </>
  );
};

// a skin's bracket in each corner inside the frame: drawn for the top-left, mirrored for the rest
const Brackets = ({ art }: { art: NonNullable<NpcSkin['brackets']> }) => (
  <>
    {(
      [
        [false, false],
        [true, false],
        [false, true],
        [true, true],
      ] as const
    ).map(([right, bottom]) => (
      <CornerArt
        key={`${right}${bottom}`}
        style={{
          [right ? 'right' : 'left']: 0,
          [bottom ? 'bottom' : 'top']: 0,
          transform: bottom ? 'scaleY(-1)' : undefined,
        }}
      >
        <PixelSprite art={art} cell={B} flip={right} />
      </CornerArt>
    ))}
  </>
);

// a skin's background pictures, under the text and buttons, each placed from the inside's edges
const Scenery = ({ items }: { items: NonNullable<NpcSkin['scenery']> }) => (
  <>
    {items.map(({ art, at, twinkle, over, invert }, i) => {
      const place = {
        top: 'auto',
        right: 'auto',
        ...Object.fromEntries(Object.entries(at).map(([side, px]) => [side, u(px / 4)])),
        // over the words (the text and its rows sit at the layer's own level)
        ...(over && { zIndex: 2 }),
        ...(invert && { mixBlendMode: 'difference' as const }),
      };
      const sprite = <PixelSprite art={art} cell={B} />;
      if (twinkle !== undefined)
        return (
          <Twinkling key={i} style={{ ...place, animationDelay: `${twinkle}s` }}>
            {sprite}
          </Twinkling>
        );
      return (
        <Patch key={i} style={place}>
          {sprite}
        </Patch>
      );
    })}
  </>
);

// a skin's patch of colour in the top-right corner, under the text and buttons (the frame's clip
// makes the inside its own layer, so -1 keeps it above the panel's fill)
const Patch = styled.div`
  position: absolute;
  z-index: -1;
  top: 0;
  right: 0;
  pointer-events: none;
`;

// a star blinking once when the cloud opens
const blink = keyframes`
  50% {
    opacity: 0.1;
  }
`;
const Twinkling = styled(Patch)`
  animation: ${blink} 0.4s steps(1);
`;

// a dotted tear line down a price tag's left end, just right of its hole
const TearLine = styled.div<{ $colour: string }>`
  position: absolute;
  z-index: -1;
  left: calc(11 * ${B});
  width: ${B};
  top: calc(4 * ${B});
  bottom: calc(4 * ${B});
  background: repeating-linear-gradient(
    180deg,
    ${({ $colour }) => $colour} 0 ${B},
    transparent ${B} calc(2 * ${B})
  );
  pointer-events: none;
`;

// a price tag's punched hole, in the middle of its cut-off left end
export const TagHole = ({ colour }: { colour: string }) => {
  // one art object per colour, so its picture is built once
  const art = useMemo(
    () => ({ rows: ['.ooo.', 'o...o', 'o...o', 'o...o', '.ooo.'], colours: { o: colour } }),
    [colour]
  );
  return (
    <CornerArt style={{ left: `calc(4 * ${B})`, top: `calc(50% - 2.5 * ${B})`, zIndex: 3 }}>
      <PixelSprite art={art} cell={B} />
    </CornerArt>
  );
};

// inside the frame's bottom corners, where the default flower sits (left set per corner)
const CornerArt = styled.div`
  position: absolute;
  z-index: 1;
  pointer-events: none;
`;

/////////////////
// THE DEFAULT CLOUD'S FLOWER

// a small flower inside the cloud's bottom left corner, in pixels of one outline width: four pale
// petals round a gold heart, outlined in a dark shade of the npc's colour, five pixels in from
// the frame's outer edge
const FLOWER = ['..o..', '.opo.', 'opypo', '.opo.', '..o..'];
export const CornerFlower = () => (
  <PixelGrid
    rows={FLOWER}
    colours={{ o: VINE_DARK, p: PALE, y: '#f0d36b' }}
    cell={B}
    style={{
      position: 'absolute',
      zIndex: 1 /* over the frame, under the icons above */,
      left: `calc(4 * ${B})`,
      top: `calc(100% - 9 * ${B})`,
      pointerEvents: 'none',
    }}
  />
);
