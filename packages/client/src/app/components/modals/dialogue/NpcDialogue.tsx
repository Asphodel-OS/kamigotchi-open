import {
  ReactNode,
  RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import styled, { css, keyframes } from 'styled-components';
import { useWindowSize } from 'usehooks-ts';

import { TextTooltip } from 'app/components/library';
import { ExitButton } from 'app/components/library/modals/ExitButton';
import { Modals, useVisibility } from 'app/stores';
import { DialogueAnchor } from 'app/stores/selected';
import { triggerQuestDetailsModal } from 'app/triggers/triggerQuestDetailsModal';
import { QuestAvailableIcon, QuestOngoingIcon, RitualIcon } from 'assets/images/icons/menu';
import { Quest } from 'network/shapes/Quest';
import { playClick } from 'utils/sounds';
import { playKeystroke } from 'utils/typewriter';
import { TypewriterComponent } from '../questDetails/Typewriter';
import {
  BUBBLE_WIDTH,
  BubblePlacement,
  fitBubble,
  placeBubble,
  ROOM_OVERLAY_ID,
  ROOM_SIZE,
  roomPct,
  screenXToRoom,
} from './bubble';
import {
  getOpening,
  getQuestList,
  getRitualColours,
  getSkin,
  NpcSkin,
  PixelSprite,
  pixelUrl,
  QuestListLook,
  skinVars,
} from './skins';
import { CLOUD_NUDGE } from './speakers';

// ms per letter as a line types: unhurried, so it reads like someone talking, and how many
// letters' worth it rests after a sentence or a comma, like a breath
const TYPE_SPEED = 32;
const TYPE_PAUSES: Record<string, number> = { '.': 9, '?': 9, '!': 9, ',': 5 };
// the quest tabs stand out past the cloud's right edge by u(13), in room units
const TABS_OUT = (((13 * 400) / 1080) * ROOM_SIZE) / 100;
const MIN_FIT = 0.6; // the least a narrow screen shrinks the cloud to (see `fit`)

// the open modals other than the dialogue, as one string so the store selector stays comparable
const otherOpenModals = (modals: Modals) =>
  (Object.keys(modals) as (keyof Modals)[])
    .filter((key) => modals[key] && key !== 'dialogue')
    .join(' ');

type DialogueOption = { label: string; onClick: () => void; asked?: boolean };
type ListKind = 'available' | 'ongoing';

// npc conversations live in one speech cloud beside the npc, in the room: a header (name, back /
// next, close), the line, its choices, and a footer with the npc's ritual and quests
export const NpcDialogue = ({
  hasAvailableQuests = [],
  hasOngoingQuests = [],
  npcName = '',
  npcKey = npcName,
  dialogueText = '',
  dialogueOptions = [],
  npcColor = '',
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
  npcColor: string;
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
  const windowSize = useWindowSize(); /* re-measured on resize */
  const skin = getSkin(npcKey);
  const accent = skin?.colours.accent ?? npcAccent;
  const opening = getOpening(npcKey);
  const ritualColours = getRitualColours(npcKey, skin);
  const tag = skin?.shape === 'tag';
  const bevel = skin?.shape === 'bevel';
  const resetKey = textKey ?? dialogueText;
  const columnTexts = dialogueText
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const leftColumnText = twoColumnText ? (columnTexts[0] ?? '') : dialogueText;
  const rightColumnText = twoColumnText ? (columnTexts[1] ?? '') : '';

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

  // the cloud sits beside what was clicked, at its final width (a two-column line is wider), and
  // may leave the room onto the wallpaper, to 1% from the screen's edges
  const nudge = CLOUD_NUDGE[npcKey.trim().toLowerCase()] ?? 0;
  const nudged =
    anchor && nudge ? { ...anchor, x1: anchor.x1 + nudge, x2: anchor.x2 + nudge } : anchor;
  // the cloud is sized by the room's height, the rest of the ui by the screen's width: the same
  // on a 16:9 screen, but on a narrower one (a phone held upright: the room is a square as tall
  // as the screen, so wider than it) the cloud would come out far bigger than everything else,
  // and wider than the screen. there it keeps its shape and shrinks as a whole: laid out at full
  // size and scaled down by `fit`: towards the size a 16:9 screen of that width would give it
  // (its text then matches the other components'), but never below MIN_FIT, so it stays
  // readable on a phone; and within the screen's width in any case
  const maxRight = screenXToRoom(0.99) - TABS_OUT;
  const minLeft = screenXToRoom(0.01);
  const fullWidth = BUBBLE_WIDTH * (twoColumnText ? 1.6 : 1);
  const widthFit = (maxRight - minLeft) / fullWidth;
  const aspectFit = windowSize.width / (windowSize.height || 1) / (16 / 9);
  const fit = Math.max(0.1, Math.min(1, widthFit, Math.max(aspectFit, MIN_FIT)));
  const placement = placeBubble(nudged, maxRight, { minLeft, width: fullWidth * fit });
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
  const [namePos, setNamePos] = useState<{ x: number; y: number; w: number }>();
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
  // the ritual's lower bracket, the skin's turned upside down (built once: its picture is cached
  // per art object)
  const ritualBrackets = skin?.ritual?.brackets;
  const lowerBracket = useMemo(
    () => ritualBrackets && { ...ritualBrackets, rows: [...ritualBrackets.rows].reverse() },
    [ritualBrackets]
  );

  /////////////////
  // CHOICES AND QUESTS

  const hasChoices = dialogueOptions.length > 0;

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
  const underClipRef = useRef<HTMLDivElement>(null);
  const [shownList, setShownList] = useState<ListKind>();
  if (list && list !== shownList) setShownList(list);
  // a list shows at most UNDER_ROWS quests, then scrolls (mina's receipt runs on to UNDER_MAX).
  // measured when the list or its quests change (and on resize), not on every render: it reads
  // layout
  useLayoutEffect(() => {
    const el = underClipRef.current;
    const inner = el?.firstElementChild as HTMLElement | null;
    if (!el || !inner || underLook?.look === 'receipt') return;
    const next = inner.querySelectorAll('button')[UNDER_ROWS];
    if (!next) {
      el.style.maxHeight = 'none';
      return;
    }
    const style = getComputedStyle(inner);
    const cut = next.offsetTop - parseFloat(style.rowGap || '0') + parseFloat(style.paddingBottom);
    el.style.maxHeight = `${cut}px`;
  }, [
    shownList,
    underLook,
    hasAvailableQuests,
    hasOngoingQuests,
    windowSize.width,
    windowSize.height,
  ]);
  // the sheet's css variables: the look's colours, its scrollbar's colour, a sign's planks and
  // rope, a map's X and compass rose (built once per look, not every render)
  const scrollColour = skin?.colours.scroll ?? accent;
  const underStyle = useMemo(
    () =>
      underLook &&
      ({
        ...underVars(underLook),
        '--ql-scroll': scrollColour,
        ...(underLook.look === 'sign' && {
          '--ql-plank': `url(${underLook.plank.src})`,
          '--ql-rope-art': `url(${underLook.rope.src})`,
          '--ql-title-plank': `url(${underLook.titlePlank.src})`,
        }),
        ...(underLook.look === 'map' && {
          '--ql-x-art': pixelUrl({
            rows: MAP_X,
            colours: { o: underLook.colours.line, x: underLook.colours.mark },
          }),
          '--ql-compass-art': pixelUrl({
            rows: MAP_COMPASS,
            colours: { c: underLook.colours.compass, o: underLook.colours.line },
          }),
        }),
      } as React.CSSProperties),
    [underLook, scrollColour]
  );
  // a contract numbers each quest as a clause
  const contract = underLook?.look === 'contract';
  const questItems = (kind: ListKind) => (
    <>
      <QuestTitle>{kind === 'available' ? 'Available Quests' : 'Ongoing Quests'}</QuestTitle>
      {(kind === 'available' ? hasAvailableQuests : hasOngoingQuests).map((quest, i) => (
        <QuestButton
          $accent={accent}
          key={i}
          style={{ '--i': i } as React.CSSProperties}
          onClick={() => {
            playClick();
            setList(undefined);
            triggerQuestDetailsModal(quest.entity);
          }}
        >
          {contract && <Clause>&sect; {toRoman(i + 1)}</Clause>}
          {quest.name}
        </QuestButton>
      ))}
    </>
  );

  /////////////////
  // KEYBOARD

  // space / enter / right arrow skip the typing or advance, left arrow goes back, number keys pick
  // choices; none while a field has focus, and space / enter leave a focused button its own click
  const keysRef = useRef({
    advance: handleTextClick,
    back: onBack,
    options: dialogueOptions,
    listOpen: false,
  });
  keysRef.current = {
    advance: handleTextClick,
    back: onBack,
    options: dialogueOptions,
    listOpen: !!list,
  };
  useEffect(() => {
    if (!shown) return;
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el?.isContentEditable)
        return;
      if (e.repeat || keysRef.current.listOpen) return;
      if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight') {
        if (e.key !== 'ArrowRight' && tag === 'BUTTON') return;
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
  }, [shown]);

  /////////////////
  // TEXT

  const typewriter = (text: string, key: string, onComplete: () => void) => (
    <TypewriterComponent
      text={text}
      retrigger={key}
      speed={TYPE_SPEED}
      interrupted={skipped || restored}
      onComplete={restored ? undefined : onComplete}
      onType={shown ? playKeystroke : undefined}
      pauses={TYPE_PAUSES}
    />
  );

  const mainText = twoColumnText ? (
    <ParallelColumns onClick={handleTextClick}>
      <Text color={npcColor} $clickable={clickable}>
        {typewriter(leftColumnText, `${resetKey}:L`, handleMainComplete)}
      </Text>
      <Text color={npcColor} $clickable={clickable}>
        {typewriter(rightColumnText, `${resetKey}:R`, handleSideComplete)}
      </Text>
    </ParallelColumns>
  ) : (
    <Text color={npcColor} $clickable={clickable} onClick={handleTextClick}>
      {typewriter(dialogueText, resetKey, handleMainComplete)}
    </Text>
  );

  /////////////////
  // CLOUDS

  // the placement is of the cloud as seen (scaled); its box is laid out at full size, so where
  // the scale's origin isn't its top left (a tail on the right, or a tail down from a bottom-pinned
  // cloud), the box is set off so the seen part lands where placed
  const cloudStyle = (p: BubblePlacement, height: number) =>
    ({
      left: roomPct(p.left + (p.tail === 'right' ? p.width - p.width / fit : 0)),
      top: roomPct(fitBubble(p, height * fit) + (p.tail === 'down' ? height * fit - height : 0)),
      width: roomPct(p.width / fit),
      ...(fit < 1 && { scale: `${fit}` }),
      '--accent': accent,
      ...skinVars(skin),
      // a skin drops the default cloud's stitch round the inside of the frame
      ...(skin && { '--npc-border': 'none' }),
    }) as React.CSSProperties;

  const cloud = (
    <Cloud
      // every opening remounts the cloud, so everything in it (the pop, sewing, curls, scenery, the
      // ritual tab) plays again
      key={shownCount}
      ref={cloudRef}
      $open={shown}
      $tail={placement.tail}
      style={cloudStyle(placement, cloudHeight)}
    >
      {/* the npc's quests, on tabs round the cloud's right edge. like the header below it, it rides
          the cloud's pinned top, so it never moves */}
      <TopBar>
        {/* her quests: two tabs stacked, sharing their outlines */}
        <TabGroup>
          <TextTooltip text={['Available quests']}>
            <QuestIcon
              $accent={accent}
              $active={list === 'available'}
              disabled={hasAvailableQuests.length === 0}
              onClick={() => toggleList('available')}
            >
              <TintedIcon src={QuestAvailableIcon} alt='' accent={accent} />
              {hasAvailableQuests.length > 0 && (
                <QuestCount $accent={accent} $empty={false}>
                  {hasAvailableQuests.length}
                </QuestCount>
              )}
            </QuestIcon>
          </TextTooltip>
          <TextTooltip text={['Ongoing quests']}>
            <QuestIcon
              $accent={accent}
              $active={list === 'ongoing'}
              disabled={hasOngoingQuests.length === 0}
              onClick={() => toggleList('ongoing')}
            >
              <TintedIcon src={QuestOngoingIcon} alt='' accent={accent} />
              {hasOngoingQuests.length > 0 && (
                <QuestCount $accent={accent} $empty={false}>
                  {hasOngoingQuests.length}
                </QuestCount>
              )}
            </QuestIcon>
          </TextTooltip>
        </TabGroup>
      </TopBar>
      <SecondLine $tabs={2} $wide={!!special} />
      {/* the ritual's tab, on the second outline at the top right */}
      <TopSprite skin={skin} namePos={namePos} />
      {/* a skin's picture holding the name (rob's padlock): the back behind the letters, the name,
          then the front over their lower edge. drawn over the whole cloud so the frame can't clip
          it; the header's own name stays, hidden, to hold its place */}
      {skin?.nameIn && namePos && <NameIn skin={skin.nameIn} name={npcName} at={namePos} />}
      <HeadExit>
        {special && (
          <RitualTab
            onClick={startRitual}
            $plaque={ritualColours?.plaque ?? skin?.ritual?.plaque}
            style={
              {
                animationDelay: `${RITUAL_DELAY}s`,
                '--ritual-arrived': `${RITUAL_DELAY + 0.6}s`,
                ...(ritualColours && {
                  '--npc-fill': ritualColours.fill,
                  '--npc-row': `color-mix(in srgb, ${ritualColours.fill} 85%, white)`,
                  '--npc-name': ritualColours.name,
                  ...(ritualColours.thick && { '--ritual-name-thicken': '0.0711cqh' }),
                  ...(ritualColours.stitch && {
                    '--accent': ritualColours.stitch,
                    '--ritual-stitch': ritualColours.stitch,
                  }),
                }),
              } as React.CSSProperties
            }
          >
            {skin?.ritual?.brackets && (
              <RitualBracket style={{ top: u(1.5), right: u(1.5) }}>
                <PixelSprite art={skin.ritual.brackets} cell={u(0.75)} flip />
              </RitualBracket>
            )}
            <RitualMedal
              $ring={skin?.ritual?.ring?.colour}
              $ringWidth={skin?.ritual?.ring ? u(1.5) : u(2)}
              $plaque={skin?.ritual?.plaque}
              $stitch={skin ? skin.ritual?.ring?.stitch : accentMix(60)}
              // the medal keeps the cloud's own colours under the tab's (initial: the default panel)
              style={
                ritualColours &&
                ({
                  '--npc-fill': ritualColours.medal?.fill ?? skin?.colours.fill ?? 'initial',
                  '--accent': accent,
                } as React.CSSProperties)
              }
            >
              <TintedIcon src={RitualIcon} alt='' accent={ritualColours?.medal?.icon ?? accent} />
            </RitualMedal>
            <BurstAt>
              {/* as it turns, pixels pop out of it all round, white and the npc's colour */}
              {Array.from({ length: BURST }, (_, i) => (
                <BurstBit
                  key={i}
                  style={
                    {
                      '--angle': `${(i * 360) / BURST}deg`,
                      background: i % 2 ? (ritualColours?.burst ?? accent) : '#ffffff',
                    } as React.CSSProperties
                  }
                />
              ))}
            </BurstAt>
            <RitualOrnament skin={skin} colour={ritualColours?.stitch} />
            <RitualName>
              {lowerBracket && (
                <RitualBracket
                  style={{ left: `calc(-1 * ${u(2)})`, bottom: `calc(-1 * ${u(1.25)})` }}
                >
                  <PixelSprite art={lowerBracket} cell={u(0.75)} />
                </RitualBracket>
              )}
              {special.name}
            </RitualName>
            <RitualOrnament skin={skin} colour={ritualColours?.stitch} flip />
          </RitualTab>
        )}
      </HeadExit>
      {/* the close: a small square badge on the frame's top-right corner, half outside it */}
      <CornerClose>
        <ExitButton divName='dialogue' />
      </CornerClose>

      {/* the pixel frame: a plum stepped outline around the cream stepped inside */}
      <Outline $tag={tag} $bevel={bevel}>
        <Inner $tag={tag} $bevel={bevel} $sew={opening.sew}>
          {skin?.scenery && <Scenery items={skin.scenery} />}
          {skin?.patch && (
            <Patch>
              <PixelSprite art={skin.patch} cell={B} />
            </Patch>
          )}
          {skin?.brackets && <Brackets art={skin.brackets} />}
          {tag && skin?.tearLine && <TearLine $colour={skin.tearLine} />}
          {/* header: at the cloud's pinned top so nothing in it ever moves: the name between its
          two curls on the left; back / next on the right (the close is a tab on the top edge) */}
          <Head $accent={accent}>
            <HeadRow>
              <Name $accent={accent} $curls={opening.curls}>
                <NameLeft skin={skin} />
                <NameText name={npcName} nameRef={nameRef} hidden={!!skin?.nameIn} />
                <NameRight skin={skin} />
              </Name>
              <NavSeg>
                <NavButton
                  $accent={accent}
                  aria-label='back'
                  disabled={!onBack}
                  onClick={() => {
                    playClick();
                    onBack?.();
                  }}
                >
                  <PixelArrow flip />
                </NavButton>
                <NavButton
                  $accent={accent}
                  aria-label='next'
                  disabled={!clickable}
                  onClick={handleTextClick}
                >
                  <PixelArrow />
                </NavButton>
              </NavSeg>
            </HeadRow>
          </Head>

          {/* keyed per line so an exclamation shakes once as the line starts */}
          {/* greyed out while a quest list is open over it (one under the cloud leaves it be) */}
          <Body key={resetKey} $shake={exclaims} $dimmed={!!list && !underLook}>
            {mainText}
            {hasChoices && (
              <Choices>
                {dialogueOptions.map((option, index) => (
                  <Choice
                    key={`${option.label}-${index}`}
                    $accent={accent}
                    $asked={!!option.asked}
                    onClick={() => {
                      playClick();
                      option.onClick();
                    }}
                  >
                    <ChoiceMark />
                    <FitLabel>{option.label}</FitLabel>
                  </Choice>
                ))}
              </Choices>
            )}
            {action && <ActionRow>{action}</ActionRow>}
          </Body>
        </Inner>
      </Outline>
      {tag && <TagHole colour={skin!.colours.line} />}
      {!skin && <CornerFlowers />}
      {skin && <SkinDecor skin={skin} />}
      {/* quest lists drop down from the header's bottom edge, over the line and choices */}
      {!underLook && list && <QuestList>{questItems(list)}</QuestList>}
      {/* or a skin's comes out from under the frame's bottom edge */}
      {underLook && shownList && (
        <UnderSlot $tag={tag} $deep={underLook.look === 'contract'}>
          <UnderSheet $look={underLook.look} $open={!!list} style={underStyle}>
            {underLook.look === 'bottles' ? (
              <BottleBox
                key={shownList}
                look={underLook}
                places={fit < 1 ? BOTTLE_PLACES_NARROW : BOTTLE_PLACES}
                title={shownList === 'available' ? 'Available Quests' : 'Ongoing Quests'}
                quests={shownList === 'available' ? hasAvailableQuests : hasOngoingQuests}
                onPick={(quest) => {
                  playClick();
                  setList(undefined);
                  triggerQuestDetailsModal(quest.entity);
                }}
              />
            ) : (
              <UnderPaper $look={underLook.look}>
                <UnderClip ref={underClipRef}>
                  <UnderScroll>{questItems(shownList)}</UnderScroll>
                </UnderClip>
                <ScrollBar target={underClipRef} watch={shownList} />
              </UnderPaper>
            )}
            {underLook.look === 'contract' && (
              <>
                <Seal $open={!!list}>
                  <img src={underLook.seal.src} alt='' draggable={false} />
                </Seal>
                <ScrollRod />
              </>
            )}
          </UnderSheet>
        </UnderSlot>
      )}
    </Cloud>
  );

  if (!roomOverlay) return null;
  return <>{createPortal(cloud, roomOverlay)}</>;
};

/////////////////
// SMALL PIECES

// one-line label that shrinks its font just enough to fit its box (down to minScale), and only
// wraps past that unless noWrap (then it just stays at minScale)
const FitLabel = ({
  children,
  minScale = 0.6,
  noWrap = false,
}: {
  children: ReactNode;
  minScale?: number;
  noWrap?: boolean;
}) => {
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.fontSize = '';
    el.style.whiteSpace = '';
    const ratio = el.clientWidth / el.scrollWidth;
    if (ratio >= 1) return;
    el.style.fontSize = `${Math.max(ratio, minScale)}em`;
    if (ratio < minScale && !noWrap) el.style.whiteSpace = 'normal';
  }, [children, minScale, noWrap]);
  return <LabelText ref={ref}>{children}</LabelText>;
};

