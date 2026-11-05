import { RefObject } from 'react';
import styled, { css, keyframes } from 'styled-components';

import { playClick } from 'utils/sounds';
import { NpcSkin, PixelSprite } from '../skins';
import { PixelGrid } from './PixelGrid';
import {
  accentMix,
  B,
  CONTROL_HEIGHT,
  controlFrame,
  HEAD_HEIGHT,
  ICON_BUTTON,
  PALE,
  PANEL,
  SECOND_OUT,
  u,
  VINE_DARK,
} from './theme';

// the cloud's header, at its pinned top so nothing in it ever moves: the name between its two
// curls on the left, back / next on the right. the close is a badge on the frame's corner, and the
// second outline runs along the top and down past the quest tabs

export const CloudHeader = ({
  name,
  skin,
  accent,
  curls,
  nameRef,
  onBack,
  onNext,
  nextDisabled,
}: {
  name: string;
  skin?: NpcSkin;
  accent: string;
  curls?: boolean; // an opening: the curls unfurl from the name outwards
  nameRef: RefObject<HTMLSpanElement>; // the name's span, so a skin's picture can be placed on it
  onBack?: () => void; // none: the back arrow is greyed out
  onNext: () => void;
  nextDisabled: boolean;
}) => (
  <Head>
    <HeadRow>
      <Name $accent={accent} $curls={curls}>
        <NameLeft skin={skin} />
        {/* a skin's picture draws the name again over the cloud (see NameIn): the header's own
            stays, hidden, to hold its place */}
        <span ref={nameRef} style={skin?.nameIn ? { visibility: 'hidden' } : undefined}>
          {name}
        </span>
        <NameRight skin={skin} />
      </Name>
      <NavSeg>
        <NavButton
          aria-label='back'
          disabled={!onBack}
          onClick={() => {
            playClick();
            onBack?.();
          }}
        >
          <PixelArrow flip />
        </NavButton>
        <NavButton aria-label='next' disabled={nextDisabled} onClick={onNext}>
          <PixelArrow />
        </NavButton>
      </NavSeg>
    </HeadRow>
  </Head>
);

// either side of the name: the default curls, a skin's ornament, or (with none) an empty space
// the curl's size on the left, so every name starts in the same place
const NameLeft = ({ skin }: { skin?: NpcSkin }) => {
  if (!skin) return <Curl />;
  if (skin.ornament) return <PixelSprite art={skin.ornament} cell={B} />;
  return <span style={{ width: `calc(${5 + (skin.nameIndent ?? 0)} * ${B})` }} />;
};
const NameRight = ({ skin }: { skin?: NpcSkin }) => {
  if (!skin) return <Curl flip />;
  return skin.nameIn || !skin.ornament ? null : <PixelSprite art={skin.ornament} cell={B} flip />;
};

// a solid pixel triangle; the game's arrow icons blur at this size
const ARROW = ['X...', 'XX..', 'XXX.', 'XXXX', 'XXX.', 'XX..', 'X...'];
const PixelArrow = ({ flip = false }: { flip?: boolean }) => (
  <PixelGrid rows={ARROW} colours={{ X: 'currentColor' }} cell={u(0.5)} flip={flip} />
);

// an opening (see getOpening): the curls unfurling from the name outwards
const unfurlLeft = keyframes`
  from {
    clip-path: inset(0 0 0 100%);
  }
  to {
    clip-path: inset(0);
  }
`;
const unfurlRight = keyframes`
  from {
    clip-path: inset(0 100% 0 0);
  }
  to {
    clip-path: inset(0);
  }
`;

const Head = styled.div`
  display: flex;
  align-items: center;
  height: calc(${HEAD_HEIGHT} + ${B});
  padding: ${u(1)} ${u(3)} 0 ${u(5)};
`;

const HeadRow = styled.div`
  flex: 1;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: ${u(2)};
  min-height: ${CONTROL_HEIGHT};
`;

