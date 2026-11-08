import { EntityIndex, getComponentValue } from 'engine/recs';
import styled, { keyframes } from 'styled-components';

import { useLayers } from 'app/root/hooks';
import { UIComponent } from 'app/root/types';
import { Modals, useSelected, useVisibility } from 'app/stores';
import { QuestsIcon } from 'assets/images/icons/menu';
import { getItemRarities } from 'constants/itemRarities';
import { getItemByIndex } from 'network/shapes/Item';
import { useComponentEntities } from 'network/utils/hooks';

const COMPLETABLE_TITLE = 'Completable Quest';
const AVAILABLE_COLOR = '#E0A000';
const READY_COLOR = '#23AD41';

export const NotificationFixture: UIComponent = {
  id: 'NotificationFixture',
  Render: () => {
    const layers = useLayers();

    const { notifications } = (() => {
      const {
        network: { notifications },
      } = layers;
      return {
        notifications: notifications,
      };
    })();

    // Reactive list of notification entities via hook
    const list = useComponentEntities(notifications.Notification);
    const notificationsVisible = useVisibility((s) => s.fixtures.notifications);
    const setModals = useVisibility((s) => s.setModals);

    /////////////////
    // INTERACTION

    const handleClick = (
      targetModal: string | undefined,
      entity: EntityIndex,
      questIndex?: EntityIndex
    ) => {
      if (targetModal === undefined) return;
      // now when clicking on quest notifications
      // that questDialogue will open
      if (targetModal === 'questDialogue' && questIndex) {
        useSelected.setState({ questIndex: questIndex });
      }
      const target = targetModal as keyof Modals;
      setModals({ [target]: true });
      dismiss(entity);
    };

    const dismiss = (entity: EntityIndex) => {
      notifications.remove(entity);
    };

    /////////////////
    // VISUALIZATION

    const SingleNotif = (entity: EntityIndex) => {
      const notification = getComponentValue(notifications.Notification, entity);
      if (!notification) return null;

      const {
        network: { world, components },
      } = layers;

      const renderDescription = () => {
        const itemIndices = notification.itemIndices as number[] | undefined;
        const itemAmounts = notification.itemAmounts as string[] | undefined;

        if (!itemIndices || !itemAmounts) {
          return <Description>{notification.description}</Description>;
        }

        return (
          <Description>
            Received:{' '}
            {itemIndices.map((itemIndex, i) => {
              const item = getItemByIndex(world, components, itemIndex);
              const rarity = getItemRarities(item.rarity ?? 0);
              const amount = itemAmounts[i];

              return (
                <span key={i}>
                  {i > 0 && ', '}x{amount} <ItemText $color={rarity.color}>{item.name}</ItemText>
                </span>
              );
            })}
          </Description>
        );
      };

      const open = () =>
        handleClick(
          notification.modal as string | undefined,
          entity,
          notification.questIndex as EntityIndex | undefined
        );

      if (notification.modal === 'questDialogue') {
        const emblems = notification.questEmblems as string[] | undefined;
        const accent = (notification.title as string).startsWith(COMPLETABLE_TITLE)
          ? READY_COLOR
          : AVAILABLE_COLOR;
        return (
          <QuestCard key={entity.toString()} $accent={accent}>
            <ExitButton onClick={() => dismiss(entity)}>X</ExitButton>
            <QuestContent onClick={open}>
              <QuestIcon src={QuestsIcon} alt='' $accent={accent} />
              <QuestText>
                <QuestTitle>{notification.title}</QuestTitle>
                {emblems ? (
                  (notification.description as string).split('\n').map((name, i) => (
                    <QuestRow key={i}>
                      {emblems[i] ? (
                        <QuestEmblem src={emblems[i]} alt='' />
                      ) : (
                        <EmblemSlot>
                          <PixelNub />
                        </EmblemSlot>
                      )}
                      <QuestName>{name}</QuestName>
                    </QuestRow>
                  ))
                ) : (
                  <QuestDescription>{notification.description}</QuestDescription>
                )}
              </QuestText>
            </QuestContent>
          </QuestCard>
        );
      }

      return (
        <Card key={entity.toString()}>
          <ExitButton onClick={() => dismiss(entity)}>X</ExitButton>
          <div onClick={open}>
            <Title>{notification.title}</Title>
            {renderDescription()}
          </div>
        </Card>
      );
    };

    const isVisible = () => {
      return notificationsVisible && list.length > 0;
    };

    /////////////////
    // RENDER

    return (
      <Wrapper style={{ display: isVisible() ? 'block' : 'none' }}>
        <Contents>{list.map((id: EntityIndex) => SingleNotif(id))}</Contents>
      </Wrapper>
    );
  },
};

const Wrapper = styled.div`
  margin: 0.2vw;
  display: block;
  overflow-y: auto;
`;

