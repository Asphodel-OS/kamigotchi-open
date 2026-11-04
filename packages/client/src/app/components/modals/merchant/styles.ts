import styled from 'styled-components';

import { Palette } from 'app/components/library/pastel';

// shared pieces for the shop, in the pastel look of the quests, VIP and crafting modals

export const Panel = styled.div<{ $width: string; $divider?: boolean }>`
  position: relative;
  width: ${({ $width }) => $width};
  min-width: 0;
  display: flex;
  flex-direction: column;
  ${({ $divider }) => $divider && `border-left: solid ${Palette.ink} 0.15vw;`}
`;

export const PanelTitle = styled.div`
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.8vw 1vw;
  background: ${Palette.soft};
  border-bottom: solid ${Palette.line} 0.12vw;
  font-family: Pixel;
  font-size: 0.85vw;
  color: ${Palette.ink};
`;

export const PanelCount = styled.span`
  font-size: 0.6vw;
  color: ${Palette.muted};
`;

export const List = styled.div`
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5vw;
  padding: 0.8vw;
  overflow-y: auto;
  overflow-x: hidden;

  scrollbar-width: none;
  &::-webkit-scrollbar {
    display: none;
  }
`;

export const Empty = styled.div`
  margin: 0.8vw;
  padding: 1.6vw 1vw;
  font-family: Pixel;
  font-size: 0.7vw;
  line-height: 1.6;
  text-align: center;
  color: ${Palette.muted};
  background: ${Palette.soft};
  border: dashed ${Palette.line} 0.12vw;
  border-radius: 0.7vw;
`;

// item icon on a soft tile
export const Tile = styled.div<{ $size: number }>`
  flex: none;
  width: ${({ $size }) => $size}vw;
  height: ${({ $size }) => $size}vw;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${Palette.soft};
  border: solid ${Palette.line} 0.1vw;
  border-radius: 0.45vw;

  img {
    width: ${({ $size }) => $size * 0.75}vw;
    height: ${({ $size }) => $size * 0.75}vw;
    image-rendering: pixelated;
    user-drag: none;
  }
`;

export const Main = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35vw;
`;

export const Name = styled.span`
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-family: Pixel;
  font-size: 0.8vw;
  color: ${Palette.ink};
`;

// a currency amount: icon plus number, red when the player can't cover it
export const Price = styled.span<{ $short?: boolean }>`
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 0.25vw;
  height: 1.4vw;
  padding: 0 0.4vw 0 0.2vw;
  font-family: Pixel;
  font-size: 0.65vw;
  font-variant-numeric: tabular-nums;
  color: ${({ $short }) => ($short ? Palette.warn.edge : Palette.ink)};
  background: ${({ $short }) => ($short ? Palette.warn.bg : Palette.paper)};
  border: solid ${({ $short }) => ($short ? Palette.warn.edge : Palette.line)} 0.1vw;
  border-radius: 0.35vw;

  img {
    width: 1vw;
    height: 1vw;
    image-rendering: pixelated;
  }
`;

export const Step = styled.button`
  width: 1.4vw;
  height: 1.4vw;
  padding: 0;
  font-family: Pixel;
  font-size: 0.65vw;
  color: ${Palette.ink};
  background: ${Palette.paper};
  border: solid ${Palette.ink} 0.1vw;
  border-radius: 0.35vw;
  cursor: pointer;

  &:hover:not(:disabled) {
    background: ${Palette.button.bg};
  }
  &:disabled {
    cursor: default;
    color: ${Palette.faint};
    border-color: ${Palette.line};
  }
`;

export const Button = styled.button`
  height: 2.1vw;
  padding: 0 1vw;
  font-family: Pixel;
  font-size: 0.75vw;
  color: ${Palette.ink};
  background: ${Palette.button.bg};
  border: solid ${Palette.ink} 0.15vw;
  border-radius: 0.5vw;
  cursor: pointer;
  transition:
    background 0.1s ease,
    transform 0.05s ease;

  &:hover:not(:disabled) {
    background: ${Palette.button.hover};
  }
  &:active:not(:disabled) {
    transform: translateY(0.08vw);
  }
  &:disabled {
    pointer-events: none; /* lets a wrapping tooltip catch the hover */
    color: ${Palette.faint};
    background: ${Palette.button.disabled};
    border-color: ${Palette.faint};
  }
`;