// a small flower inside the cloud's bottom left corner, in pixels of one outline width, outlined
// in a dark shade of the npc's colour. built once: cells are [x, y, colour], 0 0 = the corner
// cell, FLOWER_IN pixels in from the frame's outer edge
type VineCell = [number, number, string];
const VINE_DARK = 'color-mix(in srgb, var(--accent) 60%, black)';
const FLOWER_IN = 5;
// the petals, opening inward from the corner (up and right of it, once flipped)
const FLOWER = [
  [-1, 2],
  [0, 1],
  [-2, 1],
  [-1, 0],
];
const flower = (
  flip: number // -1 turns it round to the opposite corner
): VineCell[] => {
  const cells = new Map<string, VineCell>();
  const put = (x: number, y: number, colour: string) =>
    cells.set(`${x},${y}`, [x * flip, y * flip, colour]);
  const filled = new Set([...FLOWER, [-1, 1]].map(([x, y]) => `${x},${y}`));
  // an outline round the petals
  FLOWER.forEach(([x, y]) =>
    [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ].forEach(([dx, dy]) => {
      if (!filled.has(`${x + dx},${y + dy}`)) put(x + dx, y + dy, VINE_DARK);
    })
  );
  FLOWER.forEach(([x, y]) => put(x, y, '#f6e2e8'));
  put(-1, 1, '#f0d36b');
  return [...cells.values()];
};
const FLOWERS = [flower(-1)];
const CornerFlowers = () => (
  <>
    {FLOWERS.map((cells, i) => {
      const xs = cells.map(([x]) => x);
      const ys = cells.map(([, y]) => y);
      const [x0, y0] = [Math.min(...xs), Math.min(...ys)];
      const [w, h] = [Math.max(...xs) - x0 + 1, Math.max(...ys) - y0 + 1];
      // the bottom left corner cell
      const place: React.CSSProperties = {
        left: `calc(${x0 + FLOWER_IN} * ${B})`,
        top: `calc(100% + ${y0 - 1 - FLOWER_IN} * ${B})`,
      };
      return (
        <VineSvg
          key={i}
          viewBox={`${x0} ${y0} ${w} ${h}`}
          shapeRendering='crispEdges'
          style={{ ...place, width: `calc(${w} * ${B})`, height: `calc(${h} * ${B})` }}
        >
          {cells.map(([x, y, fill]) => (
            <rect key={`${x},${y}`} x={x} y={y} width={1.02} height={1.02} style={{ fill }} />
          ))}
        </VineSvg>
      );
    })}
  </>
);

// screen size of n picture pixels drawn at `cell` px each (at 1920 wide; 3 is the frame's own pixel)
const px3 = (n: number, cell = 3) => `calc(${n} * ${u(cell / 4)})`;

// a skin's pictures round the frame, free to stick out past it, and its strip along the top edge
const SkinDecor = ({ skin }: { skin: NpcSkin }) => (
  <>
    {skin.topEdge && (
      <TopEdge
        style={{
          left: u(skin.topEdge.from / 4),
          right: u(skin.topEdge.to / 4),
          top: `calc(-${skin.topEdge.row} * ${B})`,
          height: px3(skin.topEdge.art.rows.length),
          background: `${pixelUrl(skin.topEdge.art)} left top / ${px3(Math.max(...skin.topEdge.art.rows.map((r) => r.length)))} 100% repeat-x`,
        }}
      />
    )}
    {skin.decor?.map(({ src, width, height, at, cell, flip, flutter }, i) => (
      <Decor
        key={i}
        src={src}
        alt=''
        draggable={false}
        $flutter={!!flutter}
        style={
          {
            width: px3(width, cell),
            height: px3(height, cell),
            ...Object.fromEntries(Object.entries(at).map(([side, n]) => [side, u(n / 4)])),
            '--flip': flip ? -1 : 1,
            ...(flutter && {
              '--from-x': u(flutter.from[0] / 4),
              '--from-y': u(flutter.from[1] / 4),
              '--flutter-for': `${flutter.for}s`,
              '--flutter-delay': `${flutter.delay ?? 0}s`,
              '--beats': Math.round(flutter.for / 0.2),
            }),
          } as React.CSSProperties
        }
      />
    ))}
  </>
);

// either side of the name: the default curls, a skin's ornament, or (with none) an empty space
// the curl's size on the left, so every name starts in the same place
const NameLeft = ({ skin }: { skin?: NpcSkin }) => {
  if (!skin) return <Curl />;
  if (skin.ornament) return <PixelSprite art={skin.ornament} cell={B} />;
  return <span style={{ width: `calc(${5 + (skin.nameIndent ?? 0)} * ${B})` }} />;
};
const NameRight = ({ skin }: { skin?: NpcSkin }) => {
  if (!skin) return <Curl flip />;
  return skin.nameIn || !skin.ornament ? null : <PixelSprite art={skin.ornament} cell={B} flip />;
};

// the ritual's tab rises from behind the frame this long (s) after the cloud opens
const RITUAL_DELAY = 1;

// either side of the ritual's name, smaller than by the npc's name: the skin's own for its ritual
// (null: none), else the one by its name; the default cloud's curls only for npcs without a skin
// the curls are drawn in `colour` (a tab's own stitch colour), else the cloud's dark shade of its own
const RitualOrnament = ({
  skin,
  colour,
  flip = false,
}: {
  skin?: NpcSkin;
  colour?: string;
  flip?: boolean;
}) => {
  const own = skin?.ritual?.ornament;
  if (own && 'src' in own) return <OrnamentItem src={own.src} alt='' $flip={flip} />;
  const art = own === null ? undefined : (own ?? skin?.ornament);
  if (art) return <PixelSprite art={art} cell={u(0.5)} flip={flip} />;
  if (skin) return null;
  return (
    <SmallCurl $colour={colour}>
      <Curl flip={flip} />
    </SmallCurl>
  );
};

