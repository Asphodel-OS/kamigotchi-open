import { ReactNode, useLayoutEffect, useRef } from 'react';
import styled, { css, keyframes } from 'styled-components';

import { playClick } from 'utils/sounds';
import { playKeystroke } from 'utils/typewriter';
import { TypewriterComponent } from '../../questDetails/Typewriter';
import { accentMix, PANEL, row, u } from './theme';

// the cloud's body under the header: the npc's line (one column or two), your choices on their
// tray, and a node's action buttons

export type DialogueOption = { label: string; onClick: () => void; asked?: boolean };

// ms per letter as a line types: unhurried, so it reads like someone talking, and how many
// letters' worth it rests after a sentence or a comma, like a breath
const TYPE_SPEED = 32;
const TYPE_PAUSES: Record<string, number> = { '.': 9, '?': 9, '!': 9, ',': 5 };

// a two-column line's halves: its first two non-empty lines (else the whole text, and nothing)
export const splitColumns = (text: string, twoColumn: boolean): [string, string] => {
  if (!twoColumn) return [text, ''];
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  return [lines[0] ?? '', lines[1] ?? ''];
};

// the npc's line, typed out: one column, or two side by side (each typed on its own)
export const DialogueLine = ({
  left,
  right,
  twoColumn,
  resetKey,
  clickable,
  onClick,
  interrupted,
  restored,
  sounded,
  onMainComplete,
  onSideComplete,
}: {
  left: string;
  right: string;
  twoColumn: boolean;
  resetKey: string; // step identity: a new key retypes, even the same text
  clickable: boolean;
  onClick: () => void;
  interrupted: boolean; // filled at once (a click to skip, or a line shown again)
  restored: boolean; // a finished line shown again: filled, no callbacks
  sounded: boolean; // keystrokes play only while the cloud is in view
  onMainComplete: () => void;
  onSideComplete: () => void;
}) => {
  const typewriter = (text: string, key: string, onComplete: () => void) => (
    <TypewriterComponent
      text={text}
      retrigger={key}
      speed={TYPE_SPEED}
      interrupted={interrupted}
      onComplete={restored ? undefined : onComplete}
      onType={sounded ? playKeystroke : undefined}
      pauses={TYPE_PAUSES}
    />
  );
  if (twoColumn)
    return (
      <ParallelColumns onClick={onClick}>
        <Text $clickable={clickable}>{typewriter(left, `${resetKey}:L`, onMainComplete)}</Text>
        <Text $clickable={clickable}>{typewriter(right, `${resetKey}:R`, onSideComplete)}</Text>
      </ParallelColumns>
    );
  return (
    <Text $clickable={clickable} onClick={onClick}>
      {typewriter(left, resetKey, onMainComplete)}
    </Text>
  );
};

// the choices sit together on a rounded tray, a shade deeper than the panel, so they read as
// one block: your side of the conversation
export const DialogueChoices = ({ options }: { options: DialogueOption[] }) => {
  if (options.length === 0) return null;
  return (
    <Choices>
      {options.map((option, index) => (
        <Choice
          key={`${option.label}-${index}`}
          $asked={!!option.asked}
          onClick={() => {
            playClick();
            option.onClick();
          }}
        >
          <ChoiceMark />
          <FitLabel>{option.label}</FitLabel>
        </Choice>
      ))}
    </Choices>
  );
};

// one-line label that shrinks its font just enough to fit its box (down to MIN_LABEL_SCALE), and
// wraps only past that
const MIN_LABEL_SCALE = 0.6;
const FitLabel = ({ children }: { children: ReactNode }) => {
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.fontSize = '';
    el.style.whiteSpace = '';
    const ratio = el.clientWidth / el.scrollWidth;
    if (ratio >= 1) return;
    el.style.fontSize = `${Math.max(ratio, MIN_LABEL_SCALE)}em`;
    if (ratio < MIN_LABEL_SCALE) el.style.whiteSpace = 'normal';
  }, [children]);
  return <LabelText ref={ref}>{children}</LabelText>;
};

/////////////////
// THE LINE

