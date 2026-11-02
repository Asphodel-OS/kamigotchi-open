import pluralize from 'pluralize';
import { Fragment, useEffect, useState } from 'react';
import styled, { css, keyframes } from 'styled-components';

import { ModalWrapper } from 'app/components/library';
import { useLayers } from 'app/root/hooks';
import { UIComponent } from 'app/root/types';
import { useVisibility } from 'app/stores';
import { ItemImages } from 'assets/images/items';
import { OBOL_INDEX } from 'constants/items';
import { EntityIndex, getComponentValue } from 'engine/recs';
import { queryAccountFromEmbedded } from 'network/shapes/Account';
import { getItemBalance } from 'network/shapes/Item';
import { ActionState } from 'network/systems/ActionSystem/constants';
import { playClick, playCrafting, playSuccess } from 'utils/sounds';

// hidden recipe: 1 Obol -> 1 Silt-Caked Box, only craftable at the lake (room 11)
const OFFERING_RECIPE = 10002;
const MAX_BOXES_SHOWN = 5;

export const OfferingModal: UIComponent = {
  id: 'OfferingModal',
  Render: () => {
    const layers = useLayers();

    const {
      network,
      utils: { getObols },
    } = (() => {
      const { network } = layers;
      const { world, components } = network;
      const accountEntity = queryAccountFromEmbedded(network);
      const account = world.entities[accountEntity];

      return {
        network,
        utils: {
          getObols: () => getItemBalance(world, components, account, OBOL_INDEX),
        },
      };
    })();

    const { actions, api } = network;
    const isOpen = useVisibility((s) => s.modals.offering);
    const setModals = useVisibility((s) => s.setModals);
    const [amount, setAmount] = useState(1);
    const [pending, setPending] = useState<EntityIndex>();
    const [offered, setOffered] = useState(0);
    const [view, setView] = useState<'offer' | 'washed'>('offer');
    const [washed, setWashed] = useState(0);
    const [washKey, setWashKey] = useState(0);
    const [, setTick] = useState(Date.now());

    // modals stay mounted, so refresh the balance and the pending offer while open
    useEffect(() => {
      if (!isOpen) return;
      setTick(Date.now());
      const timerID = setInterval(() => setTick(Date.now()), 1000);
      return () => clearInterval(timerID);
    }, [isOpen]);

    // each visit starts at the offer
    useEffect(() => {
      if (isOpen) setView('offer');
    }, [isOpen]);

    const held = getObols();
    const pendingState =
      pending === undefined ? undefined : getComponentValue(actions.Action, pending)?.state;

    // once the craft lands the lake washes the boxes up; failures just re-enable the offer
    useEffect(() => {
      if (pending === undefined) return;
      if (pendingState === ActionState.Complete) {
        setPending(undefined);
        if (!isOpen) return;
        setWashed(offered);
        setWashKey((k) => k + 1);
        setView('washed');
        playSuccess();
      } else if (pendingState === ActionState.Failed || pendingState === ActionState.Canceled) {
        setPending(undefined);
      }
    }, [pending, pendingState]);
    const isBusy =
      pendingState === ActionState.Requested ||
      pendingState === ActionState.Executing ||
      pendingState === ActionState.WaitingForTxEvents;

    /////////////////
    // ACTIONS

    const step = (delta: number) => {
      const next = Math.min(Math.max(1, amount + delta), Math.max(1, held));
      if (next === amount) return;
      playClick();
      setAmount(next);
    };

    const offer = () => {
      if (isBusy) return;
      const entity = actions.add({
        action: 'Offer',
        params: [OFFERING_RECIPE, amount],
        description: `Offering ${pluralize('Obol', amount, true)}`,
        execute: async () => api.player.account.item.craft(OFFERING_RECIPE, amount),
      });
      setPending(entity);
      setOffered(amount);
      playCrafting();
      setAmount(1);
    };

    const again = () => {
      playClick();
      setView('offer');
    };

    const close = () => {
      playClick();
      setModals({ offering: false });
    };

    /////////////////
    // DISPLAY

    return (
      <ModalWrapper id='offering' frameless noPadding noScroll>
        <Frame>
          <Close onClick={close} aria-label='Close'>
            ✕
          </Close>

          <Panes>
            <Pane $active={view === 'offer'} aria-hidden={view !== 'offer'}>
              <Lines>
                <p>You stand at the edge of the darkened lake.</p>
                <p>The Obols in your bag grow heavy, pulling toward the water.</p>
              </Lines>

              <Coin>
                <Chevron disabled={amount <= 1} onClick={() => step(-10)} aria-label='Ten less'>
                  ‹‹
                </Chevron>
                <Chevron disabled={amount <= 1} onClick={() => step(-1)} aria-label='One less'>
                  ‹
                </Chevron>
                <Plinth>
                  <img src={ItemImages.obol} alt='Obol' />
                  <Amount>{amount}</Amount>
                </Plinth>
                <Chevron disabled={amount >= held} onClick={() => step(1)} aria-label='One more'>
                  ›
                </Chevron>
                <Chevron disabled={amount >= held} onClick={() => step(10)} aria-label='Ten more'>
                  ››
                </Chevron>
              </Coin>

              <Choices>
                <Choice disabled={isBusy || held < amount || held === 0} onClick={offer}>
                  Accept and make an offering
                </Choice>
                <Choice onClick={close}>Refuse and walk away</Choice>
              </Choices>
            </Pane>

            <Pane $active={view === 'washed'} aria-hidden={view !== 'washed'}>
              <Fragment key={washKey}>
                <Lines>
                  <Line $delay={0.2}>The Obols sink without a sound.</Line>
                  <Line $delay={1.8}>
                    The lake washes {pluralize('Silt-Caked Box', washed, true)} up on the shore.
                  </Line>
                </Lines>

                <Shore>
                  <Row>
                    {Array.from({ length: Math.min(washed, MAX_BOXES_SHOWN) }, (_, i) => (
                      <Surfacing key={i} $i={i}>
                        <Box src={ItemImages.silt_caked_box} alt='Silt-Caked Box' $i={i} />
                        <Reflection src={ItemImages.silt_caked_box} alt='' aria-hidden />
                      </Surfacing>
                    ))}
                  </Row>
                  {washed > 1 && <Count>×{washed}</Count>}
                </Shore>

                <Choices $delay={2.4}>
                  <Choice disabled={held === 0} onClick={again}>
                    Make another offering
                  </Choice>
                  <Choice onClick={close}>Walk away</Choice>
                </Choices>
              </Fragment>
            </Pane>
          </Panes>
        </Frame>
      </ModalWrapper>
    );
  },
};

