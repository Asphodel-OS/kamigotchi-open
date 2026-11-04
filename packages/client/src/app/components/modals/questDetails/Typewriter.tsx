import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import styled from 'styled-components';

const SPEAKER_TAG_AT_START = /^([A-Z][A-Z0-9 ]{1,24})(?=:)/;
const SPEAKER_TAG_GLOBAL = /([A-Z][A-Z0-9 ]{1,24})(?=:)/g;

type Segment = { bold: boolean; content: string };

// split text into plain runs and bolded speaker tags
const segmentText = (text: string): Segment[] => {
  const segments: Segment[] = [];
  let cursor = 0;

  for (const match of text.matchAll(SPEAKER_TAG_GLOBAL)) {
    const index = match.index ?? 0;
    const speaker = match[1];
    if (index > cursor) segments.push({ bold: false, content: text.slice(cursor, index) });
    segments.push({ bold: true, content: speaker });
    cursor = index + speaker.length;
  }

  if (cursor < text.length) segments.push({ bold: false, content: text.slice(cursor) });
  return segments;
};

// render the full text with characters beyond revealCount kept in the DOM but
// invisible: word wrapping is computed against the complete text, so lines
// never reflow mid-reveal and the container holds its final size from the start
const renderSegments = (segments: Segment[], revealCount: number): ReactNode[] => {
  const parts: ReactNode[] = [];
  let offset = 0;

  segments.forEach((segment, i) => {
    const visibleCount = Math.max(0, Math.min(segment.content.length, revealCount - offset));
    const visible = segment.content.slice(0, visibleCount);
    const hidden = segment.content.slice(visibleCount);

    if (segment.bold) {
      // hidden part stays inside the strong so reserved width matches the final render
      parts.push(
        <strong style={{ color: 'inherit' }} key={i}>
          {visible}
          {hidden && <span style={{ visibility: 'hidden' }}>{hidden}</span>}
        </strong>
      );
    } else {
      if (visible) parts.push(<span key={`${i}v`}>{visible}</span>);
      if (hidden)
        parts.push(
          <span key={`${i}h`} style={{ visibility: 'hidden' }}>
            {hidden}
          </span>
        );
    }
    offset += segment.content.length;
  });

  return parts;
};

export const useTypewriter = (
  text: string,
  speed: number,
  retrigger?: boolean | string,
  onUpdate?: () => void,
  interrupted?: boolean,
  onComplete?: () => void,
  onType?: (typed: string) => void,
  pauses?: Record<string, number> // beats to hold after a character (e.g. '.': 9), like a breath
) => {
  const [revealCount, setRevealCount] = useState(0);
  const indexRef = useRef(0);
  // refs, so a new callback or table doesn't restart the typing
  const onTypeRef = useRef(onType);
  onTypeRef.current = onType;
  const pausesRef = useRef(pauses);
  pausesRef.current = pauses;
  const segments = useMemo(() => segmentText(text), [text]);

  useEffect(() => {
    setRevealCount(0);
    indexRef.current = 0;
  }, [retrigger]);

  useEffect(() => {
    if (!text) return;

    if (interrupted) {
      // skip if already fully revealed: a late interrupt (e.g. a shared skip
      // flag across columns) must not re-fire completion
      if (indexRef.current < text.length) {
        indexRef.current = text.length;
        setRevealCount(text.length);
        onComplete?.();
      }
      return;
    }

    // one timeout after another, so a character can hold the next one back
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      if (indexRef.current >= text.length) {
        onComplete?.();
        return;
      }

      // speaker tags reveal in one beat, regular text char by char
      const remaining = text.substring(indexRef.current);
      const speaker = remaining.match(SPEAKER_TAG_AT_START)?.[1];
      const typed = speaker ?? remaining[0];
      indexRef.current += typed.length;
      setRevealCount(indexRef.current);
      onTypeRef.current?.(typed);

      if (onUpdate) onUpdate();

      // a pause after punctuation, unless more of it follows (the dots of an ellipsis) or the
      // line ends there (then it's done at once)
      const next = text[indexRef.current];
      const hold = next !== undefined && next !== typed ? (pausesRef.current?.[typed] ?? 1) : 1;
      timer = setTimeout(tick, speed * hold);
    };
    timer = setTimeout(tick, speed);

    return () => clearTimeout(timer);
  }, [text, speed, retrigger, onUpdate, interrupted, onComplete]);

  return useMemo(() => renderSegments(segments, revealCount), [segments, revealCount]);
};

