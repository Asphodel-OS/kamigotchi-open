import styled, { css, keyframes } from 'styled-components';

import { RitualIcon } from 'assets/images/icons/menu';
import { NpcSkin, PixelSprite, RitualColours } from '../skins';
import { Curl } from './header';
import { accentMix, B, PALE, PANEL, runningStitch, SECOND_OUT, u } from './theme';
import { TintedIcon } from './TintedIcon';

// the npc's ritual (shop, sacrifice, adoption...): a label in the npc's own cloud look pinned over
// the cloud's top edge beside the close, its icon on a medal that turns like a coin as it arrives

// the ritual's tab rises from behind the frame this long (s) after the cloud opens
const RITUAL_DELAY = 1;

// the ritual's lower bracket, the skin's turned upside down: one per art object, kept, so its
// picture is only ever drawn once (see pixelData) however often the cloud opens
type Bracket = NonNullable<NonNullable<NpcSkin['ritual']>['brackets']>;
const lowered = new WeakMap<Bracket, Bracket>();
const upsideDown = (art: Bracket) => {
  let flipped = lowered.get(art);
  if (!flipped) {
    flipped = { ...art, rows: [...art.rows].reverse() };
    lowered.set(art, flipped);
  }
  return flipped;
};

export const RitualTab = ({
  name,
  skin,
  accent,
  colours,
  onClick,
}: {
  name: string;
  skin?: NpcSkin;
  accent: string;
  colours?: RitualColours; // a tab with colours of its own (see getRitualColours)
  onClick: () => void;
}) => {
  const brackets = skin?.ritual?.brackets;
  const lowerBracket = brackets && upsideDown(brackets);
  return (
    <HeadExit>
      <Tab
        onClick={onClick}
        $plaque={colours?.plaque ?? skin?.ritual?.plaque}
        style={
          {
            animationDelay: `${RITUAL_DELAY}s`,
            '--ritual-arrived': `${RITUAL_DELAY + 0.6}s`,
            ...(colours && {
              '--npc-fill': colours.fill,
              '--npc-row': `color-mix(in srgb, ${colours.fill} 85%, white)`,
              '--npc-name': colours.name,
              ...(colours.thick && { '--ritual-name-thicken': '0.0711cqh' }),
              ...(colours.stitch && {
                '--accent': colours.stitch,
                '--ritual-stitch': colours.stitch,
              }),
            }),
          } as React.CSSProperties
        }
      >
        {brackets && (
          <RitualBracket style={{ top: u(1.5), right: u(1.5) }}>
            <PixelSprite art={brackets} cell={u(0.75)} flip />
          </RitualBracket>
        )}
        <RitualMedal
          $ring={skin?.ritual?.ring?.colour}
          $ringWidth={skin?.ritual?.ring ? u(1.5) : u(2)}
          $plaque={skin?.ritual?.plaque}
          $stitch={skin ? skin.ritual?.ring?.stitch : accentMix(60)}
          // the medal keeps the cloud's own colours under the tab's (initial: the default panel)
          style={
            colours &&
            ({
              '--npc-fill': colours.medal?.fill ?? skin?.colours.fill ?? 'initial',
              '--accent': accent,
            } as React.CSSProperties)
          }
        >
          <TintedIcon src={RitualIcon} alt='' accent={colours?.medal?.icon ?? accent} />
        </RitualMedal>
        <BurstAt>
          {/* as it turns, pixels pop out of it all round, white and the npc's colour */}
          {Array.from({ length: BURST }, (_, i) => (
            <BurstBit
              key={i}
              style={
                {
                  '--angle': `${(i * 360) / BURST}deg`,
                  background: i % 2 ? (colours?.burst ?? accent) : '#ffffff',
                } as React.CSSProperties
              }
            />
          ))}
        </BurstAt>
        <RitualOrnament skin={skin} colour={colours?.stitch} />
        <RitualName>
          {lowerBracket && (
            <RitualBracket style={{ left: `calc(-1 * ${u(2)})`, bottom: `calc(-1 * ${u(1.25)})` }}>
              <PixelSprite art={lowerBracket} cell={u(0.75)} />
            </RitualBracket>
          )}
          {name}
        </RitualName>
        <RitualOrnament skin={skin} colour={colours?.stitch} flip />
      </Tab>
    </HeadExit>
  );
};