const shake = keyframes`
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-0.4444cqh) rotate(-0.4deg); }
  40% { transform: translateX(0.4444cqh) rotate(0.4deg); }
  60% { transform: translateX(-0.2667cqh); }
  80% { transform: translateX(0.2667cqh); }
`;

export const Body = styled.div<{ $shake: boolean; $dimmed?: boolean }>`
  display: flex;
  flex-flow: column nowrap;
  gap: ${u(2.5)};
  /* the line starts close under the header: its letters' tops a little below the back / next
  buttons (the line's own leading takes up the rest) */
  margin-top: calc(var(--npc-text-drop, 0px) - ${u(0.5)}); /* a skin may drop them lower */
  padding: 0 ${u(6)} ${u(5)};
  transition:
    opacity 0.15s ease,
    filter 0.15s ease;
  ${({ $dimmed }) => $dimmed && 'opacity: 0.35; filter: grayscale(1); pointer-events: none;'}
  ${({ $shake }) =>
    $shake &&
    css`
      animation: ${shake} 0.35s ease-in-out 0.1s;
    `}
`;

const Text = styled.div<{ $clickable?: boolean }>`
  color: ${PANEL.text};
  position: relative;
  text-align: left;
  width: 100%;
  font-size: 1.6889cqh;
  line-height: 3.0222cqh;
  /* never shorter than three lines (like alaina's first one), so a short line doesn't leave a
  squat little cloud */
  min-height: calc(3 * 3.0222cqh);
  white-space: pre-line;
  word-wrap: break-word;
  overflow-wrap: anywhere;
  cursor: ${({ $clickable }) => ($clickable ? 'pointer' : 'auto')};
  /* the page's global '* { color: #333 }' would paint every typed letter dark: they take the
  panel's text colour instead (a dark skin needs light text) */
  & * {
    color: inherit;
  }
  /* the typewriter's block container flows inline with the rest of the text */
  & > div {
    display: inline;
  }
`;

const ParallelColumns = styled.div`
  width: 100%;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 3.5556cqh;
  align-items: stretch;
`;

export const ActionRow = styled.div`
  display: flex;
  justify-content: center;
`;

/////////////////
// THE CHOICES

const Choices = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${u(1.5)} ${u(2)};
  padding: 0.8889cqh ${u(1.5)};
  /* wider than the line above it: it reaches out to just inside the stitch, so the buttons get
  the room */
  margin: 0 -${u(3.5)};
  background: ${PANEL.tray};
  border-radius: 1.4222cqh;
`;

const Choice = styled.button<{ $asked: boolean }>`
  ${row}
  display: flex;
  align-items: center;
  gap: ${u(2)};
  min-width: 0;
  padding: ${u(1.5)} ${u(2.5)};
  text-align: left;
  /* cream on the deeper tray, with a plum outline like the frame's: flat, no raised edge */
  background: ${PANEL.light};
  border: solid ${PANEL.line} ${u(0.5)};
  ${({ $asked }) => $asked && 'opacity: 0.5;'}
  /* the label takes the button's colour, not the page's global '* { color: #333 }' */
  & * {
    color: inherit;
  }
  /* 1-9 still pick a choice from the keyboard; the rows just don't show the numbers */
  & > span {
    transition: transform 0.1s steps(2);
  }
  /* hovered, it fills with the npc's colour, its text and mark turn cream, and it nudges over */
  &:hover:not(:disabled) {
    background: var(--npc-hover, var(--accent));
    border-color: ${accentMix(60, 'black')};
    color: var(--npc-hover-text, ${PANEL.light});
  }
  &:hover > span {
    transform: translateX(${u(0.5)});
  }
`;

// a small pixel diamond in the npc's colour before each choice; cream while it's hovered
const ChoiceMark = styled.i`
  flex-shrink: 0;
  width: ${u(1.5)};
  height: ${u(1.5)};
  background: var(--accent);
  clip-path: var(--npc-mark, polygon(50% 0, 100% 50%, 50% 100%, 0 50%));
  button:hover > & {
    background: var(--npc-hover-text, ${PANEL.light});
  }
`;

const LabelText = styled.span`
  color: inherit; /* the button's colour, not the page's global #333 */
  flex: 1;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-align: left;
`;