// all in one block
const SingleLineTypewriter = ({
  text = '',
  retrigger,
  speed = 20,
  onUpdate,
  interrupted = false,
  onComplete,
  onType,
  pauses,
  showContinueArrow = false,
}: {
  text?: string;
  retrigger?: boolean | string;
  speed?: number;
  onUpdate?: () => void;
  interrupted?: boolean;
  onComplete?: () => void;
  onType?: (typed: string) => void; // each newly revealed piece of text (e.g. for a key sound)
  pauses?: Record<string, number>; // beats to hold after a character, e.g. a sentence's end
  showContinueArrow?: boolean;
}) => {
  const displayedText = useTypewriter(
    text,
    speed,
    retrigger,
    onUpdate,
    interrupted,
    onComplete,
    onType,
    pauses
  );
  return (
    <Container>
      {displayedText}
      {showContinueArrow && <Arrow>▸</Arrow>}
    </Container>
  );
};

// click to advance
// this is the one we are using now in quest dialogue
const MultiLineTypewriter = ({
  text = '',
  retrigger,
  speed = 20,
  onUpdate,
  onAllLinesComplete,
}: {
  text?: string;
  retrigger?: boolean | string;
  speed?: number;
  onUpdate?: () => void;
  onAllLinesComplete?: () => void;
}) => {
  const [lineIndex, setLineIndex] = useState(0);
  const [revealedLines, setRevealedLines] = useState<string[]>([]);
  const [lineFinished, setLineFinished] = useState(false);
  const [isInterrupted, setIsInterrupted] = useState(false);

  const lines = text.split('\n').filter(Boolean);
  const currentLine = lines[lineIndex] ?? '';
  const isLastLine = lineIndex >= lines.length - 1;

  // retrigger resets state
  useEffect(() => {
    setLineIndex(0);
    setRevealedLines([]);
    setLineFinished(false);
    setIsInterrupted(false);
  }, [retrigger]);

  const handleClick = () => {
    if (!lineFinished) {
      // skip current line
      setIsInterrupted(true);
      setTimeout(() => onUpdate?.(), 0);
      return;
    }

    if (isLastLine) {
      // all lines have been read
      onAllLinesComplete?.();
      return;
    }

    // move to next line
    setRevealedLines((prev) => [...prev, currentLine]);
    setLineIndex((i) => i + 1);
    setIsInterrupted(false);
    setLineFinished(false);
    setTimeout(() => onUpdate?.(), 0);
  };

  const handleLineComplete = () => {
    setLineFinished(true);
    setTimeout(() => onUpdate?.(), 0);
  };

  return (
    <ClickableArea onClick={handleClick}>
      {revealedLines.map((line, i) => (
        <SingleLineTypewriter key={i} text={line} interrupted retrigger={retrigger} />
      ))}
      <SingleLineTypewriter
        text={currentLine}
        speed={speed}
        interrupted={isInterrupted}
        retrigger={`${retrigger}${lineIndex}`}
        onComplete={handleLineComplete}
        onUpdate={onUpdate}
        showContinueArrow={lineFinished && !isLastLine}
      />
    </ClickableArea>
  );
};

export const TypewriterComponent = ({
  text = '',
  retrigger,
  speed = 20,
  onUpdate,
  interrupted = false,
  onComplete,
  onType,
  pauses,
  showContinueArrow = false,
  multiLine = false,
  onAllLinesComplete,
}: {
  text?: string;
  retrigger?: boolean | string;
  speed?: number;
  onUpdate?: () => void;
  interrupted?: boolean;
  onComplete?: () => void;
  onType?: (typed: string) => void;
  pauses?: Record<string, number>;
  showContinueArrow?: boolean;
  multiLine?: boolean;
  onAllLinesComplete?: () => void;
}) => {
  if (multiLine) {
    return (
      <MultiLineTypewriter
        text={text}
        retrigger={retrigger}
        speed={speed}
        onUpdate={onUpdate}
        onAllLinesComplete={onAllLinesComplete}
      />
    );
  }

  return (
    <SingleLineTypewriter
      text={text}
      retrigger={retrigger}
      speed={speed}
      onUpdate={onUpdate}
      interrupted={interrupted}
      onComplete={onComplete}
      onType={onType}
      pauses={pauses}
      showContinueArrow={showContinueArrow}
    />
  );
};

const Container = styled.div`
  font-size: inherit;
  color: inherit;
  white-space: pre-wrap;
`;

const ClickableArea = styled.div`
  font-size: inherit;
  color: inherit;
  white-space: pre-wrap;
  cursor: pointer;
  height: 100%;
  width: 100%;
`;

const Arrow = styled.span`
  margin-left: 0.3em;
  animation: flicker 1s steps(1) infinite;
  font-size: 1.8vw;
  @keyframes flicker {
    0% {
      opacity: 1;
    }
    50% {
      opacity: 0;
    }
    100% {
      opacity: 1;
    }
  }
`;
