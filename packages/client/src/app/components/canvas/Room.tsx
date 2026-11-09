import { Howl } from 'howler';
import { useEffect, useState } from 'react';
import styled from 'styled-components';
import { useLocalStorage } from 'usehooks-ts';

import { ROOM_OVERLAY_ID } from 'app/components/modals/dialogue/bubble';
import { useAccount, useNetwork, useSelected, useVisibility } from 'app/stores';
import { radiateFx } from 'app/styles/effects';
import { triggerDialogueModal } from 'app/triggers/triggerDialogueModal';
import { arrivalRemaster, cave } from 'assets/sound/ost';
import { dialogues } from 'constants/dialogue';
import { rooms } from 'constants/rooms';
import { QuestGate, RoomAsset } from 'constants/rooms/types';
import { getCurrPhase } from 'utils/time';

const RoomsBgm: Map<string, Howl> = new Map<string, Howl>();
const defaultBgm = { key: 'cave', path: cave };
const preAuthBgm = { key: 'arrivalRemaster', path: arrivalRemaster };

// painting of the room alongside any clickable objects
// completedQuests: the gated quest indices in this room the account has completed
export const Room = ({ index, completedQuests }: { index: number; completedQuests: number[] }) => {
  const tradingModalOpen = useVisibility((s) => s.modals.trading);
  const setModals = useVisibility((s) => s.setModals);
  const setNode = useSelected((s) => s.setNode);
  const dialogueOpen = useVisibility((s) => s.modals.dialogue);
  const dialogueIndex = useSelected((s) => s.dialogueIndex);
  const authenticated = useNetwork((s) => s.validations.authenticated);
  const accountExists = useAccount((s) => s.validations.accountExists);
  const [room, setRoom] = useState(rooms[0]);
  const [bgm, setBgm] = useState<Howl>();
  const [settings] = useLocalStorage('settings', { volume: { fx: 0.5, bgm: 0.5 } });
  const bgmVolume = settings.volume.bgm;
  const useArrivalMusic = !authenticated || !accountExists;

  // Set the new room when the index changes. If the new room has new music,
  // stop the old bgm and play the new one. Global howler audio is controlled
  // in the Volume Settings modal. This recreates any new music from scratch,
  // but ideally we should keep all played tracks in a state map for reuse.
  useEffect(() => {
    const newRoom = rooms[index];
    let music = newRoom.music;
    if (useArrivalMusic) music = preAuthBgm;
    else if (!music) {
      music = defaultBgm;
    }

    // if prev music is the same, or starting new room with default music
    if (music.path !== room.music?.path || !newRoom.music) {
      if (!RoomsBgm.has(music.path)) {
        RoomsBgm.set(music.path, new Howl({ src: [music.path], loop: true, volume: bgmVolume }));
      }
      if (bgm) bgm.stop();

      const newBgm = RoomsBgm.get(music.path);
      newBgm?.play();
      newBgm?.fade(0, bgmVolume, 3000);
      setBgm(newBgm);
    }

    setRoom(newRoom);
    setNode(index);
    closeModals();
  }, [index, useArrivalMusic]);

  /* TODO: when the time comes to have multiple tracks per room,
  remember to turn each room music object into an array of objects,
  also substitute existing useeffect by something like this .
  useEffect(() => {
    const newRoom = rooms[index];
    const newRoomPhase = (getCurrPhase() - 1) % room.music.length;
    const music = newRoom.music[newRoomPhase];
    if (!music) {
      bgm?.stop();
      return;
    }
    if (music.path !== room.music?.path) {
      if (!RoomsBgm.has(music.path)) {
        RoomsBgm.set(music.path, new Howl({ src: [music.path], loop: true, volume: bgmVolume }));
      }
      if (bgm) bgm.stop();

      const newBgm = RoomsBgm.get(music.path);
      newBgm?.play();
      newBgm?.fade(0, bgmVolume, 3000);
      setBgm(newBgm);
    }

    setRoom(newRoom);
    setNode(index);
    closeModals();
  }, [index,getCurrPhase()]);


*/

  // manages volume changes from the variable stored in local storage
  useEffect(() => {
    if (!bgm) return;

    if (bgmVolume === 0) {
      bgm.stop();
    } else {
      if (!bgm.playing()) bgm.play();
      bgm.fade(bgm.volume(), bgmVolume, 3000);
    }
  }, [bgmVolume]);

  // close any room-specific modals as the user changes rooms
  const closeModals = () => {
    setModals({
      bridgeERC721: false, // room specific
      dialogue: false, // room specific
      emaBoard: false, // room specific
      gacha: false, // room specific
      goal: false, // room specific
      leaderboard: false, // room specific
      merchant: false, // room specific
      offering: false, // room specific
    });
  };

  const isUnlocked = (gate?: QuestGate) => {
    if (!gate) return true;
    if (gate.after !== undefined && !completedQuests.includes(gate.after)) return false;
    if (gate.before !== undefined && completedQuests.includes(gate.before)) return false;
    return true;
  };

  // phases start at 1, make start at 0
  const phase = (getCurrPhase() - 1) % room.backgrounds.length;
  const questBgs = room.questBackgrounds;
  const backgrounds =
    questBgs && isUnlocked({ after: questBgs.after }) ? questBgs.backgrounds : room.backgrounds;
  const background = backgrounds[(getCurrPhase() - 1) % backgrounds.length];

  // while an npc here is talking, the background for the current line's mood, if it has one
  const moodBackgrounds = Object.values(room.moods ?? {})
    .map((bgs) => bgs[phase])
    .filter((src): src is string => !!src);
  const mood = dialogueOpen ? dialogues[dialogueIndex]?.npc?.mood : undefined;
  const moodBackground = mood ? room.moods?.[mood]?.[phase] : undefined;
  const moodBase = room.moodBase?.[phase];

  // keyed by room and position: object names repeat (room 77 has two 'coop trigger'), and a duplicate
  // key leaves a stale clickbox mounted in the next rooms
  // a repeated name (room 77 has two 'coop trigger') gets -2, -3: ids must be unique for lookups
  const getClickboxId = (object: RoomAsset, i: number) => {
    const base = `room-object-${object.name.replace(/\s+/g, '-')}`;
    const repeat = room.objects.slice(0, i).filter((o) => o.name === object.name).length;
    return repeat ? `${base}-${repeat + 1}` : base;
  };

  const getClickbox = (object: RoomAsset, i: number) => {
    const key = `${room.index}-${i}`;
    const coords = object.coordinates;
    if (!coords) return;
    const scale = 100 / 128;
    const x1 = coords.x1 * scale;
    const y1 = coords.y1 * scale;
    const x2 = coords.x2 * scale;
    const y2 = coords.y2 * scale;

    let onClick: React.MouseEventHandler<HTMLDivElement> = () => undefined;
    if (object.dialogue) onClick = () => triggerDialogueModal(object.dialogue!, coords);
    else if (object.onClick) onClick = object.onClick;

    return object.name !== 'trading' ? (
      <Clickbox
        key={key}
        id={getClickboxId(object, i)}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        onClick={onClick}
      />
    ) : (
      <Clickbox
        key={key}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        onClick={() => {
          setModals({ trading: !tradingModalOpen });
        }}
      />
    );
  };

  ///////////////////
  // RENDER

  return (
    <Wrapper>
      <Container>
        <Background draggable='false' src={background} />
        {/* every mood stays mounted (and decoded) over the room; swapping one img's src would
        blank the room while the new gif loads. under the pose goes the room without the npc */}
        {moodBase && moodBackgrounds.length > 0 && (
          <MoodBackground draggable='false' src={moodBase} $shown={!!moodBackground} />
        )}
        {moodBackgrounds.map((src) => (
          <MoodBackground key={src} draggable='false' src={src} $shown={src === moodBackground} />
        ))}
        {room.objects.map((object, i) => isUnlocked(object.quest) && getClickbox(object, i))}
        <Overlay id={ROOM_OVERLAY_ID} />
      </Container>
    </Wrapper>
  );
};