const Ink = {
  deep: '#0b0a10',
  pale: '#e8e1f0',
  bone: '#cfc6dc',
  mist: '#9d93ad',
  dim: '#5f5869',
  blood: '#6b1324',
  ember: '#b3243f',
};

// sizing unit: the game's 1vw at 16:9, capped by height on wide screens, height-led on square or tall ones
const u = (n: number) => `calc(var(--u) * ${n})`;

// stepped pixel border: one block per side leaves the corners notched, the way the game's art draws frames
const pixelBorder = (c: string, w = 0.22) =>
  `0 ${u(-w)} 0 0 ${c}, 0 ${u(w)} 0 0 ${c}, ${u(-w)} 0 0 0 ${c}, ${u(w)} 0 0 0 ${c}`;

const Frame = styled.div`
  --u: max(13px, min(1vw, 1.78vh), min(1.5vh, 3vw));
  position: relative;
  box-sizing: border-box;
  width: min(${u(36)}, 94vw);
  max-height: calc(100% - ${u(1.2)});
  margin: auto;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: ${u(1.6)} ${u(2.2)};
  color: ${Ink.pale};
  font-family: Pixel;
  user-select: none;
  background:
    radial-gradient(ellipse at 50% 40%, transparent 30%, rgba(0, 0, 0, 0.7) 100%),
    repeating-linear-gradient(
      0deg,
      rgba(255, 255, 255, 0.035) 0 ${u(0.12)},
      transparent ${u(0.12)} ${u(0.36)}
    ),
    repeating-linear-gradient(
      90deg,
      rgba(255, 255, 255, 0.025) 0 ${u(0.12)},
      transparent ${u(0.12)} ${u(0.36)}
    ),
    ${Ink.deep};
  box-shadow:
    inset 0 0 0 ${u(0.3)} ${Ink.deep},
    inset 0 0 0 ${u(0.42)} ${Ink.blood},
    ${pixelBorder(Ink.bone)};

  img {
    image-rendering: pixelated;
  }
`;

// both views share one grid cell, so the frame keeps its size while they crossfade
const Panes = styled.div`
  display: grid;
  width: 100%;
`;

const Pane = styled.div<{ $active: boolean }>`
  grid-area: 1 / 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: ${u(1.4)};
  opacity: ${({ $active }) => ($active ? 1 : 0)};
  visibility: ${({ $active }) => ($active ? 'visible' : 'hidden')};
  transition:
    opacity 0.6s ease,
    visibility 0s linear ${({ $active }) => ($active ? '0s' : '0.6s')};

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

const Close = styled.button`
  position: absolute;
  top: ${u(0.9)};
  right: ${u(0.9)};
  width: ${u(1.5)};
  height: ${u(1.5)};
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  font-family: Pixel;
  font-size: ${u(0.7)};
  color: ${Ink.bone};
  background: ${Ink.deep};
  border: none;
  box-shadow: ${pixelBorder(Ink.bone, 0.15)};
  cursor: pointer;

  &:hover {
    color: ${Ink.pale};
    box-shadow: ${pixelBorder(Ink.ember, 0.15)};
  }
`;

const Lines = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${u(0.35)};
  text-align: center;

  p {
    margin: 0;
    font-size: ${u(0.66)};
    line-height: 1.6;
    text-wrap: balance;
    color: ${Ink.mist};
  }
`;

const Coin = styled.div`
  display: flex;
  align-items: center;
  gap: ${u(0.5)};
`;

