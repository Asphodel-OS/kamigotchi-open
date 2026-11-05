import { CSSProperties } from 'react';
import { css } from 'styled-components';

// the cloud's shared look: its grid, colours, corner shapes and the frames its controls share.
// every piece of the npc cloud reads its sizes and colours from here

// one 4px grid for every size, gap and outline. sizes follow the room's height (cqh: the room
// overlay is a size container), not the screen, so the cloud keeps its shape on any screen
export const u = (n: number) => `${+((n * 400) / 1080).toFixed(4)}cqh`;
export const B = u(0.75); // outline width: 3px

// a warm cream panel outlined in the game's plum, with dark plum text; the npc's colour
// (--accent, set on the cloud) marks the name, keys, hovers and a hairline inside the edge
export const PANEL = {
  line: 'var(--npc-line, #573359)', // outlines: the game's own outline colour
  fill: 'var(--npc-fill, #fbf3e4)', // the panel
  text: 'var(--npc-text, #3d2a36)',
  dim: 'rgba(61, 42, 54, 0.45)',
  row: 'var(--npc-row, #f1e6d1)', // choice and control fills
  tray: 'var(--npc-tray, #ede0c6)', // the rounded tray the choices sit on: a couple of shades deeper than the panel
  rowLine: 'var(--npc-row-line, #e2d3b8)',
  control: '#fffaf0', // the icon buttons over the room art: solid, not see-through
  light: 'var(--npc-light, #fffaf0)', // text on the npc's colour
};
export const accentMix = (pct: number, base = 'transparent') =>
  `color-mix(in srgb, var(--accent) ${pct}%, ${base})`;

// the dark shade of the npc's colour its pixel curls and flowers are outlined in
export const VINE_DARK = 'color-mix(in srgb, var(--accent) 60%, black)';
// the pale pixel in a curl's hooks and a flower's petals
export const PALE = '#f6e2e8';

/////////////////
// SIZES

// every control in the header shares one height and outline, so the band reads as designed
export const CONTROL_HEIGHT = u(7); // 28px
export const ICON_BUTTON = u(10); // 40px: holds a native-size 32px icon with 4px around it
export const HEAD_HEIGHT = u(13); // room for the name, a little taller than a row of controls
export const RADIUS = '0.8cqh'; // rounded like the game's other buttons

// the second outline just outside the frame (SecondLine): the strip's width, and how far the
// line's outer edge stands from the frame's
export const SECOND_GAP = u(1.5); // the strip's width
export const SECOND_OUT = `(${SECOND_GAP} + ${B})`; // from the frame's edge to the line's outer edge

// seconds a skin's quest list takes to come out from under the cloud (or go back in)
export const UNDER_OUT = 0.45;

/////////////////
// CORNER SHAPES

// pixel-art corners: each cut away in a staircase of steps one outline width across, so the
// straight edges between them run exactly level and upright. the steps per corner, clockwise from
// the top-left: the default cloud's two, a price tag's TAG_CUT down its left end, a bevelled
// frame's BEVEL_CUT all round
export type Corners = [number, number, number, number];
export const staircase = (b: string, [tl, tr, br, bl]: Corners) => {
  const near = (i: number) => (i ? `calc(${i} * ${b})` : '0');
  const far = (i: number) => (i ? `calc(100% - ${i} * ${b})` : '100%');
  const pts: string[] = [];
  // a corner of n steps, walked clockwise from where it leaves one edge (a: steps along the way,
  // c: steps still to go) to where it meets the next; `at` turns the pair into that corner's point
  const corner = (n: number, at: (a: number, c: number) => string) => {
    pts.push(at(0, n));
    for (let i = 0; i < n; i++) pts.push(at(i + 1, n - i), at(i + 1, n - i - 1));
  };
  corner(tl, (a, c) => `${near(a)} ${near(c)}`);
  corner(tr, (a, c) => `${far(c)} ${near(a)}`);
  corner(br, (a, c) => `${far(a)} ${far(c)}`);
  corner(bl, (a, c) => `${near(c)} ${far(a)}`);
  return `polygon(${pts.join(', ')})`;
};
export const STEPPED: Corners = [2, 2, 2, 2];
export const TAG_CUT = 14; // steps cut off each left corner of a tag-shaped frame
export const BEVEL_CUT = 9; // steps cut off each corner of a bevelled frame

/////////////////
// SHARED FRAMES

// every control in the header shares one height and outline, so the band reads as designed
export const controlFrame = css`
  height: ${CONTROL_HEIGHT};
  border: solid ${PANEL.rowLine} ${u(0.5)};
  border-radius: ${RADIUS};
  background: ${PANEL.row};
  color: ${PANEL.text};
  cursor: pointer;
  transition: background 0.12s ease;
  &:hover:not(:disabled) {
    background: ${accentMix(30)};
  }
`;

// a quiet row on the panel: lights up in the npc's colour on hover, its label nudging over
export const row = css`
  color: ${PANEL.text};
  background: ${PANEL.row};
  border: solid ${PANEL.rowLine} ${u(0.5)};
  border-radius: ${RADIUS};
  cursor: pointer;
  font-size: 1.28cqh;
  line-height: 1.9556cqh;
  white-space: nowrap;
  transition:
    background 0.12s ease,
    border-color 0.12s ease;
  &:hover:not(:disabled) {
    background: ${accentMix(22, PANEL.light)};
    border-color: ${accentMix(60)};
  }
`;

/////////////////
// HELPERS

// a running stitch of `colour` just inside the edges: dashes one outline width long, with the same
// gap, along each side (or all but the top). skinnable: a skin's own pattern (--npc-border) takes
// its place
export const runningStitch = (
  colour: string,
  { noTop = false, skinnable = false }: { noTop?: boolean; skinnable?: boolean } = {}
) => {
  const dashes = (deg: number) =>
    `repeating-linear-gradient(${deg}deg, ${colour} 0 ${B}, transparent ${B} calc(2 * ${B}))`;
  const sides = [
    !noTop && `var(--across) top / 100% ${u(0.5)} no-repeat`,
    `var(--across) bottom / 100% ${u(0.5)} no-repeat`,
    `var(--down) left / ${u(0.5)} 100% no-repeat`,
    `var(--down) right / ${u(0.5)} 100% no-repeat`,
  ]
    .filter(Boolean)
    .join(', ');
  return css`
    --across: ${dashes(90)};
    --down: ${dashes(180)};
    background: ${skinnable ? `var(--npc-border, ${sides})` : sides};
  `;
};

// an object's entries as css variables, --<prefix>-<key> with camelCase keys hyphenated (baseEnd
// gives --shelf-base-end); `value` turns each entry into its css value
export const cssVars = <T>(
  prefix: string,
  values: Record<string, T>,
  value: (entry: T) => string = String
) =>
  Object.fromEntries(
    Object.entries(values).map(([key, entry]) => [
      `--${prefix}-${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`,
      value(entry),
    ])
  ) as CSSProperties;