// the name, like a chapter heading: in a dark shade of the npc's colour, between two pixel curls
// that turn towards it, at the left end of the header row
const Name = styled.div<{ $accent: string; $curls?: boolean }>`
  margin-right: auto;
  display: flex;
  align-items: center;
  gap: ${u(2.5)};
  /* an opening: the curls unfurl, each drawing itself out in pixel steps from the name outwards */
  ${({ $curls }) =>
    $curls &&
    css`
      & > svg:first-child {
        animation: ${unfurlLeft} 0.5s steps(5) 0.15s both;
      }
      & > svg:last-child {
        animation: ${unfurlRight} 0.5s steps(5) 0.15s both;
      }
    `}
  font-size: 1.9556cqh;
  letter-spacing: 0.2133cqh;
  white-space: nowrap;
  /* moss: the npc's colour pushed towards an olive moss green, never towards black. set on
  the text itself, from the colour value, so nothing it sits in can turn it dark */
  span {
    color: var(--npc-name, color-mix(in srgb, ${({ $accent }) => $accent} 40%, #5a7526));
    /* a little bold: the pixel font has no bold face, so a copy a hair over thickens it */
    text-shadow: 0.0889cqh 0 0 currentColor;
  }
  /* a skin's name plate: a small stepped rectangle behind the name, just bigger than it (the
  name's own span is the one without a style: not the spacer, nor a name hidden under a picture) */
  span:not([style]) {
    background: var(--npc-name-plate, none);
    clip-path: var(--npc-name-plate-shape, none);
    padding: var(--npc-name-plate-pad, 0);
    box-shadow: var(--npc-name-plate-line, none);
  }
`;

// a curl: a pen stroke that opens towards the name and hooks back on itself at both ends, in
// pixels of one outline width, with a pale pixel in each hook. flipped, it closes the other side
const CURL = ['..dd.', '.dppd', '....d', '...d.', 'ddd..', '...d.', '....d', '.dppd', '..dd.'];
export const Curl = ({ flip = false }: { flip?: boolean }) => (
  <PixelGrid rows={CURL} colours={{ d: VINE_DARK, p: PALE }} cell={B} flip={flip} />
);

const NavSeg = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: ${u(1.5)};
`;

const NavButton = styled.button`
  ${controlFrame}
  display: flex;
  align-items: center;
  justify-content: center;
  width: ${CONTROL_HEIGHT};
  padding: 0;
  /* the arrow is drawn in currentColor: the button's text colour, not the page's global #333
  (which would otherwise land on each of its pixels) */
  svg,
  svg * {
    color: inherit;
  }
  &:disabled {
    cursor: default;
    svg {
      opacity: 0.3;
    }
  }
`;

// a second outline just outside the frame, along the top and down past the tabs, the strip between
// filled with a deep shade of the npc's colour so tabs, strip and cloud read as one piece. it sits
// under the cloud (z -1); $tabs = how many tabs hang down the side
export const SecondLine = styled.div<{ $tabs: number; $wide?: boolean }>`
  position: absolute;
  z-index: -1;
  right: calc(-1 * ${SECOND_OUT});
  top: calc(-1 * ${SECOND_OUT});
  /* along 60% of the cloud's top; further when the ritual's tab stands on it too */
  width: calc(${SECOND_OUT} + ${({ $wide }) => ($wide ? 85 : 60)}%);
  height: calc(
    ${SECOND_OUT} + 2 * ${B} + ${u(2)} + ${({ $tabs }) => $tabs} * (${ICON_BUTTON} + 2 * ${B}) -
      ${({ $tabs }) => $tabs - 1} * ${B} + ${u(2)}
  );
  /* a full outline: its left and bottom sides run under the cloud, so only their ends show, as
  the strip's closed, rounded ends */
  border: solid ${PANEL.line} ${B};
  border-radius: 0.8889cqh 1.4222cqh 0.8889cqh 0.8889cqh;
  /* the npc's colour, deepened, nearly solid */
  /* a skin may give it its own colour (mina's butter yellow) */
  background: var(--npc-second, color-mix(in srgb, ${accentMix(70, 'black')} 85%, transparent));
  pointer-events: none;
`;

// the close badge: its middle a little in from the frame's top-right corner, so it sits half over
// the corner and half outside the cloud
export const CornerClose = styled.div`
  position: absolute;
  z-index: 6;
  top: calc(-1 * ${u(4.5)});
  right: calc(-1 * ${u(3.75)});
  button {
    width: ${u(9)};
    height: ${u(9)};
    padding: 0;
    border: solid ${PANEL.line} ${B};
    border-radius: ${u(1.5)};
    background: ${PANEL.fill};
    color: var(--npc-exit, ${PANEL.line}); /* a dark skin brings a light X */
    font-size: 1.6cqh;
    /* a slightly heavier X: the pixel font has no bold, so a copy a hair over thickens it */
    text-shadow: 0.0533cqh 0 0 currentColor;
    &:hover {
      background-color: ${PANEL.row};
    }
    &:active {
      background-color: ${PANEL.rowLine};
    }
  }
`;
