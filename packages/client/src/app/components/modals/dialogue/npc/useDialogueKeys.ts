import { useEffect, useRef } from 'react';

import { playClick } from 'utils/sounds';
import { DialogueOption } from './body';

// true while a field has the focus: the cloud's keys leave typing alone
export const focusInField = () => {
  const el = document.activeElement as HTMLElement | null;
  const tag = el?.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || !!el?.isContentEditable;
};

// the cloud's keys: space / enter / right arrow skip the typing or advance, left arrow goes back,
// number keys pick choices; none while a field has focus or a quest list is open, and space /
// enter leave a focused button its own click
export const useDialogueKeys = (keys: {
  shown: boolean; // only while the cloud is in view
  advance: () => void;
  back?: () => void;
  options: DialogueOption[];
  listOpen: boolean;
}) => {
  // the handler reads the latest through a ref, so it's bound once per showing
  const keysRef = useRef(keys);
  keysRef.current = keys;
  useEffect(() => {
    if (!keys.shown) return;
    const onKey = (e: KeyboardEvent) => {
      if (focusInField() || e.repeat || keysRef.current.listOpen) return;
      const onButton = document.activeElement?.tagName === 'BUTTON';
      if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight') {
        if (e.key !== 'ArrowRight' && onButton) return;
        e.preventDefault();
        keysRef.current.advance();
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const { back } = keysRef.current;
        if (!back) return;
        playClick();
        back();
        return;
      }
      const option = keysRef.current.options[Number(e.key) - 1];
      if (!option) return;
      playClick();
      option.onClick();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [keys.shown]);
};