const Contents = styled.div`
  display: flex;
  flex-flow: column nowrap;
  align-items: flex-start;
  padding: 0.6vw;

  gap: 0.4vh 0.2vw;

  overflow: show;
`;

const Card = styled.div`
  position: relative;

  background-color: #fff;
  border: 0.2vw solid #333;
  border-radius: 0.8vw;
  padding: 0.7vh 1vw;
  width: 100%;
  opacity: 0.9;

  display: flex;
  flex-flow: column nowrap;

  &:hover {
    opacity: 1;
  }

  pointer-events: auto;
  cursor: pointer;
`;

// blinks for a few seconds when it appears, then stays highlighted so it isn't distracting.
// the outer glow stays within Contents' 0.6vw padding, since Wrapper scrolls and clips anything past
// it; the inner glow carries the rest of the pulse. no transform, which would add to the scroll area
const questBlink = (accent: string) => keyframes`
  0%, 100% { box-shadow: 0 0 0.3vw ${accent}, inset 0 0 0 ${accent}; }
  50% { box-shadow: 0 0 0.5vw 0.1vw ${accent}, inset 0 0 1.2vw ${accent}; }
`;

const QuestCard = styled.div<{ $accent: string }>`
  position: relative;
  width: 100%;
  padding: 0.7vw 0.9vw;
  background-color: #fff;
  border: 0.25vw solid ${({ $accent }) => $accent};
  border-radius: 0.8vw;
  box-shadow: 0 0 0.3vw ${({ $accent }) => $accent};
  animation: ${({ $accent }) => questBlink($accent)} 0.9s ease-in-out 6;
  pointer-events: auto;
  cursor: pointer;

  &:hover {
    box-shadow: 0 0 0.6vw ${({ $accent }) => $accent};
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

const QuestContent = styled.div`
  display: flex;
  flex-flow: row nowrap;
  align-items: center;
  gap: 0.7vw;
`;

const QuestIcon = styled.img<{ $accent: string }>`
  flex-shrink: 0;
  width: 2.2vw;
  height: 2.2vw;
  padding: 0.25vw;
  border: 0.15vw solid ${({ $accent }) => $accent};
  border-radius: 0.6vw;
  image-rendering: pixelated;
`;

// lets long quest lines shrink to the card instead of widening it
const QuestText = styled.div`
  min-width: 0;
`;

const QuestTitle = styled.p`
  padding: 0.2vw 0 0.5vw;
  font-family: Pixel;
  font-size: 1vw;
  color: #333;
`;

const QuestRow = styled.div`
  display: flex;
  flex-flow: row nowrap;
  align-items: center;
  gap: 0.4vw;
  padding: 0.05vw 0 0 0.5vw;
  font-family: Pixel;
  font-size: 0.75vw;
  color: #777;
  white-space: nowrap;
`;

// inlined quest names stay on one row of the card
const QuestName = styled.span`
  overflow: hidden;
  text-overflow: ellipsis;
`;

const QuestEmblem = styled.img`
  flex-shrink: 0;
  width: 1.15vw;
  height: 1.15vw;
  image-rendering: pixelated;
`;

const EmblemSlot = styled.div`
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.15vw;
  height: 1.15vw;
`;

// a small pixel plus, for quests with no emblem of their own
const PixelNub = styled.div`
  width: 0.2vw;
  height: 0.2vw;
  background-color: #666;
  box-shadow:
    0.2vw 0 #666,
    -0.2vw 0 #666,
    0 0.2vw #666,
    0 -0.2vw #666;
`;

const QuestDescription = styled.div`
  white-space: pre-line;
  font-family: Pixel;
  font-size: 0.75vw;
  line-height: 1.2vw;
  color: #333;
`;

const Title = styled.p`
  font-family: Pixel;
  font-size: 1vw;
  text-align: left;
  text-wrap: wrap;
  justify-content: flex-start;
  color: #333;
  padding: 1vh 0.5vw 0 0.5vw;

  max-width: 100%;
`;

const Description = styled.div`
  color: #333;

  font-family: Pixel;
  text-align: left;
  text-wrap: wrap;
  line-height: 1.2vw;
  font-size: 0.7vw;
  padding: 0.4vh 0.5vw;

  max-width: 100%;
`;

const ItemText = styled.span<{ $color: string }>`
  color: ${(props) => props.$color};
`;

const ExitButton = styled.button`
  position: absolute;
  right: -0.6vw;
  top: -0.6vw;

  background-color: #ffffff;
  border: 0.15vw solid black;
  border-radius: 0.6vw;
  opacity: 0;

  color: black;
  padding: 0.3vw 0.4vw;

  font-size: 0.9vw;
  cursor: pointer;

  &:hover {
    background-color: #e8e8e8;
    opacity: 1;
    animation: ${() => fadeIn} 0.1s ease-in-out;
  }

  &:active {
    background-color: #c4c4c4;
    opacity: 1;
  }
`;

const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;
