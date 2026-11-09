import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import styled, { createGlobalStyle } from 'styled-components';

const POLL_MS = 1000;
const HIGHLIGHT_ATTRIBUTE = 'data-tutorial-highlight';
const HIGHLIGHT_RADIUS = '--tutorial-highlight-radius';

export type TutorialStep = {
  highlight: string; // id of the element to outline
  text?: string; // no text: just the outline
  // id of the element to place the callout beside, to the right. default is under the highlight
  beside?: string;
  // how far down the beside element the callout starts, as a fraction of its height
  offset?: number;
  // center the callout vertically on the beside element instead (for small targets like buttons)
  center?: boolean;
};

const CALLOUT_WIDTH = 300;
const CALLOUT_GAP = 12;
const SCREEN_MARGIN = 8;
const FALLBACK_CALLOUT_HEIGHT = 160; // until the callout has rendered and been measured

// a modal's wrapper fills its whole grid area, while its content shrinks to what's on screen
const getVisibleElement = (id?: string) => {
  const element = id ? document.getElementById(id) : null;
  return element?.querySelector(':scope > [data-modal-content]') ?? element;
};

// a hidden element (display: none) still has bounds, all zero: treat it as missing
const getRect = (id?: string) => {
  const rect = getVisibleElement(id)?.getBoundingClientRect();
  return rect && rect.width > 0 && rect.height > 0 ? rect : undefined;
};

// the element that actually gets outlined. a menu button's id sits on a plain wrapper
const getHighlightElement = (id: string) => {
  const element = getVisibleElement(id);
  if (!element || element.closest('[data-modal-content]')) return element;
  return getComputedStyle(element).borderRadius === '0px'
    ? (element.firstElementChild ?? element)
    : element;
};

// a section of a modal has square corners of its own, so it follows its modal's
const getRadius = (element: Element) => {
  const own = getComputedStyle(element).borderRadius;
  if (own !== '0px' || !element.parentElement) return own;
  return getComputedStyle(element.parentElement).borderRadius;
};

// outlines the highlighted element and explains the next step in a callout
export const TutorialHint = ({
  highlight,
  text,
  beside,
  offset = 0,
  center = false,
}: TutorialStep) => {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [besideRect, setBesideRect] = useState<DOMRect | null>(null);
  const calloutRef = useRef<HTMLDivElement>(null);
  const [calloutHeight, setCalloutHeight] = useState(FALLBACK_CALLOUT_HEIGHT);
  useLayoutEffect(() => {
    const height = calloutRef.current?.offsetHeight;
    if (height && height !== calloutHeight) setCalloutHeight(height);
  });

  // poll, since menu buttons and modals have no shared layout signal
  useEffect(() => {
    const update = () => {
      setRect(getRect(highlight) ?? null);
      setBesideRect(getRect(beside) ?? null);
    };
    update();
    const id = setInterval(update, POLL_MS);
    return () => clearInterval(id);
  }, [highlight, beside]);

  // outline the element itself rather than an overlay, so its own popovers and dropdowns
  // still draw on top. reapplied on each poll, since modals can remount
  useEffect(() => {
    let current: Element | null | undefined;
    const clear = () => current?.removeAttribute(HIGHLIGHT_ATTRIBUTE);
    const apply = () => {
      const next = getHighlightElement(highlight);
      if (next === current) return;
      clear();
      current = next;
      if (!current) return;
      // read the corners first: once highlighted, the element's radius comes from this variable
      (current as HTMLElement).style.setProperty(HIGHLIGHT_RADIUS, getRadius(current));
      current.setAttribute(HIGHLIGHT_ATTRIBUTE, '');
    };
    apply();
    const id = setInterval(apply, POLL_MS);
    return () => {
      clearInterval(id);
      clear();
    };
  }, [highlight]);

  if (!rect) return null;
  const position = besideRect
    ? positionBeside(besideRect, center ? 0.5 : offset, calloutHeight, center)
    : positionUnder(rect, calloutHeight);
  return (
    <>
      <HighlightStyle />
      {text && (
        <Callout ref={calloutRef} style={position}>
          {text}
        </Callout>
      )}
    </>
  );
};

const clampLeft = (left: number) =>
  Math.max(SCREEN_MARGIN, Math.min(left, window.innerWidth - CALLOUT_WIDTH - SCREEN_MARGIN));

// keeps the callout on screen, using its real height so it only moves up as far as it must
const maxTop = (height: number) => window.innerHeight - height - SCREEN_MARGIN;

const positionBeside = (rect: DOMRect, offset: number, height: number, center = false) => {
  const top = rect.top + rect.height * offset - (center ? height / 2 : 0);
  return {
    left: clampLeft(rect.right + CALLOUT_GAP),
    top: Math.min(top, maxTop(height)),
  };
};

const positionUnder = (rect: DOMRect, height: number) => ({
  left: clampLeft(rect.left),
  top: Math.min(rect.bottom + CALLOUT_GAP, maxTop(height)),
});

const HighlightStyle = createGlobalStyle`
  [${HIGHLIGHT_ATTRIBUTE}] {
    border-radius: var(${HIGHLIGHT_RADIUS});
    outline: 0.2vw solid rgb(255, 204, 51);
    outline-offset: -0.2vw;
    box-shadow: 0 0 1vw rgb(255, 204, 51);
  }
`;

const Callout = styled.div`
  position: fixed;
  z-index: 21;
  width: ${CALLOUT_WIDTH}px;
  padding: 1vw 1.2vw;
  pointer-events: none;
  color: #fdf6e3;
  background-color: rgba(28, 24, 40, 0.88);
  border: 0.15vw solid rgb(255, 204, 51);
  border-radius: 0.8vw;
  box-shadow: 0 0.3vw 1vw rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(0.15vw);
  font-size: 0.8vw;
  line-height: 1.5vw;
`;