// either side of the ritual's name, smaller than by the npc's name: the skin's own for its ritual
// (null: none), else the one by its name; the default cloud's curls only for npcs without a skin
// the curls are drawn in `colour` (a tab's own stitch colour), else the cloud's dark shade of its own
const RitualOrnament = ({
  skin,
  colour,
  flip = false,
}: {
  skin?: NpcSkin;
  colour?: string;
  flip?: boolean;
}) => {
  const own = skin?.ritual?.ornament;
  if (own && 'src' in own) return <OrnamentItem src={own.src} alt='' $flip={flip} />;
  const art = own === null ? undefined : (own ?? skin?.ornament);
  if (art) return <PixelSprite art={art} cell={u(0.5)} flip={flip} />;
  if (skin) return null;
  return (
    <SmallCurl $colour={colour}>
      <Curl flip={flip} />
    </SmallCurl>
  );
};

// a game item beside the ritual's name (mina's candy), mirrored on the right
const OrnamentItem = styled.img<{ $flip: boolean }>`
  width: 2.6667cqh;
  height: 2.6667cqh;
  margin: 0 -0.2667cqh;
  image-rendering: pixelated;
  transform: ${({ $flip }) => ($flip ? 'scaleX(-1)' : 'none')};
`;

// the ritual's tab: pinned over the cloud's top edge at the top right, a little in from the close
// badge, its lower part over the cloud like a label pinned to it
const HeadExit = styled.div`
  position: absolute;
  z-index: 5;
  right: ${u(4.5)};
  bottom: calc(100% + ${SECOND_OUT} - ${u(6.5)});
  display: flex;
  align-items: flex-end;
`;

// the ritual's tab slides up from behind the outline after the cloud opens: moved down and clipped
// by as much at its bottom, so only what has risen past the line shows. the clip reaches past its
// top and sides, so the medal standing out over them stays whole
const riseUp = keyframes`
  from {
    transform: translateY(100%);
    clip-path: inset(-100% -30% 100% -30%);
    opacity: 0;
  }
  40% {
    opacity: 1;
  }
  99.9% {
    transform: translateY(0);
    clip-path: inset(-100% -30% 0 -30%);
  }
  /* once it's up nothing clips it, so the pixels bursting from its medal fly over the cloud */
  to {
    transform: translateY(0);
    clip-path: inset(-500% -500% -500% -500%);
  }
`;

// the npc's ritual (shop, sacrifice, adoption...): a label in the npc's own cloud look, its border
// pattern inside the edge and ornaments round the name, pinned over the cloud's top edge beside
// the close. a skin may add a plaque line
const Tab = styled.div<{ $plaque?: string }>`
  position: relative;
  isolation: isolate; /* the corner patch sits over the panel, under the icon and name */
  animation: ${riseUp} 0.6s cubic-bezier(0.22, 1, 0.36, 1) both; /* delay: after the opening */
  display: flex;
  align-items: center;
  gap: ${u(1.5)};
  /* the 32px icon with even room above and below; the second outline is its bottom edge */
  height: calc(2.9636cqh + 2 * ${u(1.5)} + ${B});
  margin-right: ${u(1.5)};
  padding: 0 ${u(3)} 0 ${u(2)};
  border: solid ${PANEL.line} ${B};
  border-radius: 1.0667cqh;
  background: ${PANEL.fill};
  ${({ $plaque }) =>
    $plaque &&
    css`
      box-shadow:
        inset 0 0 0 0.2844cqh ${PANEL.fill},
        inset 0 0 0 0.4622cqh ${$plaque};
    `}
  white-space: nowrap;
  cursor: pointer;
  transition: background 0.12s ease;
  &:hover {
    background: ${PANEL.row};
  }
  /* the cloud's border pattern (the default cloud's running stitch; none for a skin without one),
  just inside all four sides, round the whole tab like the cloud's own */
  &::after {
    content: '';
    position: absolute;
    z-index: -1; /* under the medal, which stands over the tab's edge */
    inset: ${u(1)};
    border-radius: 0.7111cqh;
    pointer-events: none;
    /* a tab with its own colours sews its stitch at full strength (RitualColours.stitch) */
    ${runningStitch(`var(--ritual-stitch, ${accentMix(60)})`, { skinnable: true })}
  }
`;

// a skin's bracket on the ritual tab (see its ritual.brackets), under the medal where they meet
const RitualBracket = styled.span`
  position: absolute;
  z-index: -1;
  pointer-events: none;
`;

