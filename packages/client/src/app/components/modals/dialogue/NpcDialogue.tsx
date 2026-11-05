import { ReactNode, useCallback, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { ExitButton } from 'app/components/library/modals/ExitButton';
import { Modals, useVisibility } from 'app/stores';
import { DialogueAnchor } from 'app/stores/selected';
import { triggerQuestDetailsModal } from 'app/triggers/triggerQuestDetailsModal';
import { Quest } from 'network/shapes/Quest';
import { playClick } from 'utils/sounds';
import { ROOM_OVERLAY_ID, ROOM_SIZE } from './bubble';
import {
  ActionRow,
  Body,
  DialogueChoices,
  DialogueLine,
  DialogueOption,
  splitColumns,
} from './npc/body';
import { Cloud, CornerFlower, Inner, InsideArt, Outline, TagHole } from './npc/frame';
import { CloudHeader, CornerClose, SecondLine } from './npc/header';
import { cloudStyle, placeCloud, useSettledWindowSize } from './npc/placement';
import { ListKind, QuestItems, QuestList } from './npc/questList';
import { QuestTabs } from './npc/questTabs';
import { RitualTab } from './npc/RitualTab';
import { NameIn, NamePos, SkinDecor, TopSprite } from './npc/skinArt';
import { UnderQuestList } from './npc/underSheet';
import { useDialogueKeys } from './npc/useDialogueKeys';
import { getOpening, getQuestList, getRitualColours, getSkin } from './skins';

// the open modals other than the dialogue, as one string so the store selector stays comparable
const otherOpenModals = (modals: Modals) =>
  (Object.keys(modals) as (keyof Modals)[])
    .filter((key) => modals[key] && key !== 'dialogue')
    .join(' ');

// npc conversations live in one speech cloud beside the npc, in the room: a header (name, back /
// next, close), the line, its choices, and the npc's ritual and quests on tabs round the frame.
// the cloud's pieces live in ./npc: this is where they're placed, typed and wired up
export const NpcDialogue = ({
  hasAvailableQuests = [],
  hasOngoingQuests = [],
  npcName = '',
  npcKey = npcName,
  dialogueText = '',
  dialogueOptions = [],
  accent: npcAccent = '#cc88ff',
  special,
  onDialogueComplete,
  onTextAdvance,
  onBack,
  action,
  twoColumnText = false,
  textKey,
  anchor = null,
  open = true,
}: {
  hasAvailableQuests?: Quest[];
  hasOngoingQuests?: Quest[];
  npcName: string;
  npcKey?: string; // the npc's own name, for their look and placement (the shown one may be ???)
  dialogueText: string;
  dialogueOptions?: DialogueOption[];
  accent?: string; // npc colour from npcs.csv: header, hovers, badges, ritual
  special?: { name: string; onclick: () => void };
  onDialogueComplete?: () => void;
  onTextAdvance?: () => void;
  onBack?: () => void;
  action?: ReactNode; // node action buttons (e.g. move), shown under the text
  twoColumnText?: boolean;
  textKey?: string; // step identity; keys resets so same-text transitions still retype
  anchor?: DialogueAnchor | null; // clicked room object the cloud sits beside
  open?: boolean; // fades the cloud with the modal
}) => {
  // a character with their own look (skins.tsx) brings their own colours and decorations
  // re-render when the window changes size, so the cloud is placed and measured again (the name's
  // picture and the cloud's height are measured in pixels)
  const windowSize = useSettledWindowSize();
  const skin = getSkin(npcKey);
  const accent = skin?.colours.accent ?? npcAccent;
  const opening = getOpening(npcKey);
  const ritualColours = getRitualColours(npcKey, skin);
  const tag = skin?.shape === 'tag';
  const bevel = skin?.shape === 'bevel';
  const resetKey = textKey ?? dialogueText;
  const [leftColumnText, rightColumnText] = splitColumns(dialogueText, twoColumnText);

  /////////////////
  // TYPING

  // click-to-skip: interrupting fills the text instantly; done gates the cursor.
  // empty columns never fire onComplete, so only count the ones that render text
  const [skipped, setSkipped] = useState(false);
  const [doneCount, setDoneCount] = useState(0);
  // a finished line shown again (the cloud back after another modal): filled, no callbacks
  const [restored, setRestored] = useState(false);
  const typingTarget = twoColumnText
    ? (leftColumnText ? 1 : 0) + (rightColumnText ? 1 : 0)
    : dialogueText
      ? 1
      : 0;
  const typingDone = doneCount >= typingTarget;

  // reset synchronously on step change: an effect would run after the child
  // typewriter's, leaking a stale skip into the next step (it renders pre-filled)
  const [lastKey, setLastKey] = useState(resetKey);
  if (lastKey !== resetKey) {
    setLastKey(resetKey);
    setSkipped(false);
    setDoneCount(0);
    setRestored(false);
  }

  const handleMainComplete = useCallback(() => {
    setDoneCount((c) => c + 1);
    onDialogueComplete?.();
  }, [onDialogueComplete]);

  const handleSideComplete = useCallback(() => {
    setDoneCount((c) => c + 1);
  }, []);

  // while typing a click fills the text; once done it advances like the next arrow
  const handleTextClick = () => {
    if (!typingDone) {
      setSkipped(true);
    } else if (onTextAdvance) {
      playClick();
      onTextAdvance();
    }
  };
  const clickable = !typingDone || !!onTextAdvance;

  /////////////////
  // VISIBILITY

  // modals open when this line was asked for stay beside the cloud; one opened later (or one of
  // those reopened) hides it until it closes
  const openNow = useVisibility(({ modals }) => otherOpenModals(modals));
  const [beside, setBeside] = useState({ key: resetKey, modals: openNow });
  const openList = openNow ? openNow.split(' ') : [];
  const besideList = beside.modals ? beside.modals.split(' ') : [];
  const stillBeside = besideList.filter((key) => openList.includes(key)).join(' ');
  if (beside.key !== resetKey) setBeside({ key: resetKey, modals: openNow });
  else if (stillBeside !== beside.modals) setBeside({ key: resetKey, modals: stillBeside });
  const shown = open && openList.every((key) => besideList.includes(key));
  // counts each time the cloud comes into view, so its entrance plays again; a line that had
  // finished typing comes back whole
  const [shownCount, setShownCount] = useState(0);
  const [wasShown, setWasShown] = useState(shown);
  if (wasShown !== shown) {
    setWasShown(shown);
    if (shown) {
      setShownCount((c) => c + 1);
      if (typingDone) setRestored(true);
    }
  }

  // a ritual (shop, sacrifice, adoption...) opens over the conversation. its trigger closes the
  // dialogue, so it's reopened at once: the cloud comes back on the same line afterwards
  const startRitual = () => {
    if (!special) return;
    playClick();
    const before = useVisibility.getState().modals;
    special.onclick();
    const { modals: after, setModals } = useVisibility.getState();
    const opened = Object.keys(after).filter(
      (key) =>
        key !== 'dialogue' &&
        after[key as keyof typeof after] &&
        !before[key as keyof typeof before]
    );
    if (opened.length === 0) return;
    if (!after.dialogue) setModals({ dialogue: true });
  };

  /////////////////
  // PLACEMENT

  // beside what was clicked, shrunk as a whole on a screen too narrow for it (see placeCloud)
  const { fit, placement } = placeCloud(npcKey, anchor, twoColumnText, windowSize);
  const roomOverlay = document.getElementById(ROOM_OVERLAY_ID);

  // measure the cloud (in room units) so a tall one can be kept on screen. the typewriter lays
  // out the full text up front, so the height is final as soon as a line starts
  const cloudRef = useRef<HTMLDivElement>(null);
  const [cloudHeight, setCloudHeight] = useState(0);
  useLayoutEffect(() => {
    const el = cloudRef.current;
    if (!el || !roomOverlay?.clientHeight) return;
    const next = (el.offsetHeight / roomOverlay.clientHeight) * ROOM_SIZE;
    if (Math.abs(next - cloudHeight) > 0.5) setCloudHeight(next);
  });

  // a skin's art resting on the name (rob's crown) is drawn over the whole cloud, so the frame's
  // clipped outline can't cut it off. it goes where the name is, measured by offsets (the cloud's
  // pop animation scales it, which bounding boxes would pick up)
  const nameRef = useRef<HTMLSpanElement>(null);
  const [namePos, setNamePos] = useState<NamePos>();
  useLayoutEffect(() => {
    if (!skin?.nameIn) return;
    let el: HTMLElement | null = nameRef.current;
    let [x, y] = [0, 0];
    while (el && el !== cloudRef.current) {
      x += el.offsetLeft;
      y += el.offsetTop;
      el = el.offsetParent as HTMLElement | null;
    }
    const w = nameRef.current?.offsetWidth ?? 0;
    if (
      !namePos ||
      Math.abs(namePos.x - x) > 0.5 ||
      Math.abs(namePos.y - y) > 0.5 ||
      Math.abs(namePos.w - w) > 0.5
    ) {
      setNamePos({ x, y, w });
    }
  });
  const exclaims = /!/.test(dialogueText);

  /////////////////
  // QUESTS

  // the quest lists drop from under the header over the line, or (a skin's questList) come out under
  // the cloud. one under the cloud keeps the last list it showed while it goes back in, so it
  // doesn't empty as it goes
  const [list, setList] = useState<ListKind>();
  const toggleList = (kind: ListKind) => {
    playClick();
    setList((prev) => (prev === kind ? undefined : kind));
  };
  if (!open && list) setList(undefined);
  const underLook = getQuestList(npcKey, skin);
  const [shownList, setShownList] = useState<ListKind>();
  if (list && list !== shownList) setShownList(list);
  const questsOf = (kind: ListKind) =>
    kind === 'available' ? hasAvailableQuests : hasOngoingQuests;
  const pickQuest = (quest: Quest) => {
    playClick();
    setList(undefined);
    triggerQuestDetailsModal(quest.entity);
  };

  /////////////////
  // KEYBOARD

  useDialogueKeys({
    shown,
    advance: handleTextClick,
    back: onBack,
    options: dialogueOptions,
    listOpen: !!list,
  });

  /////////////////
  // THE CLOUD

  const cloud = (
    <Cloud
      // every opening remounts the cloud, so everything in it (the pop, sewing, curls, scenery, the
      // ritual tab) plays again
      key={shownCount}
      ref={cloudRef}
      $open={shown}
      $tail={placement.tail}
      style={cloudStyle(placement, cloudHeight, fit, accent, skin)}
    >
      {/* the npc's quests, on tabs round the cloud's right edge, standing on the second outline */}
      <QuestTabs
        accent={accent}
        available={hasAvailableQuests.length}
        ongoing={hasOngoingQuests.length}
        active={list}
        onToggle={toggleList}
      />
      <SecondLine $tabs={2} $wide={!!special} />
      {/* a skin's pictures over the whole cloud, where the frame can't clip them: a sprite on the
          top edge, and the picture holding the name (rob's padlock) */}
      <TopSprite skin={skin} namePos={namePos} />
      {skin?.nameIn && namePos && <NameIn skin={skin.nameIn} name={npcName} at={namePos} />}
      {/* the ritual's tab, on the second outline at the top right */}
      {special && (
        <RitualTab
          name={special.name}
          skin={skin}
          accent={accent}
          colours={ritualColours}
          onClick={startRitual}
        />
      )}
      {/* the close: a small square badge on the frame's top-right corner, half outside it */}
      <CornerClose>
        <ExitButton divName='dialogue' />
      </CornerClose>

      {/* the pixel frame: a plum stepped outline around the cream stepped inside */}
      <Outline $tag={tag} $bevel={bevel}>
        <Inner $tag={tag} $bevel={bevel} $sew={opening.sew}>
          <InsideArt skin={skin} tag={tag} />
          <CloudHeader
            name={npcName}
            skin={skin}
            accent={accent}
            curls={opening.curls}
            nameRef={nameRef}
            onBack={onBack}
            onNext={handleTextClick}
            nextDisabled={!clickable}
          />
          {/* keyed per line so an exclamation shakes once as the line starts */}
          {/* greyed out while a quest list is open over it (one under the cloud leaves it be) */}
          <Body key={resetKey} $shake={exclaims} $dimmed={!!list && !underLook}>
            <DialogueLine
              left={leftColumnText}
              right={rightColumnText}
              twoColumn={twoColumnText}
              resetKey={resetKey}
              clickable={clickable}
              onClick={handleTextClick}
              interrupted={skipped || restored}
              restored={restored}
              sounded={shown}
              onMainComplete={handleMainComplete}
              onSideComplete={handleSideComplete}
            />
            <DialogueChoices options={dialogueOptions} />
            {action && <ActionRow>{action}</ActionRow>}
          </Body>
        </Inner>
      </Outline>
      {tag && skin && <TagHole colour={skin.colours.line} />}
      {!skin && <CornerFlower />}
      {skin && <SkinDecor skin={skin} />}
      {/* quest lists drop down from the header's bottom edge, over the line and choices */}
      {!underLook && list && (
        <QuestList>
          <QuestItems kind={list} quests={questsOf(list)} onPick={pickQuest} />
        </QuestList>
      )}
      {/* or a skin's comes out from under the frame's bottom edge */}
      {underLook && shownList && (
        <UnderQuestList
          look={underLook}
          tag={tag}
          open={!!list}
          kind={shownList}
          quests={questsOf(shownList)}
          narrow={fit < 1}
          scrollColour={skin?.colours.scroll ?? accent}
          onPick={pickQuest}
        />
      )}
    </Cloud>
  );

  if (!roomOverlay) return null;
  return <>{createPortal(cloud, roomOverlay)}</>;
};