// a game item beside the ritual's name (mina's candy), mirrored on the right
const OrnamentItem = styled.img<{ $flip: boolean }>`
  width: 2.6667cqh;
  height: 2.6667cqh;
  margin: 0 -0.2667cqh;
  image-rendering: pixelated;
  transform: ${({ $flip }) => ($flip ? 'scaleX(-1)' : 'none')};
`;

// a skin's sprite lying on the cloud's top edge (mina's Byakuya): its lowest row rests on the
// outline, centred where the second outline's strip begins, or (behindName) half hidden behind the
// right edge of the name's picture
const TopSprite = ({
  skin,
  namePos,
}: {
  skin?: NpcSkin;
  namePos?: { x: number; y: number; w: number };
}) => {
  if (!skin?.onTop) return null;
  const { src, width, height, behindName } = skin.onTop;
  const nameIn = skin.nameIn;
  if (behindName && (!nameIn || !namePos)) return null; // until the name has been measured
  const left =
    behindName && nameIn && namePos
      ? `calc(${namePos.x + namePos.w / 2}px + ${nameIn.back.width / 2} * ${u((nameIn.cell ?? 2) / 4)})`
      : undefined;
  return (
    <OnTop
      src={src}
      alt=''
      draggable={false}
      style={{
        width: `calc(${width} * ${u(0.5)})`,
        height: `calc(${height} * ${u(0.5)})`,
        ...(left && { left }),
      }}
    />
  );
};

// the name. the main cloud's carries a ref, so a skin's picture can be placed on it (see NameIn)
const NameText = ({
  name,
  nameRef,
  hidden = false,
}: {
  name: string;
  nameRef?: React.RefObject<HTMLSpanElement>;
  hidden?: boolean; // drawn again over the cloud instead (see NameIn)
}) => (
  <span ref={nameRef} style={hidden ? { visibility: 'hidden' } : undefined}>
    {name}
  </span>
);

// a solid pixel triangle; the game's arrow icons blur at this size
const ARROW_ROWS = ['X...', 'XX..', 'XXX.', 'XXXX', 'XXX.', 'XX..', 'X...'];
const PixelArrow = ({ flip = false }: { flip?: boolean }) => (
  <svg
    viewBox='0 0 4 7'
    shapeRendering='crispEdges'
    fill='currentColor'
    style={{ width: u(2), height: u(3.5) }}
  >
    {ARROW_ROWS.flatMap((row, y) =>
      [...row].map((c, x) =>
        c === 'X' ? (
          <rect key={`${x}-${y}`} x={flip ? 3 - x : x} y={y} width={1} height={1} />
        ) : null
      )
    )}
  </svg>
);

/////////////////
// ANIMATIONS

// the cloud springs out of its tail
const pop = keyframes`
  0% { transform: scale(0.85); opacity: 0; }
  60% { transform: scale(1.03); opacity: 1; }
  100% { transform: scale(1); }
`;

const shake = keyframes`
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-0.4444cqh) rotate(-0.4deg); }
  40% { transform: translateX(0.4444cqh) rotate(0.4deg); }
  60% { transform: translateX(-0.2667cqh); }
  80% { transform: translateX(0.2667cqh); }
`;

/////////////////
// CLOUD STYLES

// one 4px grid for every size, gap and outline. sizes follow the room's height (cqh: the room
// overlay is a size container), not the screen, so the cloud keeps its shape on any screen
const u = (n: number) => `${+((n * 400) / 1080).toFixed(4)}cqh`;
const B = u(0.75); // outline width: 3px

