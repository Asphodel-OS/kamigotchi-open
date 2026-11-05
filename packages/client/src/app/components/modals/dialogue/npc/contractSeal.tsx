import styled, { css, keyframes } from 'styled-components';

import { B, u, UNDER_OUT } from './theme';

// a contract's trimmings (questList 'contract'): the gold rod it unrolls down to, and the wax seal
// stamped onto the rod once it's out

// a contract's gold rod
const ROD = `calc(4 * ${B})`; // its height, outline and all
const ROD_OVER = u(3); // how far a rod reaches past the paper's sides

// a contract's seal: a disc of wax just above its bottom rod, the npc's mark pressed into it. it stamps
// down once the contract is out, every time it opens
const stamp = keyframes`
  0% { scale: 2.2; opacity: 0; }
  60% { scale: 0.9; opacity: 1; }
  100% { scale: 1; opacity: 1; }
`;
export const SEAL = u(15); // its 30px picture at two screen pixels per pixel, in a 1080px room
export const Seal = styled.span<{ $open: boolean }>`
  position: absolute;
  left: calc(50% - ${SEAL} / 2);
  z-index: 2;
  /* fixed onto the middle of the bottom rod */
  bottom: calc(${B} - ${ROD} / 2 - ${SEAL} / 2);
  width: ${SEAL};
  height: ${SEAL};
  pointer-events: none;
  & img {
    display: block;
    width: 100%;
    height: 100%;
    image-rendering: pixelated;
  }
  ${({ $open }) =>
    $open &&
    css`
      animation: ${stamp} 0.35s steps(5) ${UNDER_OUT + 0.1}s both;
    `}
`;

// a contract's gold rod along its bottom edge, so it unrolls down as the rod drops. it overhangs
// the paper, a knob at either end
export const ScrollRod = styled.span`
  position: absolute;
  z-index: 1;
  left: calc(-1 * ${ROD_OVER});
  right: calc(-1 * ${ROD_OVER});
  bottom: calc(-1 * (${ROD} - ${B}));
  height: ${ROD};
  box-sizing: border-box;
  border: solid var(--ql-rod-line) ${B};
  border-radius: ${B};
  background: linear-gradient(
    var(--ql-rod-light) 0 ${B},
    var(--ql-rod) ${B} calc(2 * ${B}),
    var(--ql-rod-shade) calc(2 * ${B})
  );
  pointer-events: none;
  &::before,
  &::after {
    content: '';
    position: absolute;
    top: calc(-2 * ${B});
    width: calc(2 * ${B});
    height: calc(4 * ${B});
    background: var(--ql-rod);
    border: solid var(--ql-rod-line) ${B};
    border-radius: ${B};
  }
  &::before {
    left: calc(-4 * ${B});
  }
  &::after {
    right: calc(-4 * ${B});
  }
`;