// the ritual's icon on a round medal, a little bigger than the tab, standing on the outline and
// over the tab's top and left edges. inside its rim, the npc's own: the default stitch, a skin's
// band (zevana's gold-stitched leather) or its plaque line (dimidiatus)
const MEDAL = u(14); // 56px
// as the tab arrives its medal turns once like a coin (flat: it only narrows, it never tilts) and
// a ring of pixels pops out of it at the same time and fades
const COIN_TURN = 0.7; // seconds a turn takes
const coinTurn = keyframes`
  0%, 100% { transform: none; }
  12% { transform: scaleX(0.55); }
  24% { transform: scaleX(0.12); }
  36% { transform: scaleX(0.55); }
  48% { transform: none; }
`;
const BURST = 8;
const burst = keyframes`
  from {
    opacity: 1;
    transform: rotate(var(--angle)) translateX(calc(${MEDAL} * 0.55)) rotate(calc(-1 * var(--angle)));
  }
  70% {
    opacity: 1;
  }
  to {
    opacity: 0;
    transform: rotate(var(--angle)) translateX(calc(${MEDAL} * 1.2)) rotate(calc(-1 * var(--angle)));
  }
`;
// over the medal (where its flex margins put it), so the pixels don't narrow as it turns
const BurstAt = styled.span`
  position: absolute;
  z-index: 3;
  left: calc(-1 * ${u(1)});
  bottom: 0;
  width: ${MEDAL};
  height: ${MEDAL};
  pointer-events: none;
`;
const BurstBit = styled.span`
  position: absolute;
  left: calc(50% - ${u(0.75)});
  top: calc(50% - ${u(0.75)});
  width: ${u(1.5)};
  height: ${u(1.5)};
  opacity: 0;
  pointer-events: none;
  animation: ${burst} 0.7s steps(6) var(--ritual-arrived);
`;
const RitualMedal = styled.span<{
  $ring?: string;
  $ringWidth: string;
  $plaque?: string;
  $stitch?: string;
}>`
  position: relative;
  flex-shrink: 0;
  align-self: flex-end;
  display: flex;
  align-items: center;
  justify-content: center;
  width: ${MEDAL};
  height: ${MEDAL};
  /* its bottom on the outline (the tab's padding is the line's width), its middle where the icon was */
  margin: 0 0 calc(-1 * ${B}) calc(-1 * ${u(3)});
  animation: ${coinTurn} ${COIN_TURN}s steps(1) var(--ritual-arrived) both;
  border: solid ${PANEL.line} ${B};
  border-radius: 50%;
  background: ${PANEL.fill};
  /* a band just inside the rim (a skin's ring), or a thin plaque line a little way in */
  ${({ $ring, $plaque }) =>
    ($ring || $plaque) &&
    css`
      box-shadow: ${$ring
        ? `inset 0 0 0 ${u(1.5)} ${$ring}`
        : `inset 0 0 0 ${u(0.75)} ${PANEL.fill}, inset 0 0 0 ${u(1.25)} ${$plaque}`};
    `}
  /* a running stitch round it, along the middle of the band */
  ${({ $stitch, $ringWidth }) =>
    $stitch &&
    css`
      &::after {
        content: '';
        position: absolute;
        inset: calc(${$ringWidth} / 2 - ${u(0.25)});
        border-radius: 50%;
        pointer-events: none;
        background: repeating-conic-gradient(${$stitch} 0 8deg, transparent 8deg 16deg);
        mask: radial-gradient(
          closest-side,
          transparent calc(100% - ${u(0.5)}),
          #000 calc(100% - ${u(0.5)})
        );
      }
    `}
`;

// the ritual's name, in the npc's name colour, like a little title between its curls
const RitualName = styled.span`
  position: relative;
  font-size: 1.3333cqh;
  letter-spacing: 0.0889cqh;
  color: var(--npc-name, color-mix(in srgb, var(--accent) 40%, #5a7526));
  /* thickened by a copy a hair over (the pixel font has no bold); a tab may thicken it more */
  text-shadow: var(--ritual-name-thicken, 0.0533cqh) 0 0 currentColor;
`;

// the name's curls, two thirds the size
const SmallCurl = styled.span<{ $colour?: string }>`
  display: block;
  & > svg {
    width: calc(5 * ${u(0.5)}) !important;
    height: calc(9 * ${u(0.5)}) !important;
  }
  /* recoloured: the curl's line, not the pale pixels in its hooks */
  ${({ $colour }) =>
    $colour &&
    css`
      & rect:not([fill='${PALE}']) {
        fill: ${$colour};
      }
    `}
`;
