import styled, { css, keyframes } from 'styled-components';

import { NpcSkin, pixelUrl } from '../skins';
import { B, u } from './theme';

// a skin's pictures outside the frame: its decor round the edges and strip along the top, a sprite
// lying on the top edge, and the picture holding the name (rob's padlock), all drawn over the whole
// cloud so the frame's clipped outline can't cut them off

// where the header's name is, in px inside the cloud, measured by the cloud (see NpcDialogue)
export type NamePos = { x: number; y: number; w: number };

// screen size of n picture pixels drawn at `cell` px each (at 1920 wide; 3 is the frame's own pixel)
const px3 = (n: number, cell = 3) => `calc(${n} * ${u(cell / 4)})`;

// a skin's pictures round the frame, free to stick out past it, and its strip along the top edge
export const SkinDecor = ({ skin }: { skin: NpcSkin }) => (
  <>
    {skin.topEdge && (
      <TopEdge
        style={{
          left: u(skin.topEdge.from / 4),
          right: u(skin.topEdge.to / 4),
          top: `calc(-${skin.topEdge.row} * ${B})`,
          height: px3(skin.topEdge.art.rows.length),
          background: `${pixelUrl(skin.topEdge.art)} left top / ${px3(Math.max(...skin.topEdge.art.rows.map((r) => r.length)))} 100% repeat-x`,
        }}
      />
    )}
    {skin.decor?.map(({ src, width, height, at, cell, flip, flutter }, i) => (
      <Decor
        key={i}
        src={src}
        alt=''
        draggable={false}
        $flutter={!!flutter}
        style={
          {
            width: px3(width, cell),
            height: px3(height, cell),
            ...Object.fromEntries(Object.entries(at).map(([side, n]) => [side, u(n / 4)])),
            '--flip': flip ? -1 : 1,
            ...(flutter && {
              '--from-x': u(flutter.from[0] / 4),
              '--from-y': u(flutter.from[1] / 4),
              '--flutter-for': `${flutter.for}s`,
              '--flutter-delay': `${flutter.delay ?? 0}s`,
              '--beats': Math.round(flutter.for / 0.2),
            }),
          } as React.CSSProperties
        }
      />
    ))}
  </>
);

// a skin's pictures round the frame (over the name's picture, so a butterfly can rest on a sign),
// and its strip along the top edge. a fluttering one flies in from its start in a wavy path, its
// wings beating (it narrows and widens), and settles where it rests
const flutterIn = keyframes`
  0% {
    translate: var(--from-x) var(--from-y);
  }
  30% {
    translate: calc(var(--from-x) * 0.65) calc(var(--from-y) * 0.5 - ${u(3)});
  }
  55% {
    translate: calc(var(--from-x) * 0.3) calc(var(--from-y) * 0.3 + ${u(2)});
  }
  80% {
    translate: calc(var(--from-x) * 0.08) calc(-1 * ${u(2)});
  }
  100% {
    translate: 0 0;
  }
`;
const beat = keyframes`
  50% {
    scale: calc(var(--flip) * 0.4) 1;
  }
`;
const Decor = styled.img<{ $flutter?: boolean }>`
  position: absolute;
  z-index: 5;
  display: block;
  scale: var(--flip) 1;
  image-rendering: pixelated;
  pointer-events: none;
  ${({ $flutter }) =>
    $flutter &&
    css`
      animation:
        ${flutterIn} var(--flutter-for) steps(20) var(--flutter-delay) both,
        ${beat} 0.2s steps(1) var(--flutter-delay) var(--beats);
    `}
`;
const TopEdge = styled.div`
  position: absolute;
  z-index: 2;
  image-rendering: pixelated;
  pointer-events: none;
`;

// a skin's sprite lying on the cloud's top edge (mina's Byakuya): its lowest row rests on the
// outline, centred where the second outline's strip begins, or (behindName) half hidden behind the
// right edge of the name's picture
export const TopSprite = ({ skin, namePos }: { skin?: NpcSkin; namePos?: NamePos }) => {
  if (!skin?.onTop) return null;
  const { src, width, height, behindName } = skin.onTop;
  const nameIn = skin.nameIn;
  if (behindName && (!nameIn || !namePos)) return null; // until the name has been measured
  const left =
    behindName && nameIn && namePos
      ? `calc(${namePos.x + namePos.w / 2}px + ${nameIn.back.width / 2} * ${u((nameIn.cell ?? 2) / 4)})`
      : undefined;
  return (
    <OnTop
      src={src}
      alt=''
      draggable={false}
      style={{
        width: `calc(${width} * ${u(0.5)})`,
        height: `calc(${height} * ${u(0.5)})`,
        ...(left && { left }),
      }}
    />
  );
};

const OnTop = styled.img`
  position: absolute;
  z-index: 3;
  /* centred on where the second outline's strip begins, 60% in from the right */
  left: 40%;
  transform: translateX(-50%);
  bottom: calc(100% - ${u(0.5)});
  display: block;
  image-rendering: pixelated;
  pointer-events: none;
`;

// the name inside a skin's picture, centred where the header's name is (`at`, in px inside the
// cloud): its back, then the name
export const NameIn = ({
  skin,
  name,
  at,
}: {
  skin: NonNullable<NpcSkin['nameIn']>;
  name: string;
  at: NamePos;
}) => {
  // two screen pixels per sprite pixel by default, like the skins' other sprites
  const px = (n: number) => `calc(${n} * ${u((skin.cell ?? 2) / 4)})`;
  const sprite = ({ src, width, height }: { src: string; width: number; height: number }) => (
    <img
      src={src}
      alt=''
      draggable={false}
      style={{
        display: 'block',
        width: px(width),
        height: px(height),
        imageRendering: 'pixelated',
      }}
    />
  );
  return (
    <NameInBox
      $print={skin.print}
      style={{
        left: `calc(${at.x + at.w / 2}px - ${px(skin.back.width)} / 2)`,
        top: `calc(${at.y}px - ${px(skin.textRow + (skin.lift ?? 0))})`,
      }}
    >
      {sprite(skin.back)}
      <NameInText
        style={{
          top: px(skin.textRow),
          ...(skin.textSize && { fontSize: skin.textSize }),
        }}
      >
        {name}
      </NameInText>
    </NameInBox>
  );
};

// a receipt printing: it rises out of the frame, the part still inside hidden, so its bottom
// edge stays where the frame cuts it
const printUp = keyframes`
  from {
    transform: translateY(${u(7.5)});
    clip-path: inset(0 0 ${u(7.5)} 0);
  }
  to {
    transform: none;
    clip-path: inset(0);
  }
`;

const NameInBox = styled.div<{ $print?: boolean }>`
  position: absolute;
  z-index: 4;
  pointer-events: none;
  ${({ $print }) =>
    $print &&
    css`
      animation: ${printUp} 0.9s ease-out 0.15s both;
    `}
`;

// the header name's look, centred in the picture, with a soft shadow down and to the right
const NameInText = styled.span`
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  font-size: 1.9556cqh;
  letter-spacing: 0.2133cqh;
  white-space: nowrap;
  color: var(--npc-name);
  text-shadow:
    0.0889cqh 0 0 currentColor,
    0.1067cqh 0.1067cqh 0 rgba(0, 0, 0, 0.45);
`;
