import styled from 'styled-components';

import { Quest } from 'network/shapes/Quest';
import { accentMix, B, HEAD_HEIGHT, PANEL, row, u } from './theme';

// the npc's quests as a list: its title and a row per quest. the default cloud drops it from under
// the header (QuestList); a skin's comes out from under the cloud instead (see underSheet)

export type ListKind = 'available' | 'ongoing';
export const LIST_TITLE: Record<ListKind, string> = {
  available: 'Available Quests',
  ongoing: 'Ongoing Quests',
};

export const QuestItems = ({
  kind,
  quests,
  contract = false, // a contract numbers each quest as a clause
  onPick,
}: {
  kind: ListKind;
  quests: Quest[];
  contract?: boolean;
  onPick: (quest: Quest) => void;
}) => (
  <>
    <QuestTitle>{LIST_TITLE[kind]}</QuestTitle>
    {quests.map((quest, i) => (
      <QuestButton
        key={i}
        style={{ '--i': i } as React.CSSProperties}
        onClick={() => onPick(quest)}
      >
        {contract && <Clause>&sect; {toRoman(i + 1)}</Clause>}
        {quest.name}
      </QuestButton>
    ))}
  </>
);

// drops down from the header's bottom edge over the line and choices, so opening it moves nothing
export const QuestList = styled.div`
  position: absolute;
  top: calc(${B} + ${HEAD_HEIGHT} + ${B});
  left: ${B};
  right: ${B};
  z-index: 2;
  display: flex;
  flex-flow: column nowrap;
  gap: ${u(2)};
  padding: ${u(3)} ${u(4)} ${u(4)};
  max-height: 40vh;
  overflow-y: auto;
  background: ${PANEL.fill};
  border-bottom: solid ${accentMix(55, PANEL.line)} ${B};
`;

export const QuestTitle = styled.div`
  font-size: 1.0667cqh;
  color: var(--ql-title, ${accentMix(70, 'black')}); /* a sign brings its own */
  letter-spacing: 0.0889cqh;
  text-transform: uppercase;
`;

const QuestButton = styled.button`
  ${row}
  padding: ${u(1.5)} ${u(3)};
  text-align: left;
  white-space: normal; /* long quest names wrap; the list grows with them */
  overflow-wrap: anywhere;
`;

// a contract's clause number, a little dimmer than its words
const Clause = styled.span`
  flex-shrink: 0;
  color: var(--ql-numeral);
`;

const toRoman = (n: number) =>
  [
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ].reduce(
    (out, [value, numeral]) => {
      while (out.n >= (value as number)) {
        out.s += numeral;
        out.n -= value as number;
      }
      return out;
    },
    { s: '', n }
  ).s;
