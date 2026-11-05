import styled, { css } from 'styled-components';

import { TextTooltip } from 'app/components/library';
import { QuestAvailableIcon, QuestOngoingIcon } from 'assets/images/icons/menu';
import { ListKind } from './questList';
import { B, controlFrame, ICON_BUTTON, PANEL, SECOND_OUT, u } from './theme';
import { TintedIcon } from './TintedIcon';

// the npc's quests, on two tabs round the cloud's right edge, standing on the second outline: the
// quest scroll with a ! (available) or an hourglass (ongoing), a count badge on the corner. like
// the header, they ride the cloud's pinned top, so they never move

export const QuestTabs = ({
  accent,
  available,
  ongoing,
  active,
  onToggle,
}: {
  accent: string;
  available: number;
  ongoing: number;
  active?: ListKind; // the list open now
  onToggle: (kind: ListKind) => void;
}) => (
  <TopBar>
    <TabGroup>
      <QuestTab
        kind='available'
        count={available}
        accent={accent}
        active={active}
        onToggle={onToggle}
      />
      <QuestTab
        kind='ongoing'
        count={ongoing}
        accent={accent}
        active={active}
        onToggle={onToggle}
      />
    </TabGroup>
  </TopBar>
);

const TAB_ICON: Record<ListKind, string> = {
  available: QuestAvailableIcon,
  ongoing: QuestOngoingIcon,
};
const TAB_TIP: Record<ListKind, string> = {
  available: 'Available quests',
  ongoing: 'Ongoing quests',
};

// one tab: greyed out with no quests of its kind, lit in the npc's colour while its list is open
const QuestTab = ({
  kind,
  count,
  accent,
  active,
  onToggle,
}: {
  kind: ListKind;
  count: number;
  accent: string;
  active?: ListKind;
  onToggle: (kind: ListKind) => void;
}) => (
  <TextTooltip text={[TAB_TIP[kind]]}>
    <QuestIcon
      $accent={accent}
      $active={active === kind}
      disabled={count === 0}
      onClick={() => onToggle(kind)}
    >
      <TintedIcon src={TAB_ICON[kind]} alt='' accent={accent} />
      {count > 0 && <QuestCount $accent={accent}>{count}</QuestCount>}
    </QuestIcon>
  </TextTooltip>
);

// her quest tabs: round the corner, stacked down the cloud's right side, standing on
// the second outline
const TopBar = styled.div`
  position: absolute;
  z-index: 3;
  left: calc(100% + ${SECOND_OUT});
  top: calc(2 * ${B} + ${u(2)});
  display: flex;
`;

// the quest tabs, touching: each after the first steps back one outline width, so
// neighbours share a single line
const TabGroup = styled.div`
  display: flex;
  flex-direction: column;
  & > * + * {
    margin-top: -${B};
  }
`;

// tabs standing on the second outline down the cloud's right side: the panel's cream, a plum
// outline on three sides and rounded only on the outer side; the outline is their fourth side
const tab = css`
  width: calc(${ICON_BUTTON} + ${B});
  /* tall enough that the 32px icon has room inside the top and bottom outlines */
  height: calc(${ICON_BUTTON} + 2 * ${B});
  padding: 0 0 0 ${B};
  border: solid ${PANEL.line} ${B};
  border-left: none;
  border-radius: 0 1.0667cqh 1.0667cqh 0;
  background: ${PANEL.fill};
`;

// a solid dark shade of the npc's colour: these buttons sit over the room art, so a
// see-through tint would let it show through
const tint = (accent: string) => `color-mix(in srgb, ${accent} 25%, ${PANEL.control})`;

// quests: the quest scroll with a ! (available) or an hourglass (ongoing), with a count badge on
// the corner; the title says what each is on hover
const QuestIcon = styled.button<{ $accent: string; $active?: boolean }>`
  ${controlFrame}
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  ${tab}
  /* the npc's colour is in the icon itself (TintedIcon) */
  ${({ $accent, $active }) => $active && `background: ${tint($accent)};`}
  cursor: pointer;
  transition: background 0.12s ease;
  &:hover:not(:disabled) {
    background: ${({ $accent }) => tint($accent)};
  }
  /* no quests of that kind: the tab greys out instead of showing a 0 (the tab itself stays
  solid, so the frame's line under it stays covered) */
  &:disabled {
    cursor: default;
    background: ${PANEL.row};
    /* the tinted icon: the kept picture, or the blended one while it's made */
    & > img,
    & > span {
      filter: grayscale(1);
      opacity: 0.4;
    }
  }
`;

const QuestCount = styled.span<{ $accent: string }>`
  position: absolute;
  top: -${u(2)};
  right: -${u(2)};
  min-width: ${u(4.5)};
  padding: 0 ${u(0.75)};
  border: solid ${PANEL.line} ${u(0.5)};
  background: ${({ $accent }) => $accent};
  color: ${PANEL.light};
  font-size: 0.9778cqh;
  line-height: 1.5111cqh;
  text-align: center;
`;
