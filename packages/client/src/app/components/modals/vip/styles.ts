import styled from 'styled-components';

import { getTierColors, Palette } from 'app/components/library/pastel';

// shared pieces for the VIP tabs, in the quests pastel look: one big icon and value per tab,
// explanations in tooltips

export const Gold = getTierColors('gold');

export const Section = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1vw;
  padding: 1.2vw;
`;

// the tab's headline: a large item icon beside its value
export const Hero = styled.div`
  display: flex;
  align-items: center;
  gap: 1vw;
`;

export const HeroIcon = styled.img`
  flex: none;
  width: 3.6vw;
  height: 3.6vw;
  image-rendering: pixelated;
  user-drag: none;
`;

export const Stack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.45vw;
  min-width: 0;
`;

export const Value = styled.span`
  font-family: Pixel;
  font-size: 1.5vw;
  line-height: 1.1;
  color: ${Palette.ink};
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
`;

export const Caption = styled.span`
  font-family: Pixel;
  font-size: 0.6vw;
  line-height: 1.4;
  color: ${Palette.muted};
`;

export const Note = styled.span`
  font-family: Pixel;
  font-size: 0.55vw;
  line-height: 1.6;
  color: ${Palette.muted};
`;

// a pill-shaped bar track
export const Bar = styled.div`
  height: 0.6vw;
  background: ${Palette.progress.track};
  border: solid ${Palette.ink} 0.12vw;
  border-radius: 99vw;
  overflow: hidden;
`;

export const Button = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.3vw;
  flex: none;
  height: 2.1vw;
  padding: 0 1vw;
  font-family: Pixel;
  font-size: 0.65vw;
  color: ${Palette.ink};
  background: ${Palette.button.bg};
  border: solid ${Palette.ink} 0.15vw;
  border-radius: 0.5vw;
  cursor: pointer;
  white-space: nowrap;
  transition:
    background 0.1s ease,
    transform 0.05s ease;

  &:hover:not(:disabled) {
    background: ${Palette.button.hover};
  }
  &:active:not(:disabled) {
    transform: translateY(0.08vw);
  }
  &:focus-visible {
    outline: solid ${Palette.community.edge} 0.12vw;
    outline-offset: 0.1vw;
  }
  &:disabled {
    pointer-events: none; /* lets a wrapping tooltip catch the hover */
    color: ${Palette.faint};
    background: ${Palette.button.disabled};
    border-color: ${Palette.faint};
  }
`;