// a warm cream panel outlined in the game's plum, with dark plum text; the npc's colour
// (--accent, set on the cloud) marks the name, keys, hovers and a hairline inside the edge
const PANEL = {
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
const accentMix = (pct: number, base = 'transparent') =>
  `color-mix(in srgb, var(--accent) ${pct}%, ${base})`;

// openings (see getOpening): the stitch sewn on from the top-left corner, a widening triangle
// uncovering it; the curls unfurling from the name outwards
const sewOn = keyframes`
  from {
    clip-path: polygon(0 0, 0 0, 0 0);
  }
  to {
    clip-path: polygon(0 0, 300% 0, 0 300%);
  }
`;
const unfurlLeft = keyframes`
  from {
    clip-path: inset(0 0 0 100%);
  }
  to {
    clip-path: inset(0);
  }
`;
const unfurlRight = keyframes`
  from {
    clip-path: inset(0 100% 0 0);
  }
  to {
    clip-path: inset(0);
  }
`;

// stepped "staircase" corners, two steps of one outline width, like the game's pixel art
const stepped = (b: string) => `polygon(
  0 calc(2 * ${b}), ${b} calc(2 * ${b}), ${b} ${b}, calc(2 * ${b}) ${b}, calc(2 * ${b}) 0,
  calc(100% - 2 * ${b}) 0, calc(100% - 2 * ${b}) ${b}, calc(100% - ${b}) ${b},
  calc(100% - ${b}) calc(2 * ${b}), 100% calc(2 * ${b}),
  100% calc(100% - 2 * ${b}), calc(100% - ${b}) calc(100% - 2 * ${b}),
  calc(100% - ${b}) calc(100% - ${b}), calc(100% - 2 * ${b}) calc(100% - ${b}),
  calc(100% - 2 * ${b}) 100%,
  calc(2 * ${b}) 100%, calc(2 * ${b}) calc(100% - ${b}), ${b} calc(100% - ${b}),
  ${b} calc(100% - 2 * ${b}), 0 calc(100% - 2 * ${b})
)`;

type Tail = 'left' | 'right' | 'down' | 'none';

const Cloud = styled.div<{ $open: boolean; $tail: Tail }>`
  position: absolute; /* inside the room overlay: above the art, under the ui modals */
  isolation: isolate; /* its own layer group, so the second outline (z -1) stays above the room art */
  /* phones inflate small text on their own (font boosting), which breaks the cloud's shape: its
  text is sized by the room like everything else in it, and the player zooms in to read */
  -webkit-text-size-adjust: none;
  text-size-adjust: none;
  transform-origin: ${({ $tail }) =>
    $tail === 'down' ? 'left bottom' : `${$tail === 'right' ? 'right' : 'left'} top`};
  animation: ${pop} 0.28s cubic-bezier(0.2, 0.8, 0.2, 1.2);
  opacity: ${({ $open }) => ($open ? 1 : 0)};
  pointer-events: ${({ $open }) => ($open ? 'auto' : 'none')};
  transition: opacity 0.25s ease;
`;

// a price tag's left end: both left corners cut away in `n` steps of one outline width, the right
// corners stepped as usual
const tagged = (b: string, n: number) => {
  const at = (x: number, y: string) => `calc(${x} * ${b}) ${y}`;
  const top = [...Array(n)].flatMap((_, i) => [
    at(i, `calc(${n - i} * ${b})`),
    at(i + 1, `calc(${n - i} * ${b})`),
  ]);
  const bottom = [...Array(n)].flatMap((_, k) => {
    const i = n - 1 - k;
    return [at(i + 1, `calc(100% - ${n - i} * ${b})`), at(i, `calc(100% - ${n - i} * ${b})`)];
  });
  return `polygon(${[
    ...top,
    at(n, '0'),
    `calc(100% - 2 * ${b}) 0, calc(100% - 2 * ${b}) ${b}, calc(100% - ${b}) ${b}`,
    `calc(100% - ${b}) calc(2 * ${b}), 100% calc(2 * ${b})`,
    `100% calc(100% - 2 * ${b}), calc(100% - ${b}) calc(100% - 2 * ${b})`,
    `calc(100% - ${b}) calc(100% - ${b}), calc(100% - 2 * ${b}) calc(100% - ${b})`,
    `calc(100% - 2 * ${b}) 100%`,
    at(n, '100%'),
    ...bottom,
  ].join(', ')})`;
};
const TAG_CUT = 14; // steps cut off each left corner of a tag-shaped frame

// all four corners cut off in `n` steps of one outline width: each corner a staircase, so the
// straight edges between them run exactly level and upright
const bevelled = (b: string, n: number) => {
  const at = (x: string, y: string) => `${x} ${y}`;
  const near = (i: number) => `calc(${i} * ${b})`;
  const far = (i: number) => `calc(100% - ${i} * ${b})`;
  const pts: string[] = [at('0', near(n))];
  for (let i = 0; i < n; i++)
    pts.push(at(near(i + 1), near(n - i)), at(near(i + 1), near(n - i - 1))); // top-left
  pts.push(at(far(n), '0'));
  for (let i = 0; i < n; i++)
    pts.push(at(far(n - i), near(i + 1)), at(far(n - i - 1), near(i + 1))); // top-right
  pts.push(at('100%', far(n)));
  for (let i = 0; i < n; i++) pts.push(at(far(i + 1), far(n - i)), at(far(i + 1), far(n - i - 1))); // bottom-right
  pts.push(at(near(n), '100%'));
  for (let i = 0; i < n; i++)
    pts.push(at(near(n - i), far(i + 1)), at(near(n - i - 1), far(i + 1))); // bottom-left
  return `polygon(${pts.join(', ')})`;
};
const BEVEL_CUT = 9; // steps cut off each corner of a bevelled frame

const Outline = styled.div<{ $tag?: boolean; $bevel?: boolean }>`
  padding: ${B};
  background: ${PANEL.line};
  clip-path: ${({ $tag, $bevel }) =>
    $tag ? tagged(B, TAG_CUT) : $bevel ? bevelled(B, BEVEL_CUT) : stepped(B)};
  /* a tag's hole is punched right through, the room showing in it: the inside of TagHole's ring,
  three pixels square, cut out of the whole frame */
  ${({ $tag }) =>
    $tag &&
    css`
      mask:
        linear-gradient(#000 0 0) calc(5 * ${B}) center / calc(3 * ${B}) calc(3 * ${B}) no-repeat,
        linear-gradient(#000 0 0);
      mask-composite: exclude;
    `}
`;

const Inner = styled.div<{ $tag?: boolean; $bevel?: boolean; $sew?: boolean }>`
  position: relative;
  background: ${PANEL.fill};
  clip-path: ${({ $tag, $bevel }) =>
    $tag ? tagged(B, TAG_CUT - 1) : $bevel ? bevelled(B, BEVEL_CUT - 1) : stepped(B)};
  /* a tag leaves room on the left for its hole */
  padding-left: ${({ $tag }) => ($tag ? u(6) : 0)};
  /* a running stitch of the npc's colour just inside the edge: dashes one outline width long,
  with the same gap, along each side */
  &::after {
    content: '';
    position: absolute;
    inset: ${u(1.25)};
    pointer-events: none;
    --stitch: ${accentMix(55)};
    --across: repeating-linear-gradient(
      90deg,
      var(--stitch) 0 ${B},
      transparent ${B} calc(2 * ${B})
    );
    --down: repeating-linear-gradient(
      180deg,
      var(--stitch) 0 ${B},
      transparent ${B} calc(2 * ${B})
    );
    /* an opening: the stitch is sewn on in steps, from the top-left corner outwards */
    ${({ $sew }) =>
      $sew &&
      css`
        animation: ${sewOn} 2.4s steps(24) 0.15s both;
      `}
    /* a skin brings its own pattern (--npc-border) */
    background: var(
      --npc-border,
      var(--across) top / 100% ${u(0.5)} no-repeat,
      var(--across) bottom / 100% ${u(0.5)} no-repeat,
      var(--down) left / ${u(0.5)} 100% no-repeat,
      var(--down) right / ${u(0.5)} 100% no-repeat
    );
  }
`;

// a skin's bracket in each corner inside the frame: drawn for the top-left, mirrored for the rest
const Brackets = ({ art }: { art: NonNullable<NpcSkin['brackets']> }) => (
  <>
    {(
      [
        [false, false],
        [true, false],
        [false, true],
        [true, true],
      ] as const
    ).map(([right, bottom]) => (
      <CornerArt
        key={`${right}${bottom}`}
        style={{
          [right ? 'right' : 'left']: 0,
          [bottom ? 'bottom' : 'top']: 0,
          transform: bottom ? 'scaleY(-1)' : undefined,
        }}
      >
        <PixelSprite art={art} cell={B} flip={right} />
      </CornerArt>
    ))}
  </>
);

// a skin's background pictures, under the text and buttons, each placed from the inside's edges
const Scenery = ({ items }: { items: NonNullable<NpcSkin['scenery']> }) => (
  <>
    {items.map(({ art, at, twinkle, over, invert }, i) => {
      const place = {
        top: 'auto',
        right: 'auto',
        ...Object.fromEntries(Object.entries(at).map(([side, px]) => [side, u(px / 4)])),
        // over the words (the text and its rows sit at the layer's own level)
        ...(over && { zIndex: 2 }),
        ...(invert && { mixBlendMode: 'difference' as const }),
      };
      const sprite = <PixelSprite art={art} cell={B} />;
      if (twinkle !== undefined)
        return (
          <Twinkling key={i} style={{ ...place, animationDelay: `${twinkle}s` }}>
            {sprite}
          </Twinkling>
        );
      return (
        <Patch key={i} style={place}>
          {sprite}
        </Patch>
      );
    })}
  </>
);

// a skin's patch of colour in the top-right corner, under the text and buttons (the frame's clip
// makes the inside its own layer, so -1 keeps it above the panel's fill)
const Patch = styled.div`
  position: absolute;
  z-index: -1;
  top: 0;
  right: 0;
  pointer-events: none;
`;

// a star blinking once when the cloud opens
const blink = keyframes`
  50% {
    opacity: 0.1;
  }
`;
const Twinkling = styled(Patch)`
  animation: ${blink} 0.4s steps(1);
`;

// a dotted tear line down a price tag's left end, just right of its hole
const TearLine = styled.div<{ $colour: string }>`
  position: absolute;
  z-index: -1;
  left: calc(11 * ${B});
  width: ${B};
  top: calc(4 * ${B});
  bottom: calc(4 * ${B});
  background: repeating-linear-gradient(
    180deg,
    ${({ $colour }) => $colour} 0 ${B},
    transparent ${B} calc(2 * ${B})
  );
  pointer-events: none;
`;

// a price tag's punched hole, in the middle of its cut-off left end
const TagHole = ({ colour }: { colour: string }) => {
  // one art object per colour, so its picture is built once
  const art = useMemo(
    () => ({ rows: ['.ooo.', 'o...o', 'o...o', 'o...o', '.ooo.'], colours: { o: colour } }),
    [colour]
  );
  return (
    <CornerArt style={{ left: `calc(4 * ${B})`, top: `calc(50% - 2.5 * ${B})`, zIndex: 3 }}>
      <PixelSprite art={art} cell={B} />
    </CornerArt>
  );
};

// a skin's pictures round the frame (over the name's picture, so a butterfly can rest on a sign),
// and its strip along the top edge. a fluttering one flies in from its start in a wavy path, its
// wings beating (it narrows and widens), and settles where it rests
const flutterIn = keyframes`
  0% {
    translate: var(--from-x) var(--from-y);
  }
  30% {
    translate: calc(var(--from-x) * 0.65) calc(var(--from-y) * 0.5 - ${u(3)});
  }
  55% {
    translate: calc(var(--from-x) * 0.3) calc(var(--from-y) * 0.3 + ${u(2)});
  }
  80% {
    translate: calc(var(--from-x) * 0.08) calc(-1 * ${u(2)});
  }
  100% {
    translate: 0 0;
  }
`;
const beat = keyframes`
  50% {
    scale: calc(var(--flip) * 0.4) 1;
  }
`;
const Decor = styled.img<{ $flutter?: boolean }>`
  position: absolute;
  z-index: 5;
  display: block;
  scale: var(--flip) 1;
  image-rendering: pixelated;
  pointer-events: none;
  ${({ $flutter }) =>
    $flutter &&
    css`
      animation:
        ${flutterIn} var(--flutter-for) steps(20) var(--flutter-delay) both,
        ${beat} 0.2s steps(1) var(--flutter-delay) var(--beats);
    `}
`;
const TopEdge = styled.div`
  position: absolute;
  z-index: 2;
  image-rendering: pixelated;
  pointer-events: none;
`;

// inside the frame's bottom corners, where the default flower sits (left set per corner)
const CornerArt = styled.div`
  position: absolute;
  z-index: 1;
  pointer-events: none;
`;

// the name inside a skin's picture, centred where the header's name is (`at`, in px inside the
// cloud): its back, then the name
const NameIn = ({
  skin,
  name,
  at,
}: {
  skin: NonNullable<NpcSkin['nameIn']>;
  name: string;
  at: { x: number; y: number; w: number };
}) => {
  // two screen pixels per sprite pixel by default, like the skins' other sprites
  const px = (n: number) => `calc(${n} * ${u((skin.cell ?? 2) / 4)})`;
  const sprite = ({ src, width, height }: { src: string; width: number; height: number }) => (
    <img
      src={src}
      alt=''
      draggable={false}
      style={{
        display: 'block',
        width: px(width),
        height: px(height),
        imageRendering: 'pixelated',
      }}
    />
  );
  return (
    <NameInBox
      $print={skin.print}
      style={{
        left: `calc(${at.x + at.w / 2}px - ${px(skin.back.width)} / 2)`,
        top: `calc(${at.y}px - ${px(skin.textRow + (skin.lift ?? 0))})`,
      }}
    >
      {sprite(skin.back)}
      <NameInText
        style={{
          top: px(skin.textRow),
          ...(skin.textSize && { fontSize: skin.textSize }),
        }}
      >
        {name}
      </NameInText>
    </NameInBox>
  );
};

// a receipt printing: it rises out of the frame, the part still inside hidden, so its bottom
// edge stays where the frame cuts it
const printUp = keyframes`
  from {
    transform: translateY(${u(7.5)});
    clip-path: inset(0 0 ${u(7.5)} 0);
  }
  to {
    transform: none;
    clip-path: inset(0);
  }
`;

const NameInBox = styled.div<{ $print?: boolean }>`
  position: absolute;
  z-index: 4;
  pointer-events: none;
  ${({ $print }) =>
    $print &&
    css`
      animation: ${printUp} 0.9s ease-out 0.15s both;
    `}
`;

// the header name's look, centred in the picture, with a soft shadow down and to the right
const NameInText = styled.span`
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  font-size: 1.9556cqh;
  letter-spacing: 0.2133cqh;
  white-space: nowrap;
  color: var(--npc-name);
  text-shadow:
    0.0889cqh 0 0 currentColor,
    0.1067cqh 0.1067cqh 0 rgba(0, 0, 0, 0.45);
`;

const OnTop = styled.img`
  position: absolute;
  z-index: 3;
  /* centred on where the second outline's strip begins, 60% in from the right */
  left: 40%;
  transform: translateX(-50%);
  bottom: calc(100% - ${u(0.5)});
  display: block;
  image-rendering: pixelated;
  pointer-events: none;
`;

const VineSvg = styled.svg`
  position: absolute;
  z-index: 1; /* over the frame, under the icons above */
  display: block;
  pointer-events: none;
`;

const Body = styled.div<{ $shake: boolean; $dimmed?: boolean }>`
  display: flex;
  flex-flow: column nowrap;
  gap: ${u(2.5)};
  /* the line starts close under the header: its letters' tops a little below the back / next
  buttons (the line's own leading takes up the rest) */
  margin-top: calc(var(--npc-text-drop, 0px) - ${u(0.5)}); /* a skin may drop them lower */
  padding: 0 ${u(6)} ${u(5)};
  transition:
    opacity 0.15s ease,
    filter 0.15s ease;
  ${({ $dimmed }) => $dimmed && 'opacity: 0.35; filter: grayscale(1); pointer-events: none;'}
  ${({ $shake }) =>
    $shake &&
    css`
      animation: ${shake} 0.35s ease-in-out 0.1s;
    `}
`;

const Text = styled.div<{
  color?: string;
  $clickable?: boolean;
}>`
  color: ${PANEL.text};
  position: relative;
  text-align: left;
  width: 100%;
  font-size: 1.6889cqh;
  line-height: 3.0222cqh;
  /* never shorter than three lines (like alaina's first one), so a short line doesn't leave a
  squat little cloud */
  min-height: calc(3 * 3.0222cqh);
  white-space: pre-line;
  word-wrap: break-word;
  overflow-wrap: anywhere;
  cursor: ${({ $clickable }) => ($clickable ? 'pointer' : 'auto')};
  /* the page's global '* { color: #333 }' would paint every typed letter dark: they take the
  panel's text colour instead (a dark skin needs light text) */
  & * {
    color: inherit;
  }
  /* the typewriter's block container flows inline with the rest of the text */
  & > div {
    display: inline;
  }
`;

const ParallelColumns = styled.div`
  width: 100%;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 3.5556cqh;
  align-items: stretch;
`;

const ActionRow = styled.div`
  display: flex;
  justify-content: center;
`;

/////////////////
// HEADER

// every control in the header shares one height and outline, so the band reads as designed
const CONTROL_HEIGHT = u(7); // 28px
const ICON_BUTTON = u(10); // 40px: holds a native-size 32px icon with 4px around it
const HEAD_HEIGHT = u(13); // room for the name, a little taller than a row of controls
const RADIUS = '0.8cqh'; // rounded like the game's other buttons
const controlFrame = css`
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

// a second outline just outside the frame, along the top and down past the tabs, the strip between
// filled with a deep shade of the npc's colour so tabs, strip and cloud read as one piece. it sits
// under the cloud (z -1); $tabs = how many tabs hang down the side
const SECOND_GAP = u(1.5); // the strip's width
const SECOND_OUT = `(${SECOND_GAP} + ${B})`; // from the frame's edge to the line's outer edge
const SecondLine = styled.div<{ $tabs: number; $wide?: boolean }>`
  position: absolute;
  z-index: -1;
  right: calc(-1 * ${SECOND_OUT});
  top: calc(-1 * ${SECOND_OUT});
  /* along 60% of the cloud's top; further when the ritual's tab stands on it too */
  width: calc(${SECOND_OUT} + ${({ $wide }) => ($wide ? 85 : 60)}%);
  height: calc(
    ${SECOND_OUT} + 2 * ${B} + ${u(2)} + ${({ $tabs }) => $tabs} * (${ICON_BUTTON} + 2 * ${B}) -
      ${({ $tabs }) => $tabs - 1} * ${B} + ${u(2)}
  );
  /* a full outline: its left and bottom sides run under the cloud, so only their ends show, as
  the strip's closed, rounded ends */
  border: solid ${PANEL.line} ${B};
  border-radius: 0.8889cqh 1.4222cqh 0.8889cqh 0.8889cqh;
  /* the npc's colour, deepened, nearly solid */
  /* a skin may give it its own colour (mina's butter yellow) */
  background: var(--npc-second, color-mix(in srgb, ${accentMix(70, 'black')} 85%, transparent));
  pointer-events: none;
`;

// her quest tabs: round the corner, stacked down the cloud's right side, standing on
// the second outline
const TopBar = styled.div`
  position: absolute;
  z-index: 3;
  left: calc(100% + ${SECOND_OUT});
  top: calc(2 * ${B} + ${u(2)});
  display: flex;
`;

const Head = styled.div<{ $accent: string }>`
  display: flex;
  align-items: center;
  height: calc(${HEAD_HEIGHT} + ${B});
  padding: ${u(1)} ${u(3)} 0 ${u(5)};
`;

const HeadRow = styled.div`
  flex: 1;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: ${u(2)};
  min-height: ${CONTROL_HEIGHT};
`;

// the name, like a chapter heading: in a dark shade of the npc's colour, between two pixel curls
// that turn towards it, at the left end of the header row
const Name = styled.div<{ $accent: string; $curls?: boolean }>`
  margin-right: auto;
  display: flex;
  align-items: center;
  gap: ${u(2.5)};
  /* an opening: the curls unfurl, each drawing itself out in pixel steps from the name outwards */
  ${({ $curls }) =>
    $curls &&
    css`
      & > svg:first-child {
        animation: ${unfurlLeft} 0.5s steps(5) 0.15s both;
      }
      & > svg:last-child {
        animation: ${unfurlRight} 0.5s steps(5) 0.15s both;
      }
    `}
  font-size: 1.9556cqh;
  letter-spacing: 0.2133cqh;
  white-space: nowrap;
  /* moss: the npc's colour pushed towards an olive moss green, never towards black. set on
  the text itself, from the colour value, so nothing it sits in can turn it dark */
  span {
    color: var(--npc-name, color-mix(in srgb, ${({ $accent }) => $accent} 40%, #5a7526));
    /* a little bold: the pixel font has no bold face, so a copy a hair over thickens it */
    text-shadow: 0.0889cqh 0 0 currentColor;
  }
  /* a skin's name plate: a small stepped rectangle behind the name, just bigger than it (the
  name's own span is the one without a style: not the spacer, nor a name hidden under a picture) */
  span:not([style]) {
    background: var(--npc-name-plate, none);
    clip-path: var(--npc-name-plate-shape, none);
    padding: var(--npc-name-plate-pad, 0);
    box-shadow: var(--npc-name-plate-line, none);
  }
`;

// a curl: a pen stroke that opens towards the name and hooks back on itself at both ends, in
// pixels of one outline width, with a pale pixel in each hook. flipped, it closes the other side
const CURL = [
  [0, 0],
  [1, 0],
  [2, 0],
  [3, -1],
  [4, -2],
  [4, -3],
  [3, -4],
  [2, -4],
  [1, -3],
  [3, 1],
  [4, 2],
  [4, 3],
  [3, 4],
  [2, 4],
  [1, 3],
];
const CURL_PALE = [
  [2, -3],
  [3, -3],
  [2, 3],
  [3, 3],
];
const Curl = ({ flip = false }: { flip?: boolean }) => (
  <svg
    viewBox='0 -4 5 9'
    shapeRendering='crispEdges'
    style={{ width: `calc(5 * ${B})`, height: `calc(9 * ${B})`, display: 'block' }}
  >
    {CURL.map(([x, y]) => (
      <rect
        key={`${x},${y}`}
        x={flip ? 4 - x : x}
        y={y}
        width={1.02}
        height={1.02}
        fill={VINE_DARK}
      />
    ))}
    {CURL_PALE.map(([x, y]) => (
      <rect
        key={`${x},${y}`}
        x={flip ? 4 - x : x}
        y={y}
        width={1.02}
        height={1.02}
        fill='#f6e2e8'
      />
    ))}
  </svg>
);

const NavSeg = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: ${u(1.5)};
`;

const NavButton = styled.button<{ $accent: string }>`
  ${controlFrame}
  display: flex;
  align-items: center;
  justify-content: center;
  width: ${CONTROL_HEIGHT};
  padding: 0;
  /* the arrow is drawn in currentColor: the button's text colour, not the page's global #333
  (which would otherwise land on each of its pixels) */
  svg,
  svg * {
    color: inherit;
  }
  &:disabled {
    cursor: default;
    svg {
      opacity: 0.3;
    }
  }
`;

// tabs standing on the second outline down the cloud's right side: the panel's cream, a plum
// outline on three sides and rounded only on the outer side; the outline is their fourth side
const tab = css`
  width: calc(${ICON_BUTTON} + ${B});
  /* tall enough that the 32px icon has room inside the top and bottom outlines */
  height: calc(${ICON_BUTTON} + 2 * ${B});
  padding: 0 0 0 ${B};
  border: solid ${PANEL.line} ${B};
  border-left: none;
  border-radius: 0 1.0667cqh 1.0667cqh 0;
  background: ${PANEL.fill};
`;

// the ritual's tab: pinned over the cloud's top edge at the top right, a little in from the close
// badge, its lower part over the cloud like a label pinned to it
const HeadExit = styled.div`
  position: absolute;
  z-index: 5;
  right: ${u(4.5)};
  bottom: calc(100% + ${SECOND_OUT} - ${u(6.5)});
  display: flex;
  align-items: flex-end;
`;

// the close badge: its middle a little in from the frame's top-right corner, so it sits half over
// the corner and half outside the cloud
const CornerClose = styled.div`
  position: absolute;
  z-index: 6;
  top: calc(-1 * ${u(4.5)});
  right: calc(-1 * ${u(3.75)});
  button {
    width: ${u(9)};
    height: ${u(9)};
    padding: 0;
    border: solid ${PANEL.line} ${B};
    border-radius: ${u(1.5)};
    background: ${PANEL.fill};
    color: var(--npc-exit, ${PANEL.line}); /* a dark skin brings a light X */
    font-size: 1.6cqh;
    /* a slightly heavier X: the pixel font has no bold, so a copy a hair over thickens it */
    text-shadow: 0.0533cqh 0 0 currentColor;
    &:hover {
      background-color: ${PANEL.row};
    }
    &:active {
      background-color: ${PANEL.rowLine};
    }
  }
`;

// the ritual's tab slides up from behind the outline after the cloud opens: moved down and clipped
// by as much at its bottom, so only what has risen past the line shows. the clip reaches past its
// top and sides, so the medal standing out over them stays whole
const riseUp = keyframes`
  from {
    transform: translateY(100%);
    clip-path: inset(-100% -30% 100% -30%);
    opacity: 0;
  }
  40% {
    opacity: 1;
  }
  99.9% {
    transform: translateY(0);
    clip-path: inset(-100% -30% 0 -30%);
  }
  /* once it's up nothing clips it, so the pixels bursting from its medal fly over the cloud */
  to {
    transform: translateY(0);
    clip-path: inset(-500% -500% -500% -500%);
  }
`;

// the npc's ritual (shop, sacrifice, adoption...): a label in the npc's own cloud look, its border
// pattern inside the edge and ornaments round the name, pinned over the cloud's top edge beside
// the close. a skin may add a plaque line
const RitualTab = styled.div<{ $plaque?: string }>`
  position: relative;
  isolation: isolate; /* the corner patch sits over the panel, under the icon and name */
  animation: ${riseUp} 0.6s cubic-bezier(0.22, 1, 0.36, 1) both; /* delay: after the opening */
  display: flex;
  align-items: center;
  gap: ${u(1.5)};
  /* the 32px icon with even room above and below; the second outline is its bottom edge */
  height: calc(2.9636cqh + 2 * ${u(1.5)} + ${B});
  margin-right: ${u(1.5)};
  padding: 0 ${u(3)} 0 ${u(2)};
  border: solid ${PANEL.line} ${B};
  border-radius: 1.0667cqh;
  background: ${PANEL.fill};
  ${({ $plaque }) =>
    $plaque &&
    css`
      box-shadow:
        inset 0 0 0 0.2844cqh ${PANEL.fill},
        inset 0 0 0 0.4622cqh ${$plaque};
    `}
  white-space: nowrap;
  cursor: pointer;
  transition: background 0.12s ease;
  &:hover {
    background: ${PANEL.row};
  }
  /* the cloud's border pattern (the default cloud's running stitch; none for a skin without one),
  just inside all four sides, round the whole tab like the cloud's own */
  &::after {
    content: '';
    position: absolute;
    z-index: -1; /* under the medal, which stands over the tab's edge */
    inset: ${u(1)};
    border-radius: 0.7111cqh;
    pointer-events: none;
    /* a tab with its own colours sews its stitch at full strength (RitualColours.stitch) */
    --stitch: var(--ritual-stitch, ${accentMix(60)});
    --across: repeating-linear-gradient(
      90deg,
      var(--stitch) 0 ${B},
      transparent ${B} calc(2 * ${B})
    );
    --down: repeating-linear-gradient(
      180deg,
      var(--stitch) 0 ${B},
      transparent ${B} calc(2 * ${B})
    );
    background: var(
      --npc-border,
      var(--across) top / 100% ${u(0.5)} no-repeat,
      var(--across) bottom / 100% ${u(0.5)} no-repeat,
      var(--down) left / ${u(0.5)} 100% no-repeat,
      var(--down) right / ${u(0.5)} 100% no-repeat
    );
  }
`;

// a skin's bracket on the ritual tab (see its ritual.brackets), under the medal where they meet
const RitualBracket = styled.span`
  position: absolute;
  z-index: -1;
  pointer-events: none;
`;

// the ritual's icon on a round medal, a little bigger than the tab, standing on the outline and
// over the tab's top and left edges. inside its rim, the npc's own: the default stitch, a skin's
// band (zevana's gold-stitched leather) or its plaque line (dimidiatus)
const MEDAL = u(14); // 56px
// as the tab arrives its medal turns once like a coin (flat: it only narrows, it never tilts) and
// a ring of pixels pops out of it at the same time and fades
const COIN_TURN = 0.7; // seconds a turn takes
const coinTurn = keyframes`
  0%, 100% { transform: none; }
  12% { transform: scaleX(0.55); }
  24% { transform: scaleX(0.12); }
  36% { transform: scaleX(0.55); }
  48% { transform: none; }
`;
const BURST = 8;
const burst = keyframes`
  from {
    opacity: 1;
    transform: rotate(var(--angle)) translateX(calc(${MEDAL} * 0.55)) rotate(calc(-1 * var(--angle)));
  }
  70% {
    opacity: 1;
  }
  to {
    opacity: 0;
    transform: rotate(var(--angle)) translateX(calc(${MEDAL} * 1.2)) rotate(calc(-1 * var(--angle)));
  }
`;
// over the medal (where its flex margins put it), so the pixels don't narrow as it turns
const BurstAt = styled.span`
  position: absolute;
  z-index: 3;
  left: calc(-1 * ${u(1)});
  bottom: 0;
  width: ${MEDAL};
  height: ${MEDAL};
  pointer-events: none;
`;
const BurstBit = styled.span`
  position: absolute;
  left: calc(50% - ${u(0.75)});
  top: calc(50% - ${u(0.75)});
  width: ${u(1.5)};
  height: ${u(1.5)};
  opacity: 0;
  pointer-events: none;
  animation: ${burst} 0.7s steps(6) var(--ritual-arrived);
`;
const RitualMedal = styled.span<{
  $ring?: string;
  $ringWidth: string;
  $plaque?: string;
  $stitch?: string;
}>`
  position: relative;
  flex-shrink: 0;
  align-self: flex-end;
  display: flex;
  align-items: center;
  justify-content: center;
  width: ${MEDAL};
  height: ${MEDAL};
  /* its bottom on the outline (the tab's padding is the line's width), its middle where the icon was */
  margin: 0 0 calc(-1 * ${B}) calc(-1 * ${u(3)});
  animation: ${coinTurn} ${COIN_TURN}s steps(1) var(--ritual-arrived) both;
  border: solid ${PANEL.line} ${B};
  border-radius: 50%;
  background: ${PANEL.fill};
  /* a band just inside the rim (a skin's ring), or a thin plaque line a little way in */
  ${({ $ring, $plaque }) =>
    ($ring || $plaque) &&
    css`
      box-shadow: ${$ring
        ? `inset 0 0 0 ${u(1.5)} ${$ring}`
        : `inset 0 0 0 ${u(0.75)} ${PANEL.fill}, inset 0 0 0 ${u(1.25)} ${$plaque}`};
    `}
  /* a running stitch round it, along the middle of the band */
  ${({ $stitch, $ringWidth }) =>
    $stitch &&
    css`
      &::after {
        content: '';
        position: absolute;
        inset: calc(${$ringWidth} / 2 - ${u(0.25)});
        border-radius: 50%;
        pointer-events: none;
        background: repeating-conic-gradient(${$stitch} 0 8deg, transparent 8deg 16deg);
        mask: radial-gradient(
          closest-side,
          transparent calc(100% - ${u(0.5)}),
          #000 calc(100% - ${u(0.5)})
        );
      }
    `}
`;

// the ritual's name, in the npc's name colour, like a little title between its curls
const RitualName = styled.span`
  position: relative;
  font-size: 1.3333cqh;
  letter-spacing: 0.0889cqh;
  color: var(--npc-name, color-mix(in srgb, var(--accent) 40%, #5a7526));
  /* thickened by a copy a hair over (the pixel font has no bold); a tab may thicken it more */
  text-shadow: var(--ritual-name-thicken, 0.0533cqh) 0 0 currentColor;
`;

// the name's curls, two thirds the size
const SmallCurl = styled.span<{ $colour?: string }>`
  display: block;
  & > svg {
    width: calc(5 * ${u(0.5)}) !important;
    height: calc(9 * ${u(0.5)}) !important;
  }
  /* recoloured: the curl's line, not the pale pixels in its hooks */
  ${({ $colour }) =>
    $colour &&
    css`
      & rect:not([fill='#f6e2e8']) {
        fill: ${$colour};
      }
    `}
`;

// the quest tabs, touching: each after the first steps back one outline width, so
// neighbours share a single line
const TabGroup = styled.div`
  display: flex;
  flex-direction: column;
  & > * + * {
    margin-top: -${B};
  }
`;

// a solid dark shade of the npc's colour: these buttons sit over the room art, so a
// see-through tint would let it show through
const tint = (accent: string) => `color-mix(in srgb, ${accent} 25%, ${PANEL.control})`;

// quests: the quest scroll with a ! (available) or an hourglass (ongoing), with a count badge on
// the corner; the title says what each is on hover
const QuestIcon = styled.button<{ $accent: string; $active?: boolean }>`
  ${controlFrame}
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  ${tab}
  /* the npc's colour is in the icon itself (TintedIcon) */
  ${({ $accent, $active }) => $active && `background: ${tint($accent)};`}
  cursor: pointer;
  transition: background 0.12s ease;
  &:hover:not(:disabled) {
    background: ${({ $accent }) => tint($accent)};
  }
  /* no quests of that kind: the tab greys out instead of showing a 0 (the tab itself stays
  solid, so the frame's line under it stays covered) */
  &:disabled {
    cursor: default;
    background: ${PANEL.row};
    /* the tinted icon: the kept picture, or the blended one while it's made */
    & > img,
    & > span {
      filter: grayscale(1);
      opacity: 0.4;
    }
  }
`;

// 32px icons drawn at their native size in a 1080px room (2.963cqh): every 1px line
// stays one crisp pixel instead of being thinned and blurred by scaling
const QuestImg = styled.img`
  display: block;
  width: 2.9636cqh;
  height: 2.9636cqh;
  image-rendering: pixelated;
  image-rendering: -moz-crisp-edges;
  image-rendering: crisp-edges;
`;

// the icon in the npc's colour: its white fill takes the colour, its black line art stays black
// (white x colour = colour, black x colour = black). tinted once on a canvas per icon and colour,
// and kept: a picture costs nothing after, where a live blend mode had to be composited on every
// frame the cloud moved
const tints = new Map<string, string | Promise<string>>();
const tintIcon = (src: string, accent: string) => {
  const key = `${src}|${accent}`;
  const have = tints.get(key);
  if (have) return have;
  const tinting = new Promise<string>((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const g = canvas.getContext('2d');
      if (!g) return resolve(src);
      g.drawImage(img, 0, 0);
      g.globalCompositeOperation = 'multiply';
      g.fillStyle = accent;
      g.fillRect(0, 0, canvas.width, canvas.height);
      g.globalCompositeOperation = 'destination-in'; /* cut back to the icon's own shape */
      g.drawImage(img, 0, 0);
      const url = canvas.toDataURL();
      tints.set(key, url);
      resolve(url);
    };
    img.onerror = () => resolve(src);
    img.src = src;
  });
  tints.set(key, tinting);
  return tinting;
};
const useTintedIcon = (src: string, accent: string) => {
  const have = tints.get(`${src}|${accent}`);
  const [url, setUrl] = useState(typeof have === 'string' ? have : undefined);
  useEffect(() => {
    let live = true;
    Promise.resolve(tintIcon(src, accent)).then((tinted) => live && setUrl(tinted));
    return () => {
      live = false;
    };
  }, [src, accent]);
  return url;
};

// until the tint is ready (the first open only), the colour is painted under the icon, cut to
// its shape, and the icon multiplied over it
const IconTint = styled.span<{ $accent: string; $src: string }>`
  display: block;
  background: ${({ $accent }) => $accent};
  mask: url(${({ $src }) => $src}) center / 100% 100% no-repeat;
  & img {
    mix-blend-mode: multiply;
  }
`;

const TintedIcon = ({ src, alt, accent }: { src: string; alt: string; accent: string }) => {
  const tinted = useTintedIcon(src, accent);
  if (tinted) return <QuestImg src={tinted} alt={alt} />;
  return (
    <IconTint $accent={accent} $src={src}>
      <QuestImg src={src} alt={alt} />
    </IconTint>
  );
};

const QuestCount = styled.span<{ $accent: string; $empty: boolean }>`
  position: absolute;
  top: -${u(2)};
  right: -${u(2)};
  min-width: ${u(4.5)};
  padding: 0 ${u(0.75)};
  border: solid ${PANEL.line} ${u(0.5)};
  background: ${({ $accent, $empty }) => ($empty ? PANEL.control : $accent)};
  color: ${({ $empty }) => ($empty ? PANEL.dim : PANEL.light)};
  font-size: 0.9778cqh;
  line-height: 1.5111cqh;
  text-align: center;
`;

// drops down from the header's bottom edge over the line and choices, so opening it moves nothing
const QuestList = styled.div`
  position: absolute;
  top: calc(${B} + ${HEAD_HEIGHT} + ${B});
  left: ${B};
  right: ${B};
  z-index: 2;
  display: flex;
  flex-flow: column nowrap;
  gap: ${u(2)};
  padding: ${u(3)} ${u(4)} ${u(4)};
  max-height: 40vh;
  overflow-y: auto;
  background: ${PANEL.fill};
  border-bottom: solid ${accentMix(55, PANEL.line)} ${B};
`;

const QuestTitle = styled.div`
  font-size: 1.0667cqh;
  color: var(--ql-title, ${accentMix(70, 'black')}); /* a sign brings its own */
  letter-spacing: 0.0889cqh;
  text-transform: uppercase;
`;

// a skin's quest list under the cloud (its questList): it comes out from behind the frame's bottom
// edge, the part still inside hidden. under the frame (z -1 in the cloud's layer group), in from
// its sides, clear of a tag's cut end
const UNDER_DEEP = u(12); // how much further up under the frame a contract starts
const UnderSlot = styled.div<{ $tag?: boolean; $deep?: boolean }>`
  position: absolute;
  z-index: -1;
  /* a contract starts well up behind the frame, so it reads as coming out of the cloud itself */
  top: calc(100% - ${B} - ${({ $deep }) => ($deep ? UNDER_DEEP : '0px')});
  left: ${({ $tag }) => ($tag ? `calc(${TAG_CUT} * ${B} + ${u(2)})` : u(4.5))};
  right: ${u(4.5)};
  /* only its top is cut: what hasn't come out from under the frame yet stays hidden */
  clip-path: inset(0 -50% -200% -50%);
  pointer-events: none;
`;

// a look's colours, as the css variables its styles read (--ql-row-line from rowLine)
const underVars = (look: QuestListLook) =>
  Object.fromEntries(
    Object.entries('colours' in look ? look.colours : {}).map(([key, colour]) => [
      `--ql-${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`,
      colour,
    ])
  ) as React.CSSProperties;

// a receipt's torn edge: pixel teeth six outline widths across, stepping two deep, run on past the
// right side (the cut ignores what lies outside the box)
const RECEIPT_TEETH = 40;
const tornEdge = (b: string) => {
  const at = (x: number, depth: number) => `calc(${x} * ${b}) calc(100% - ${depth} * ${b})`;
  const teeth = [...Array(RECEIPT_TEETH)].flatMap((_, k) => {
    const x = k * 6;
    return [
      at(x, 2),
      at(x + 1, 2),
      at(x + 1, 1),
      at(x + 2, 1),
      at(x + 2, 0),
      at(x + 4, 0),
      at(x + 4, 1),
      at(x + 5, 1),
      at(x + 5, 2),
    ];
  });
  return `polygon(0 0, ${teeth.join(', ')}, calc(${RECEIPT_TEETH * 6} * ${b}) 0)`;
};

// a running stitch of `colour` along the left, right and bottom sides of what it's drawn on
const stitchSides = (colour: string) => css`
  --across: repeating-linear-gradient(90deg, ${colour} 0 ${B}, transparent ${B} calc(2 * ${B}));
  --down: repeating-linear-gradient(180deg, ${colour} 0 ${B}, transparent ${B} calc(2 * ${B}));
  background:
    var(--across) bottom / 100% ${u(0.5)} no-repeat,
    var(--down) left / ${u(0.5)} 100% no-repeat,
    var(--down) right / ${u(0.5)} 100% no-repeat;
`;

const UNDER_OUT = 0.45; // seconds it takes to come out (or go back in)
const SIGN_DROP = u(5); // how far below the frame a sign hangs, on its ropes
const SIGN_PX = B; // a pixel of the sign's art: 3 screen pixels in a 1080px room, like the name sign
// a contract's gold rod
const ROD = `calc(4 * ${B})`; // its height, outline and all
const ROD_OVER = u(3); // how far a rod reaches past the paper's sides

// a sign swings to rest once it has dropped
const swing = keyframes`
  0% { rotate: -4deg; }
  25% { rotate: 3deg; }
  50% { rotate: -1.5deg; }
  75% { rotate: 0.75deg; }
  100% { rotate: 0deg; }
`;

// coming out: an animation, not a transition, so it also plays the first time, when the list
// mounts already open (a transition would have nothing to start from)
const comeOut = keyframes`
  from {
    transform: translateY(var(--under-from));
  }
  to {
    transform: none;
  }
`;

// the browser's scrollbar, gutter and all, hidden: a list draws its own (ScrollBar)
const hideScrollbar = css`
  scrollbar-width: none;
  &::-webkit-scrollbar {
    display: none;
  }
`;

// a list's own scrollbar: a thin bar in the npc's colour (--ql-scroll) down the right of the box
// its scroller fills, no track behind it, shown only when there's more to scroll to. `watch`
// re-measures when the list changes
const ScrollBar = ({ target, watch }: { target: RefObject<HTMLDivElement>; watch?: unknown }) => {
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
const ScrollThumb = styled.span`
  position: absolute;
  z-index: 4;
  right: var(--ql-scroll-right, ${u(1.25)});
  width: ${u(1.5)};
  background: var(--ql-scroll);
  /* a list can outline it, to stand out on busy art */
  box-shadow: 0 0 0 var(--ql-scroll-outline, 0) var(--ql-line, transparent);
  pointer-events: none;
`;

// a cabinet of bottles (questList 'bottles'), drawn from the shelf in her room: its top board and
// its shadow under it, its title, then one shelf of four small bottles in view at a time (so the
// tags hanging below them, out past the cabinet, never meet the next row's), the wheel stepping a
// whole shelf at a time. each
// bottle stands on its shelf's board, held up by a bracket at either end, and its tag hangs from
// its neck on a string
const BOTTLE_PLACES = 4;
const BOTTLE_PLACES_NARROW = 2; // on a screen the cloud had to shrink for (a phone): wider tags
// a pixel of the cabinet's art: the room's own pixel (its art is 128 across the room's height), so
// the cabinet is as chunky as the shelf in her room
const SHELF_PX = 'calc(100cqh / 128)';
const px = (n: number) => `calc(${n} * ${SHELF_PX})`;
const BOARD_TOP = u(13.75); // where a shelf's board runs, just under its bottles' feet
const SHELF_ROW = BOARD_TOP; // the shelf ends at the bottles' feet: they stand on the base board
const BottleBox = ({
  look,
  places,
  title,
  quests,
  onPick,
}: {
  look: Extract<QuestListLook, { look: 'bottles' }>;
  places: number; // bottles per shelf
  title: string;
  quests: Quest[];
  onPick: (quest: Quest) => void;
}) => {
  const shelf = look.shelf;
  const rows = [...Array(Math.max(1, Math.ceil(quests.length / places)))].map((_, r) =>
    quests.slice(r * places, (r + 1) * places)
  );
  // one shelf in view, its tags free to hang out below the cabinet: the wheel steps from shelf to
  // shelf (a native scroll would clip them), a short rest between steps so one flick is one shelf
  const [shown, setShown] = useState(0);
  const row = Math.min(shown, rows.length - 1);
  const lastStep = useRef(0);
  const step = (by: number) => {
    const next = Math.max(0, Math.min(rows.length - 1, row + by));
    if (next === row) return;
    playClick();
    setShown(next);
  };
  const onWheel = (e: React.WheelEvent) => {
    if (rows.length < 2 || Math.abs(e.deltaY) < 4) return;
    const now = performance.now();
    if (now - lastStep.current < SHELF_STEP_REST) return;
    lastStep.current = now;
    step(Math.sign(e.deltaY));
  };
  // the bar on the right post can be dragged (or the post clicked) to the shelf wanted: by finger
  // too, so the later shelves are reachable without a wheel
  const rowRef = useRef(row);
  rowRef.current = row;
  const trackRef = useRef<HTMLSpanElement>(null);
  const dragTo = (e: React.PointerEvent) => {
    const el = trackRef.current;
    if (!el) return;
    const { top, height } = el.getBoundingClientRect();
    const next = Math.max(
      0,
      Math.min(rows.length - 1, Math.floor(((e.clientY - top) / height) * rows.length))
    );
    if (next === rowRef.current) return;
    rowRef.current = next;
    playClick();
    setShown(next);
  };
  // the shelf itself drags too: a swipe up or down on the bottles or their tags (a finger, on a
  // phone) steps a shelf each SHELF_SWIPE of travel, in the way the bottles move. a swipe that
  // ends on a tag isn't a tap on it
  const swipe = useRef<{ y: number; moved: boolean }>();
  const onSwipeStart = (e: React.PointerEvent) => {
    if (rows.length < 2 || e.button !== 0) return;
    swipe.current = { y: e.clientY, moved: false };
  };
  const onSwipeMove = (e: React.PointerEvent) => {
    const drag = swipe.current;
    if (!drag || !e.buttons) return;
    const dy = e.clientY - drag.y;
    if (Math.abs(dy) < SHELF_SWIPE) return;
    drag.y = e.clientY;
    drag.moved = true;
    step(dy < 0 ? 1 : -1);
  };
  const onSwipeEnd = () => {
    const drag = swipe.current;
    if (drag?.moved) setTimeout(() => (swipe.current = undefined), 0); /* after the click */
    else swipe.current = undefined;
  };
  const onSwipeClick = (e: React.MouseEvent) => {
    if (!swipe.current?.moved) return;
    e.preventDefault();
    e.stopPropagation();
  };
  // the arrow keys step too (not while a field has focus)
  const stepRef = useRef(step);
  stepRef.current = step;
  useEffect(() => {
    if (rows.length < 2) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
      const el = document.activeElement as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el?.isContentEditable)
        return;
      e.preventDefault();
      stepRef.current(e.key === 'ArrowUp' ? -1 : 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [rows.length]);
  // each piece's art as --shelf-<piece> (--shelf-base-end from baseEnd), built once per look
  const art = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(shelf).map(([key, sprite]) => [
          `--shelf-${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`,
          `url(${sprite.src})`,
        ])
      ) as React.CSSProperties,
    [shelf]
  );
  return (
    <BoxFrame style={art}>
      <BoxBack>
        <BoxTop />
        <BoxTitle>
          <span>{title}</span>
        </BoxTitle>
        <ShelfView
          onWheel={onWheel}
          onPointerDown={onSwipeStart}
          onPointerMove={onSwipeMove}
          onPointerUp={onSwipeEnd}
          onPointerCancel={onSwipeEnd}
          onClickCapture={onSwipeClick}
        >
          <ShelfRow key={row}>
            <Shelf style={{ '--places': places } as React.CSSProperties}>
              {rows[row].map((quest, k) => {
                const i = row * places + k;
                return (
                  <BottlePlace key={i} style={{ '--i': k } as React.CSSProperties}>
                    <Bottle>
                      <img
                        src={look.bottles[quest.index % look.bottles.length].src}
                        alt=''
                        draggable={false}
                      />
                    </Bottle>
                    <TagString />
                    <BottleTag type='button' onClick={() => onPick(quest)}>
                      {quest.name}
                      <small>no. {i + 1}</small>
                    </BottleTag>
                  </BottlePlace>
                );
              })}
            </Shelf>
          </ShelfRow>
        </ShelfView>
        {/* more shelves: the wheel and the arrow keys step between them, and the bar on the
        right post, showing which is out, can be dragged (or the post clicked) to one */}
        {rows.length > 1 && (
          <ShelfTrack
            ref={trackRef}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              dragTo(e);
            }}
            onPointerMove={(e) => {
              if (e.buttons) dragTo(e);
            }}
          >
            <ScrollThumb
              style={{ top: `${(row / rows.length) * 100}%`, height: `${100 / rows.length}%` }}
            />
          </ShelfTrack>
        )}
      </BoxBack>
      <BoxBase />
      <BoxFeet />
    </BoxFrame>
  );
};

const BoxFrame = styled.div`
  image-rendering: pixelated;
  /* its scrollbar: cream, outlined, down the right post */
  --ql-scroll: var(--ql-paper);
  --ql-scroll-outline: ${u(0.5)};
  --ql-scroll-right: ${u(1.25)};
`;
// the right post as the bar's track: the whole post takes the press, for an easy grab
const ShelfTrack = styled.span`
  position: absolute;
  z-index: 4;
  top: 0;
  right: 0;
  bottom: 0;
  width: ${px(5)};
  cursor: pointer;
  touch-action: none;
`;
// the cabinet's inside, a wooden post down either side
const BoxBack = styled.div`
  position: relative;
  background: var(--shelf-wall) left top / ${px(21)} ${px(10)} repeat;
  &::before,
  &::after {
    content: '';
    position: absolute;
    z-index: 2;
    top: 0;
    bottom: 0;
    width: ${px(5)};
    background: var(--shelf-post) left top / 100% ${px(8)} repeat-y;
    pointer-events: none;
  }
  &::before {
    left: 0;
  }
  &::after {
    right: 0;
    scale: -1 1;
  }
`;
// the base board it stands on, reaching past the posts, its ends stepped
const BoxBase = styled.div`
  position: relative;
  height: ${px(5)};
  margin: 0 calc(-1 * ${px(1)});
  padding: 0 ${px(3)};
  background: var(--shelf-base) left top / ${px(24)} 100% repeat-x content-box;
  &::before,
  &::after {
    content: '';
    position: absolute;
    top: 0;
    width: ${px(3)};
    height: 100%;
    background: var(--shelf-base-end) center / 100% 100%;
  }
  &::before {
    left: 0;
  }
  &::after {
    right: 0;
    scale: -1 1;
  }
`;
// a foot under each post, the scalloped apron hanging between them
const BoxFeet = styled.div`
  position: relative;
  height: ${px(5)};
  padding: 0 ${px(5)};
  background: var(--shelf-apron) left top / ${px(9)} ${px(4)} round no-repeat content-box;
  &::before,
  &::after {
    content: '';
    position: absolute;
    top: 0;
    width: ${px(5)};
    height: 100%;
    background: var(--shelf-foot) center / 100% 100%;
  }
  &::before {
    left: 0;
  }
  &::after {
    right: 0;
    scale: -1 1;
  }
`;
// the cabinet's top board, its shadow under it
const BoxTop = styled.div`
  height: ${px(5)};
  background: var(--shelf-top) left top / ${px(24)} 100% repeat-x;
  image-rendering: pixelated;
`;
// the title on a cream plaque nailed to the middle of the top board, outlined, its corners
// stepped like the frame's, a nail at either end
const BoxTitle = styled.div`
  position: absolute;
  z-index: 3;
  left: 50%;
  top: calc(${px(5)} / 2);
  translate: -50% -50%;
  padding: ${B};
  background: var(--ql-line);
  clip-path: ${stepped(B)};
  white-space: nowrap;
  & span {
    display: block;
    position: relative;
    padding: ${u(1.5)} ${u(6.5)};
    background: var(--ql-paper);
    clip-path: ${stepped(B)};
    font-size: 1.0667cqh;
    letter-spacing: 0.0889cqh;
    text-transform: uppercase;
    color: var(--ql-line);
  }
  & span::before,
  & span::after {
    content: '';
    position: absolute;
    top: calc(50% - ${B} / 2);
    width: ${B};
    height: ${B};
    background: var(--ql-line);
  }
  & span::before {
    left: ${u(2.5)};
  }
  & span::after {
    right: ${u(2.5)};
  }
`;
const SHELF_STEP_REST = 250; // ms between one wheel step and the next
const SHELF_SWIPE = 28; // screen pixels of drag that move one shelf
// the one shelf in view (its scrollbar runs the whole height of the cabinet's right post)
const ShelfView = styled.div`
  position: relative;
  touch-action: none; /* a finger's drag steps the shelves, never scrolls the page */
`;
// one shelf: its bottles, standing on the base board below it (their tags hang on past it)
const ShelfRow = styled.div`
  position: relative;
  height: ${SHELF_ROW};
`;
const Shelf = styled.div`
  display: grid;
  grid-template-columns: repeat(var(--places), 1fr);
  column-gap: ${u(3)};
  padding: 0 calc(${px(5)} + ${u(2)}); /* clear of the posts */
`;
const BottlePlace = styled.div`
  position: relative;
  display: grid;
  justify-items: center;
  padding-top: ${u(2.25)};
`;
// a potion drawn at 2 screen pixels per pixel (in a 1080px room), standing on the board
const Bottle = styled.span`
  position: relative;
  z-index: 1;
  & img {
    display: block;
    width: ${u(13)}; /* its 26px picture at 2 screen pixels per pixel */
    height: ${u(13)};
    image-rendering: pixelated;
  }
`;
const TagString = styled.span`
  position: absolute;
  z-index: 3;
  top: ${u(5.25)}; /* from the potion's neck */
  left: calc(50% - ${u(0.25)});
  width: ${u(0.5)};
  height: ${u(15.75)};
  background: var(--ql-string);
  pointer-events: none;
`;
// a paper tag with its corners cut and a hole for the string
const BottleTag = styled.button`
  position: absolute;
  z-index: 3;
  top: ${u(21)};
  left: calc(-1 * ${u(0.75)});
  right: calc(-1 * ${u(0.75)});
  transform-origin: 50% calc(-1 * ${u(13.5)});
  min-height: ${u(17.25)};
  padding: ${u(4.125)} ${u(1.125)} ${u(2.25)};
  font-size: 1.1111cqh;
  line-height: 1.5278cqh;
  text-align: center;
  color: ${PANEL.text};
  background: var(--ql-paper);
  border: solid ${PANEL.line} ${u(0.75)};
  border-radius: ${u(0.75)};
  clip-path: polygon(
    ${u(3.375)} 0,
    calc(100% - ${u(3.375)}) 0,
    100% ${u(3.375)},
    100% 100%,
    0 100%,
    0 ${u(3.375)}
  );
  /* wraps only between words, never inside one */
  overflow-wrap: normal;
  word-break: keep-all;
  hyphens: none;
  cursor: pointer;
  &::before {
    content: '';
    position: absolute;
    top: ${u(1.5)};
    left: calc(50% - ${u(1.125)});
    width: ${u(2.25)};
    height: ${u(2.25)};
    border-radius: 50%;
    background: ${PANEL.line};
  }
  & small {
    display: block;
    margin-top: ${u(1.125)};
    font-size: 0.8333cqh;
    color: var(--ql-number);
  }
  &:hover {
    background: color-mix(in srgb, var(--ql-paper) 60%, white);
  }
`;

// the bottles drop into the box one after another once it's out, and their tags swing to rest
const BOTTLE_STEP = 0.14; // seconds between one bottle and the next
const bottleDrop = keyframes`
  0% { translate: 0 calc(-1 * ${u(18)}); opacity: 0; }
  15% { opacity: 1; }
  70% { translate: 0 ${u(0.75)}; }
  85% { translate: 0 calc(-1 * ${u(0.5)}); }
  100% { translate: 0 0; opacity: 1; }
`;
const tagSwing = keyframes`
  0% { rotate: -9deg; }
  30% { rotate: 6deg; }
  55% { rotate: -3deg; }
  80% { rotate: 1.5deg; }
  100% { rotate: 0deg; }
`;
const bottlesIn = css`
  & ${Bottle}, & ${TagString} {
    animation: ${bottleDrop} 0.35s steps(6) both;
    animation-delay: calc(${UNDER_OUT}s + var(--i) * ${BOTTLE_STEP}s);
  }
  & ${BottleTag} {
    animation:
      ${bottleDrop} 0.35s steps(6) both,
      ${tagSwing} 0.8s steps(8) both;
    animation-delay:
      calc(${UNDER_OUT}s + var(--i) * ${BOTTLE_STEP}s),
      calc(${UNDER_OUT + 0.35}s + var(--i) * ${BOTTLE_STEP}s);
  }
`;

// a map's X (o outline, x mark) and compass rose (c rose, o its middle), and where the X sits on
// a quest's row
const MAP_X = ['oo...oo', 'oxo.oxo', '.oxoxo.', '..oxo..', '.oxoxo.', 'oxo.oxo', 'oo...oo'];
const MAP_COMPASS = [
  '....c....',
  '....c....',
  '...ccc...',
  '..c.c.c..',
  'ccccocccc',
  '..c.c.c..',
  '...ccc...',
  '....c....',
  '....c....',
];
const MAP_X_LEFT = u(2);
const MAP_X_TOP = u(1.25);
const MAP_GUTTER = u(9);

// once a map is out, its trail draws itself from stop to stop, each X landing as it's reached
const MAP_STEP = 0.27; // seconds from one stop to the next
const trailDraw = keyframes`
  from { clip-path: inset(0 0 100% 0); }
  to { clip-path: inset(0); }
`;
const xLand = keyframes`
  0% { scale: 1.8; opacity: 0; }
  100% { scale: 1; opacity: 1; }
`;
const mapIn = css`
  & button::after {
    animation: ${trailDraw} ${MAP_STEP}s steps(4) both;
    animation-delay: calc(${UNDER_OUT}s + var(--i) * ${MAP_STEP}s);
  }
  & button::before {
    animation: ${xLand} 0.25s steps(4) both;
    animation-delay: calc(${UNDER_OUT + 0.08}s + var(--i) * ${MAP_STEP}s);
  }
`;

const UnderSheet = styled.div<{ $look: QuestListLook['look']; $open: boolean }>`
  position: relative;
  /* tucked away under the frame (a sign also hides its ropes) */
  --under-from: ${({ $look }) =>
    $look === 'sign' ? `calc(-100% - ${SIGN_DROP} - ${B})` : '-100%'};
  transform: ${({ $open }) => ($open ? 'none' : 'translateY(var(--under-from))')};
  visibility: ${({ $open }) => ($open ? 'visible' : 'hidden')};
  pointer-events: ${({ $open }) => ($open ? 'auto' : 'none')};
  /* going back in slides; coming out plays comeOut (and a sign then swings to rest) */
  transition:
    transform ${UNDER_OUT}s steps(9),
    visibility 0s ${({ $open }) => ($open ? '0s' : `${UNDER_OUT}s`)};
  ${({ $open, $look }) => $open && $look === 'bottles' && bottlesIn}
  ${({ $open, $look }) => $open && $look === 'map' && mapIn}
  ${({ $open, $look }) =>
    $open &&
    ($look === 'sign'
      ? css`
          animation:
            ${comeOut} ${UNDER_OUT}s steps(9),
            ${swing} 0.9s steps(8) ${UNDER_OUT}s;
        `
      : css`
          animation: ${comeOut} ${UNDER_OUT}s steps(9);
        `)}

  /* a receipt: the outline round the paper, cut to its torn edge */
  ${({ $look }) =>
    $look === 'receipt' &&
    css`
      padding: 0 ${B} ${B};
      background: ${PANEL.line};
      clip-path: ${tornEdge(B)};
    `}

  /* a notice: its leather edge down the sides and along the bottom, outlined, and the roll it
  unrolls to, a little wider than it */
  ${({ $look }) =>
    $look === 'notice' &&
    css`
      padding: 0 calc(2 * ${B}) calc(2 * ${B});
      background: var(--ql-leather);
      border: solid ${PANEL.line} ${B};
      border-top: none;
      margin-bottom: ${u(2)};
      &::after {
        content: '';
        position: absolute;
        left: calc(-1 * ${u(3)});
        right: calc(-1 * ${u(3)});
        bottom: calc(-1 * ${u(2.5)});
        height: ${u(4)};
        background: var(--ql-leather);
        border: solid ${PANEL.line} ${B};
        border-radius: ${u(2)};
      }
    `}

  /* a contract: its rod hanging just below it, the seal off the rod */
  ${({ $look }) =>
    $look === 'contract' &&
    css`
      margin-bottom: calc(${SEAL} / 2);
    `}

  /* a map: outlined down its sides and along the bottom */
  ${({ $look }) =>
    $look === 'map' &&
    css`
      border: solid var(--ql-line) ${B};
      border-top: none;
    `}

  /* a sign: planks with a little grain between them, outlined, hung on two ropes from the frame */
  ${({ $look }) =>
    $look === 'sign' &&
    css`
      margin-top: ${SIGN_DROP};
      transform-origin: top center;
      /* the name sign's own planks, one under another, whole planks across */
      background: var(--ql-plank) left top / calc(46 * ${SIGN_PX}) calc(9 * ${SIGN_PX}) round repeat;
      image-rendering: pixelated;
      border: solid var(--ql-outline) ${SIGN_PX};
      border-radius: ${SIGN_PX};
      &::before,
      &::after {
        content: '';
        position: absolute;
        top: calc(-1 * (${SIGN_DROP} + ${B}));
        width: calc(2 * ${SIGN_PX});
        height: calc(${SIGN_DROP} + ${B});
        background: var(--ql-rope-art) left top / 100% calc(7 * ${SIGN_PX}) repeat-y;
        image-rendering: pixelated;
      }
      &::before {
        left: 18%;
      }
      &::after {
        right: 18%;
      }
    `}
`;

const UNDER_MAX = '26cqh';
const UNDER_ROWS = 5;

// the box the list scrolls in: a set height, so opening it never moves the cloud. the list
// inside keeps its own padding and backgrounds, which scroll with it as content (cheaper than
// a background fixed to the box and repainted on every scroll)
const UnderClip = styled.div`
  position: relative; /* over a notice's stitch */
  max-height: ${UNDER_MAX};
  overflow-y: auto;
  ${hideScrollbar}
`;
const UnderScroll = styled.div`
  display: flex;
  flex-flow: column nowrap;
  gap: ${u(2)};
  /* room at the bottom for a receipt's torn edge */
  padding: ${u(3)} ${u(4)} ${u(5)};
`;

// a contract's clause number, a little dimmer than its words
const Clause = styled.span`
  flex-shrink: 0;
  color: var(--ql-numeral);
`;

const toRoman = (n: number) =>
  [
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ].reduce(
    (out, [value, numeral]) => {
      while (out.n >= (value as number)) {
        out.s += numeral;
        out.n -= value as number;
      }
      return out;
    },
    { s: '', n }
  ).s;

// a contract's seal: a disc of wax just above its bottom rod, the npc's mark pressed into it. it stamps
// down once the contract is out, every time it opens
const stamp = keyframes`
  0% { scale: 2.2; opacity: 0; }
  60% { scale: 0.9; opacity: 1; }
  100% { scale: 1; opacity: 1; }
`;
const SEAL = u(15); // its 30px picture at two screen pixels per pixel, in a 1080px room
const Seal = styled.span<{ $open: boolean }>`
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
const ScrollRod = styled.span`
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

const UnderPaper = styled.div<{ $look: QuestListLook['look'] }>`
  position: relative;

  /* a receipt's paper, faintly ruled like a till roll */
  ${({ $look }) =>
    $look === 'receipt' &&
    css`
      background:
        repeating-linear-gradient(
          180deg,
          transparent 0 ${u(5.5)},
          color-mix(in srgb, ${PANEL.line} 6%, transparent) ${u(5.5)} ${u(5.75)}
        ),
        ${PANEL.fill};
      clip-path: ${tornEdge(B)};
      /* its title printed as a band across the receipt, in her red with cream letters, a dashed
      tear line under it */
      & ${QuestTitle} {
        margin: 0 calc(-1 * ${u(4)});
        padding: ${u(1.25)} ${u(4)};
        text-align: center;
        font-size: 1.4222cqh;
        letter-spacing: 0.2667cqh;
        color: ${PANEL.fill};
        background: var(--ql-title, ${accentMix(85, 'black')});
        border-bottom: dashed ${u(0.5)} ${PANEL.fill};
      }
    `}

  /* a notice's parchment, its stitch running just inside the leather */
  ${({ $look }) =>
    $look === 'notice' &&
    css`
      background: ${PANEL.fill};
      &::before {
        content: '';
        position: absolute;
        inset: 0 ${u(1)} ${u(1)};
        pointer-events: none;
        ${stitchSides('var(--ql-stitch)')}
      }
      /* its title lettered like a notice's heading: in her ink, a diamond either side, a
      double line ruled under it */
      & ${QuestTitle} {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: ${u(2.5)};
        padding-bottom: ${u(1.5)};
        font-size: 1.4222cqh;
        letter-spacing: 0.3556cqh;
        color: var(--ql-title, ${accentMix(90, 'black')});
        border-bottom: double ${u(1.25)} color-mix(in srgb, var(--ql-leather) 75%, transparent);
      }
      & ${QuestTitle}::before, & ${QuestTitle}::after {
        content: '';
        width: ${u(2)};
        height: ${u(2)};
        background: var(--ql-leather);
        rotate: 45deg;
      }
    `}

  /* a contract's black paper, gold down its sides and along the bottom with a fainter plaque line
  just inside, both running on up under the frame (no line across the top, so it reads as part of
  the cloud), its clauses lettered in gold */
  ${({ $look }) =>
    $look === 'contract' &&
    css`
      --ql-title: var(--ql-ink);
      background: var(--ql-paper);
      border: solid var(--ql-plaque) ${B};
      border-top: none;
      &::before {
        content: '';
        position: absolute;
        inset: 0 ${u(1)} ${u(1)};
        border: solid color-mix(in srgb, var(--ql-plaque) 55%, transparent) ${u(0.5)};
        border-top: none;
        pointer-events: none;
      }
      & ${UnderScroll} {
        padding-top: calc(${u(3)} + ${UNDER_DEEP}); /* clear of the frame it starts behind */
        padding-bottom: ${u(9)}; /* room for the seal */
      }
      /* its title in larger white letters, like the clause numbers, a gold rule running out
      either side */
      & ${QuestTitle} {
        display: flex;
        align-items: center;
        gap: ${u(3)};
        text-align: center;
        color: var(--ql-numeral);
        font-size: 1.4222cqh;
        letter-spacing: 0.2667cqh;
        white-space: nowrap;
      }
      & ${QuestTitle}::before, & ${QuestTitle}::after {
        content: '';
        flex: 1;
        height: ${u(0.5)};
        background: var(--ql-plaque);
      }
      & button {
        display: flex;
        align-items: baseline;
        gap: ${u(2.5)};
        background: transparent;
        border: none;
        border-radius: 0;
        color: var(--ql-ink);
      }
      & button:hover:not(:disabled) {
        background: color-mix(in srgb, var(--ql-ink) 14%, transparent);
      }
    `}

  /* a map's old paper, browned at its edge and stained, a compass rose in its corner; each quest a
  stop on the trail, its X on the trail and its name beside it */
  ${({ $look }) =>
    $look === 'map' &&
    css`
      --ql-title: var(--ql-ink);
      background:
        radial-gradient(
          circle at 82% 70%,
          color-mix(in srgb, var(--ql-edge) 30%, transparent) 0 ${u(6)},
          transparent ${u(6)}
        ),
        radial-gradient(
          circle at 12% 18%,
          color-mix(in srgb, var(--ql-edge) 22%, transparent) 0 ${u(4)},
          transparent ${u(4)}
        ),
        var(--ql-paper);
      box-shadow:
        inset 0 0 0 ${B} color-mix(in srgb, var(--ql-edge) 70%, transparent),
        inset 0 0 0 calc(2 * ${B}) color-mix(in srgb, var(--ql-edge) 35%, transparent);
      &::after {
        content: '';
        position: absolute;
        top: ${u(2)};
        right: ${u(2.5)};
        width: calc(9 * ${B});
        height: calc(9 * ${B});
        background: var(--ql-compass-art) center / 100% 100%;
        image-rendering: pixelated;
        pointer-events: none;
      }
      /* its title centred, in from the edges enough to clear the compass rose */
      & ${QuestTitle} {
        margin: 0 calc(9 * ${B} + ${u(2)});
        text-align: center;
        font-size: 1.4222cqh;
        letter-spacing: 0.2667cqh;
      }
      & button {
        position: relative;
        padding-left: ${MAP_GUTTER};
        background: transparent;
        border: none;
        border-radius: 0;
        color: var(--ql-ink);
      }
      & button:hover:not(:disabled) {
        background: color-mix(in srgb, var(--ql-edge) 30%, transparent);
        color: var(--ql-mark);
      }
      /* the X */
      & button::before {
        content: '';
        position: absolute;
        z-index: 1;
        left: ${MAP_X_LEFT};
        top: ${MAP_X_TOP};
        width: calc(7 * ${B});
        height: calc(7 * ${B});
        background: var(--ql-x-art) center / 100% 100%;
        image-rendering: pixelated;
      }
      /* the trail, from this stop on to the next: from the first X, up to the last */
      & button::after {
        content: '';
        position: absolute;
        left: calc(${MAP_X_LEFT} + 3 * ${B});
        width: ${B};
        top: 0;
        bottom: calc(-1 * ${u(2)});
        background: repeating-linear-gradient(
          180deg,
          var(--ql-trail) 0 calc(2 * ${B}),
          transparent calc(2 * ${B}) calc(4 * ${B})
        );
        pointer-events: none;
      }
      & button:first-of-type::after {
        top: calc(${MAP_X_TOP} + 3.5 * ${B});
      }
      & button:last-of-type::after {
        bottom: auto;
        height: calc(${MAP_X_TOP} + 3.5 * ${B});
      }
      & button:only-of-type::after {
        display: none;
      }
    `}

  /* a sign's quests on boards of their own colours */
  ${({ $look }) =>
    $look === 'sign' &&
    css`
      /* the title and each quest on a plank of its own, lined up with the planks' seams */
      & ${UnderScroll} {
        gap: 0;
        padding: 0 ${u(3)};
        /* the planks scroll with the quests on them, lined up under the title's taller plank */
        background: var(--ql-plank) left 0 top calc(12 * ${SIGN_PX}) / calc(46 * ${SIGN_PX})
          calc(9 * ${SIGN_PX}) round repeat;
        image-rendering: pixelated;
      }
      /* a whole plank at a time */
      & ${UnderClip} {
        scroll-snap-type: y mandatory;
        scroll-padding-top: calc(12 * ${SIGN_PX}); /* rows snap in under the title's plank */
      }
      & button {
        scroll-snap-align: start;
      }
      & ${QuestTitle}, & button {
        display: flex;
        align-items: center;
        height: calc(9 * ${SIGN_PX});
        padding: 0 ${u(2)} ${SIGN_PX};
        text-shadow: ${SIGN_PX} ${SIGN_PX} 0 var(--ql-outline);
      }
      /* the title on a plank of its own that stays put, a line of the outline under it */
      & ${QuestTitle} {
        position: sticky;
        top: 0;
        z-index: 1;
        height: calc(12 * ${SIGN_PX}); /* a taller plank: room above and below */
        background: var(--ql-title-plank) left top / calc(46 * ${SIGN_PX}) 100% round no-repeat;
        margin: 0 calc(-1 * ${u(3)});
        padding: 0 calc(${u(3)} + ${u(5)}) ${SIGN_PX};
        box-shadow: 0 ${SIGN_PX} 0 var(--ql-outline);
        justify-content: center;
        font-size: 1.4222cqh;
        letter-spacing: 0.1778cqh;
        /* outlined all round, so it reads on the wood */
        text-shadow:
          ${SIGN_PX} 0 0 var(--ql-outline),
          calc(-1 * ${SIGN_PX}) 0 0 var(--ql-outline),
          0 ${SIGN_PX} 0 var(--ql-outline),
          0 calc(-1 * ${SIGN_PX}) 0 var(--ql-outline),
          ${SIGN_PX} ${SIGN_PX} 0 var(--ql-outline);
      }
      & button {
        background: transparent;
        border: none;
        border-radius: 0;
        color: var(--ql-text);
      }
      & button:hover:not(:disabled) {
        background: color-mix(in srgb, var(--ql-hover) 70%, transparent);
        color: var(--ql-text);
      }
    `}
`;

/////////////////
// BUTTONS

// a quiet row on the panel: lights up in the npc's colour on hover, its label nudging over
const row = css`
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

// the choices sit together on a rounded tray, a shade deeper than the panel, so they read as
// one block: your side of the conversation
const Choices = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${u(1.5)} ${u(2)};
  padding: 0.8889cqh ${u(1.5)};
  /* wider than the line above it: it reaches out to just inside the stitch, so the buttons get
  the room */
  margin: 0 -${u(3.5)};
  background: ${PANEL.tray};
  border-radius: 1.4222cqh;
`;

const Choice = styled.button<{ $accent: string; $asked: boolean }>`
  ${row}
  display: flex;
  align-items: center;
  gap: ${u(2)};
  min-width: 0;
  padding: ${u(1.5)} ${u(2.5)};
  text-align: left;
  /* cream on the deeper tray, with a plum outline like the frame's: flat, no raised edge */
  background: ${PANEL.light};
  border: solid ${PANEL.line} ${u(0.5)};
  ${({ $asked }) => $asked && 'opacity: 0.5;'}
  /* the label takes the button's colour, not the page's global '* { color: #333 }' */
  & * {
    color: inherit;
  }
  /* 1-9 still pick a choice from the keyboard; the rows just don't show the numbers */
  & > span {
    transition: transform 0.1s steps(2);
  }
  /* hovered, it fills with the npc's colour, its text and mark turn cream, and it nudges over */
  &:hover:not(:disabled) {
    background: var(--npc-hover, var(--accent));
    border-color: ${accentMix(60, 'black')};
    color: var(--npc-hover-text, ${PANEL.light});
  }
  &:hover > span {
    transform: translateX(${u(0.5)});
  }
`;

// a small pixel diamond in the npc's colour before each choice; cream while it's hovered
const ChoiceMark = styled.i`
  flex-shrink: 0;
  width: ${u(1.5)};
  height: ${u(1.5)};
  background: var(--accent);
  clip-path: var(--npc-mark, polygon(50% 0, 100% 50%, 50% 100%, 0 50%));
  button:hover > & {
    background: var(--npc-hover-text, ${PANEL.light});
  }
`;

const QuestButton = styled.button<{ $accent: string }>`
  ${row}
  padding: ${u(1.5)} ${u(3)};
  text-align: left;
  white-space: normal; /* long quest names wrap; the list grows with them */
  overflow-wrap: anywhere;
`;

const LabelText = styled.span`
  color: inherit; /* the button's colour, not the page's global #333 */
  flex: 1;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-align: left;
`;

/////////////////
// QUESTS AND FOOTER
