import { RefObject, useEffect, useRef } from 'react';
import styled, { css } from 'styled-components';

import { u } from './theme';

// the browser's scrollbar, gutter and all, hidden: a list draws its own (ScrollBar)
export const hideScrollbar = css`
  scrollbar-width: none;
  &::-webkit-scrollbar {
    display: none;
  }
`;

// a list's own scrollbar: a thin bar in the npc's colour (--ql-scroll) down the right of the box
// its scroller fills, no track behind it, shown only when there's more to scroll to. `watch`
// re-measures when the list changes
export const ScrollBar = ({
  target,
  watch,
}: {
  target: RefObject<HTMLDivElement>;
  watch?: unknown;
}) => {
  const thumb = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = target.current;
    const bar = thumb.current;
    if (!el || !bar) return;
    // the thumb is moved by hand, so a scroll never re-renders anything
    const update = () => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      if (scrollHeight > clientHeight + 1) {
        bar.style.top = `${(scrollTop / scrollHeight) * 100}%`;
        bar.style.height = `${(clientHeight / scrollHeight) * 100}%`;
        bar.style.display = '';
      } else {
        bar.style.display = 'none';
      }
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    const resize = new ResizeObserver(update);
    resize.observe(el);
    return () => {
      el.removeEventListener('scroll', update);
      resize.disconnect();
    };
  }, [target, watch]);
  return <ScrollThumb ref={thumb} style={{ display: 'none' }} />;
};
export const ScrollThumb = styled.span`
  position: absolute;
  z-index: 4;
  right: var(--ql-scroll-right, ${u(1.25)});
  width: ${u(1.5)};
  background: var(--ql-scroll);
  /* a list can outline it, to stand out on busy art */
  box-shadow: 0 0 0 var(--ql-scroll-outline, 0) var(--ql-line, transparent);
  pointer-events: none;
`;