const Chevron = styled.button`
  padding: ${u(0.3)};
  letter-spacing: ${u(-0.2)};
  font-family: Pixel;
  font-size: ${u(1.1)};
  color: ${Ink.mist};
  background: transparent;
  border: none;
  cursor: pointer;

  &:hover:not(:disabled) {
    color: ${Ink.pale};
  }
  &:disabled {
    color: ${Ink.dim};
    opacity: 0.5;
    cursor: default;
  }
`;

const Plinth = styled.div`
  position: relative;
  width: ${u(4)};
  height: ${u(4)};
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
  box-shadow:
    inset 0 0 0 ${u(0.25)} ${Ink.deep},
    inset 0 0 0 ${u(0.35)} ${Ink.blood},
    ${pixelBorder(Ink.bone)};

  img {
    width: ${u(2.6)};
    height: ${u(2.6)};
  }
`;

const Amount = styled.span`
  position: absolute;
  right: ${u(-0.6)};
  bottom: ${u(-0.6)};
  min-width: ${u(1.4)};
  padding: ${u(0.15)} ${u(0.3)};
  font-size: ${u(0.6)};
  text-align: center;
  color: ${Ink.pale};
  background: ${Ink.deep};
  box-shadow: ${pixelBorder(Ink.bone, 0.1)};
`;

const Choices = styled.div<{ $delay?: number }>`
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: ${u(0.8)};
  min-width: ${u(16)};
  ${({ $delay }) => $delay !== undefined && appear($delay)}
`;

// boxed choices after the pop-up shop's accept/refuse buttons
const Choice = styled.button`
  padding: ${u(0.55)} ${u(0.9)};
  font-family: Pixel;
  font-size: ${u(0.66)};
  text-align: center;
  color: ${Ink.pale};
  background: #140a10;
  border: none;
  box-shadow:
    inset 0 0 0 ${u(0.12)} ${Ink.blood},
    ${pixelBorder(Ink.bone)};
  cursor: pointer;

  &:hover:not(:disabled) {
    transform: scale(1.04);
    box-shadow:
      inset 0 0 0 ${u(0.12)} ${Ink.ember},
      ${pixelBorder(Ink.pale)};
  }
  &:disabled {
    cursor: default;
    color: ${Ink.dim};
    background: transparent;
    box-shadow: ${pixelBorder(Ink.dim)};
  }
`;

/////////////////
// WASHED UP

const fadeUp = keyframes`
  from { opacity: 0; transform: translateY(${u(0.3)}); }
  to { opacity: 1; transform: none; }
`;

// the box comes up through the water: wavering and soft at first, then still
const surface = keyframes`
  0% { opacity: 0; transform: translateY(35%) skewX(8deg) scaleY(0.85); filter: blur(${u(0.25)}); }
  35% { opacity: 1; transform: translateY(8%) skewX(-5deg) scaleY(1.05); filter: blur(${u(0.08)}); }
  60% { transform: translateY(0) skewX(3deg) scaleY(0.98); filter: none; }
  80% { transform: skewX(-1deg); }
  100% { opacity: 1; transform: none; filter: none; }
`;

const bob = keyframes`
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8%); }
`;

// the reflection keeps moving with the water
const shimmer = keyframes`
  0%, 100% { transform: translateY(55%) scaleY(-0.55) skewX(4deg); opacity: 0.22; }
  50% { transform: translateY(55%) scaleY(-0.55) skewX(-4deg); opacity: 0.32; }
`;

const appear = (delay: number) => css`
  animation: ${fadeUp} 0.8s ease ${delay}s both;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

const Line = styled.p<{ $delay: number }>`
  ${({ $delay }) => appear($delay)}
`;

const BOX = 3.1;

const Shore = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${u(0.5)};
`;

// the bottom padding is the band the reflections hang into; they take no layout space themselves
const Row = styled.div`
  display: flex;
  justify-content: center;
  gap: ${u(0.7)};
  padding-bottom: ${u(1.5)};
`;

const Surfacing = styled.div<{ $i: number }>`
  position: relative;
  display: flex;
  animation: ${surface} 1.4s ease-out ${({ $i }) => 0.7 + $i * 0.18}s both;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

const Box = styled.img<{ $i: number }>`
  width: ${u(BOX)};
  height: ${u(BOX)};
  animation: ${bob} 3s ease-in-out ${({ $i }) => 2.1 + $i * 0.18}s infinite;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

const Reflection = styled.img`
  position: absolute;
  left: 0;
  top: calc(100% - ${u(0.35)});
  width: ${u(BOX)};
  height: ${u(BOX)};
  transform-origin: top;
  transform: translateY(55%) scaleY(-0.55);
  opacity: 0.25;
  -webkit-mask-image: linear-gradient(to top, black, transparent 85%);
  mask-image: linear-gradient(to top, black, transparent 85%);
  animation: ${shimmer} 2.6s ease-in-out infinite;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

const Count = styled.span`
  padding: ${u(0.4)} ${u(0.8)};
  font-size: ${u(0.75)};
  line-height: 1;
  color: ${Ink.pale};
  background: #140a10;
  box-shadow:
    inset 0 0 0 ${u(0.1)} ${Ink.blood},
    ${pixelBorder(Ink.bone, 0.15)};
  ${appear(1.6)}
`;