const Wrapper = styled.div`
  position: absolute;
  width: auto;
  height: 100%;
  z-index: -2;
`;

const Container = styled.div`
  position: relative;
  width: auto;
  height: auto;
  height: 100%;
`;

// a size container, so what's drawn in it (the npc cloud) can be sized by the room (cqh), not the
// screen
const Overlay = styled.div`
  position: absolute;
  inset: 0;
  pointer-events: none;
  container-type: size;
`;

const Background = styled.img`
  width: 100%;
  height: 100%;
  object-fit: contain;
  image-rendering: pixelated;
  image-rendering: -moz-crisp-edges;
  image-rendering: crisp-edges;
`;

const MoodBackground = styled(Background)<{ $shown: boolean }>`
  position: absolute;
  inset: 0;
  visibility: ${({ $shown }) => ($shown ? 'visible' : 'hidden')};
`;

interface Coordinates {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

const Clickbox = styled.div<Coordinates>`
  border-radius: 3vw;
  position: absolute;
  top: ${({ y1 }) => y1}%;
  left: ${({ x1 }) => x1}%;
  width: ${({ x1, x2 }) => x2 - x1}%;
  height: ${({ y1, y2 }) => y2 - y1}%;

  cursor: pointer;
  pointer-events: auto;
  opacity: 0.2;

  &:hover {
    animation: ${radiateFx} 1.5s linear infinite;
    background: radial-gradient(
      closest-side,
      rgba(255, 255, 255, 1) 0%,
      rgba(80, 80, 205, 1) 70%,
      rgba(80, 80, 80, 0) 90%
    );
  }
`;
