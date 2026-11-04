import { CSSProperties } from 'react';

import potionBlue from 'assets/images/dialogue/alaina_potion_blue.png';
import potionGreen from 'assets/images/dialogue/alaina_potion_green.png';
import potionOrange from 'assets/images/dialogue/alaina_potion_orange.png';
import potionPink from 'assets/images/dialogue/alaina_potion_pink.png';
import potionPurple from 'assets/images/dialogue/alaina_potion_purple.png';
import potionRed from 'assets/images/dialogue/alaina_potion_red.png';
import potionTeal from 'assets/images/dialogue/alaina_potion_teal.png';
import potionYellow from 'assets/images/dialogue/alaina_potion_yellow.png';
import shelfApron from 'assets/images/dialogue/alaina_shelf_apron.png';
import shelfBase from 'assets/images/dialogue/alaina_shelf_base.png';
import shelfBaseEnd from 'assets/images/dialogue/alaina_shelf_base_end.png';
import shelfFoot from 'assets/images/dialogue/alaina_shelf_foot.png';
import shelfPost from 'assets/images/dialogue/alaina_shelf_post.png';
import shelfTop from 'assets/images/dialogue/alaina_shelf_top.png';
import shelfWall from 'assets/images/dialogue/alaina_shelf_wall.png';
import byakuya from 'assets/images/dialogue/byakuya.png';
import dimidiatusSeal from 'assets/images/dialogue/dimidiatus_seal.png';
import igorButterfly from 'assets/images/dialogue/igor_butterfly.png';
import igorButterflySide from 'assets/images/dialogue/igor_butterfly_side.png';
import igorApple from 'assets/images/dialogue/igor_candy_apple.png';
import igorShroom from 'assets/images/dialogue/igor_candy_shroom.png';
import igorWrapTilt from 'assets/images/dialogue/igor_candy_wrap_tilt.png';
import igorSign from 'assets/images/dialogue/igor_sign.png';
import igorSignPlank from 'assets/images/dialogue/igor_sign_plank.png';
import igorSignRope from 'assets/images/dialogue/igor_sign_rope.png';
import igorSignTitle from 'assets/images/dialogue/igor_sign_title.png';
import minaReceipt from 'assets/images/dialogue/mina_receipt.png';
import robPadlock from 'assets/images/dialogue/rob_padlock.png';
import pomPomCandy from 'assets/images/items/pom_pom_fruit_candy.png';

// a character's own look for their speech cloud: colours, the pixel decoration either side of
// their name, the pictures in and round the frame and the mark before each choice. npcs without
// one keep the default cloud (cream, plum, curls, stitch, flower)

// pixel art as rows of letters, each letter a colour; '.' = empty
type PixelArt = { rows: string[]; colours: Record<string, string> };

export type NpcSkin = {
  colours: {
    accent: string; // hovers, badges, tab icons, choice marks
    scroll?: string; // the quest list's scrollbar, if not the accent
    name: string;
    line: string; // outlines
    fill: string; // the panel
    text: string;
    row: string; // control fills
    rowLine: string;
    tray: string; // behind the choices
    light: string; // the choice buttons, and text on the accent
    exit?: string; // the close X, when the outline colour is too dark to read on the panel
    hover?: string; // a choice's fill while hovered (default: the accent), and its text then
    hoverText?: string;
    second?: string; // the strip behind the cloud, showing between it and the quest buttons
    namePlateLine?: string; // a thin outline round that plate
    namePlate?: string; // a small stepped plate of colour behind the name, so it reads over any scenery
  };
  ornament?: PixelArt; // beside the name, mirrored on the right (none: just the name)
  // pictures in the background inside the frame, behind everything; `at` in px at 1920 wide from
  // the inside's edges (negative: partly past them, cut off by the frame)
  scenery?: {
    art: PixelArt;
    at: { top?: number; right?: number; bottom?: number; left?: number };
    // `twinkle` blinks it once from this delay (s) when the cloud opens
    twinkle?: number;
    // `over`: drawn over the words instead of under them. `invert`: and it turns what's under it
    // to its opposite (dimidiatus' white half: white letters crossing it turn black)
    over?: boolean;
    invert?: boolean;
  }[];
  patch?: PixelArt; // a piece of colour in the top-right corner inside the frame, behind everything
  brackets?: PixelArt; // a piece in each corner inside the frame (drawn for the top-left, mirrored for the others)
  tearLine?: string; // a dotted tear line down a tag's left end, beside its hole, in this colour
  shape?: 'tag' | 'bevel'; // the frame's shape: 'tag' cuts its left end like a price tag, with a punched hole; 'bevel' cuts all four corners off in steps
  nameIndent?: number; // extra room before the name, in outline widths (a wide name picture)
  // the words this many px lower (in a 1080px room), so they sit as far below a tall name picture
  // as the plain names' words sit below them
  textDrop?: number;
  // the name shown on a picture (mina's receipt, rob's padlock): `back` behind the letters, their
  // top `textRow` pixels down it (negative: above); `cell` screen px per sprite pixel at 1920 wide
  // (default 2); `lift` raises it all; `print` slides it up out of the frame as the cloud opens
  nameIn?: {
    back: Sprite;
    textRow: number;
    lift?: number;
    cell?: number;
    print?: boolean;
    textSize?: string; // the name's size on the picture, when its line is drawn for a smaller one than the header's
  };
  // pictures round the frame, free to stick out past it: `at` px at 1920 wide from the cloud's
  // edges (negative: past them), `cell` px per picture pixel (default 3), `flip` mirrors it;
  // `flutter` flies it in from `from` as the cloud opens, settling after `for` s (after `delay` s)
  decor?: (Sprite & {
    at: { top?: number; right?: number; bottom?: number; left?: number };
    cell?: number;
    flip?: boolean;
    flutter?: { from: [number, number]; for: number; delay?: number };
  })[];
  // pixel art repeated along the frame's top edge (igor's pumpkin vine), from `from` px in from the
  // left to `to` px in from the right (at 1920 wide), its row `row` lying on the edge
  topEdge?: { art: PixelArt; from: number; to: number; row: number };
  // a sprite resting on the frame's top edge; behindName: half hidden behind the name's picture
  onTop?: Sprite & { behindName?: boolean };

  mark: string; // clip-path of the mark before each choice

  // how the quest list comes out of the cloud: under the frame, the conversation staying in view
  // above it. 'receipt' a till receipt printing out, with a torn edge; 'notice' a parchment notice
  // edged in `leather` with a `stitch`, unrolling down to a leather roll; 'sign' a wooden sign of
  // `wood` planks parted by `grain`, dropping on two `rope`s and swinging to rest, its quests on
  // `row` boards (`rowLine` edges, `text`, `hover` fill) under a `title` in its own colour;
  // 'contract' a black document lettered in `ink`, inside a `plaque` line, each quest one of its
  // clauses numbered in `numeral`, stamped with its `seal` once it's out; 'bottles' a wooden
  // box of small `bottles`, each with a paper tag on its neck carrying a quest's name (see
  // getQuestList: npcs without a skin can have one too).
  // unset: it drops from under the header over the line
  questList?: QuestListLook;

  // the ritual's tab: `ornament` either side of its name (unset: the name's own; null: none);
  // `brackets` one in its top-right corner and one upside down under its name; `plaque` a line
  // inside its edge and round its medal; `ring` a band round the medal; `colours` its own
  ritual?: {
    colours?: RitualColours;
    ornament?: PixelArt | Sprite | null; // a sprite (a game item) is drawn 28px square (in a 1080px room)
    brackets?: PixelArt; // drawn for the top-left, turned for each place
    plaque?: string;
    ring?: { colour: string; stitch?: string };
  };
};

// the ritual tab's own colours, set apart from the cloud's so it catches the eye: `stitch` also
// colours its curls; `medal` the medal's panel and icon (unset: the cloud's own); `burst` the
// pixels that pop out of the medal as it arrives (unset: the accent)
export type RitualColours = {
  fill: string;
  name: string;
  stitch?: string;
  plaque?: string;
  medal?: { fill?: string; icon?: string };
  burst?: string; // the coloured pixels that pop out of the medal as the tab arrives
  thick?: boolean; // the name's letters a little heavier, to read on a mid-tone fill
};

export type QuestListLook =
  | { look: 'receipt' }
  | { look: 'notice'; colours: { leather: string; stitch: string } }
  | {
      look: 'sign';
      // one plank of the sign (repeated down it, a quest on each) and a piece of its rope, cut from
      // the npc's own name sign; drawn at 3 screen pixels per pixel like the sign
      plank: Sprite;
      rope: Sprite;
      titlePlank: Sprite; // a taller plank of the same wood, for the list's title
      colours: {
        outline: string;
        wood: string;
        grain: string;
        rope: string;
        row: string;
        rowLine: string;
        text: string;
        hover: string;
        title: string;
      };
    }
  | {
      look: 'bottles';
      colours: {
        line: string; // the cabinet's outline, and the title's shadow
        paper: string; // the tags, and the cabinet's title
        string: string;
        number: string; // the jar number on each tag
      };
      // the cabinet's art, from the shelf in her room: its top board and the shadow under it,
      // and the wall behind
      // and the cabinet round it: a post down each side, a base board under it (its stepped end
      // drawn for the left), a foot under each end and the scalloped apron between them. left-hand
      // pieces are mirrored for the right
      shelf: {
        top: Sprite;
        wall: Sprite;
        post: Sprite;
        base: Sprite;
        baseEnd: Sprite;
        foot: Sprite;
        apron: Sprite;
      };
      bottles: Sprite[]; // a quest's is picked by its index, so it keeps its colour
    }
  | {
      look: 'map';
      colours: {
        paper: string;
        line: string; // its outline
        edge: string; // the old paper browning in from its edge, and its stains
        trail: string; // the dotted trail from quest to quest
        mark: string; // each quest's X
        ink: string; // the quest names
        compass: string;
      };
    }
  | {
      look: 'contract';
      // unrolled down by a gold rod: rod, rodLight and rodShade, outlined in rodLine
      colours: {
        paper: string;
        ink: string;
        numeral: string;
        plaque: string;
        wax: string;
        rod: string;
        rodLight: string;
        rodShade: string;
        rodLine: string;
      };
      seal: Sprite;
    };

// a finished sprite and its size in native pixels; drawn at 2 screen pixels per pixel (at 1920 wide)
type Sprite = { src: string; width: number; height: number };

const DIAMOND = 'polygon(50% 0, 100% 50%, 50% 100%, 0 50%)';

// mina: the gift shop and Byakuya, her white snake. shrine-white paper with red, the box cut like
// a price tag, her name on a till receipt and Byakuya resting on the frame's top edge, half
// hidden behind the receipt
const MINA: NpcSkin = {
  colours: {
    accent: '#c0392b',
    name: '#b0303a',
    line: '#3a1f2a',
    fill: '#fcfaf6',
    text: '#2e1d24',
    row: '#f5ede6',
    rowLine: '#e9dcd2',
    tray: '#f3e6df',
    light: '#ffffff',
    second: '#f4d06f', // butter yellow, like lemon candy, beside her pink shop tab
    scroll: '#f4d06f',
  },
  // a torn-off till receipt sticking up out of the frame (items, a red total, a barcode) with her
  // name as its last line
  // the receipt drawn half as big again, so its last line fits her name at this size
  nameIn: {
    back: { src: minaReceipt, width: 36, height: 38 },
    textRow: 24,
    lift: 4,
    cell: 3,
    print: true,
    textSize: '2.2667cqh',
  },
  shape: 'tag',
  tearLine: '#e2cfc4',
  onTop: { src: byakuya, width: 49, height: 14, behindName: true },
  mark: DIAMOND,
  questList: { look: 'receipt' },
  // her shop's tab: candy pink with white lettering and a pale pink stitch, the game's pom pom
  // fruit candy either side of its name (it's mainly a confectionery), and a white coin with
  // its icon and stitch in butter yellow, like the strip behind the cloud
  ritual: {
    colours: {
      fill: '#c04462', // a deeper candy pink, so the white lettering reads
      name: '#ffffff', // white, a little heavier
      thick: true,
      stitch: '#ffd6de',
      medal: { fill: '#fcfaf6', icon: '#f4d06f' }, // a white coin, its icon butter yellow like her strip
      burst: '#c0392b', // her red
    },
    ornament: { src: pomPomCandy, width: 24, height: 24 },
    ring: { colour: '#fcfaf6', stitch: '#f4d06f' },
  },
  textDrop: 6,
};

// a stepped triangle `n` pixels across for the top-right corner, each pixel from fill(x, y)
const cornerPatch = (n: number, fill: (x: number, y: number) => string) =>
  [...Array(n)].map((_, y) => [...Array(n)].map((_, x) => (x >= y ? fill(x, y) : '.')).join(''));

// zevana: the huntress. light parchment like a wanted poster, a corner of dark hunter's leather
// with gold stitching behind the arrows, and her hat's feathers by her name
const ZEVANA: NpcSkin = {
  colours: {
    accent: '#733e12',
    name: '#733e12',
    line: '#24282f',
    fill: '#f4e8d4',
    text: '#2a2220',
    row: '#ead8bb',
    rowLine: '#dcc39e',
    tray: '#e6d2b2',
    light: '#fbf3e6',
  },
  ornament: {
    rows: ['....o', '...op', '..opo', '..opo', '.opo.', '.opo.', 'opo..', 'oo...', 'o....'],
    colours: { o: '#733e12', p: '#7c6845' },
  },
  // the leather: its edge a lighter brown, a stitch every other pixel a little way in
  patch: {
    rows: cornerPatch(28, (x, y) => (x - y === 0 ? 'e' : x - y === 3 && x % 2 === 0 ? 's' : 'l')),
    colours: { l: '#5a3a1e', e: '#7c5530', s: '#e8c87a' },
  },
  // her ritual's tab: leaf green (a softened #7ca61b, warmed to sit with her browns) with cream
  // lettering, a band of the cloud's parchment with a green stitch round its green medal, and cream
  // brackets; no feathers by its name
  ritual: {
    colours: {
      fill: '#6e8c32',
      name: '#f4e8d4',
      medal: { fill: '#6e8c32', icon: '#f4e8d4' },
      burst: '#d19a3a', // ochre, like her leathers
    },
    ornament: null,
    ring: { colour: '#f4e8d4', stitch: '#6e8c32' },
    // cream brackets: one in the tab's top-right corner, one holding the name's K from below
    brackets: { rows: ['ccccc', 'c....', 'c....', 'c....'], colours: { c: '#f4e8d4' } },
  },
  mark: DIAMOND,
  // her quests on a hunter's notice: the parchment edged in the leather of her corner patch, with
  // its gold stitch
  questList: { look: 'notice', colours: { leather: '#5a3a1e', stitch: '#e8c87a' } },
};

// rob: the treasure room he was locked in for a thousand years. old gold paper with his purple,
// gold treasure-chest brackets in the corners and his name on an orphrey of gold and jewels
const ROB: NpcSkin = {
  colours: {
    accent: '#8e74e4',
    name: '#3a2410', // engraved into the padlock's gold
    line: '#3a2410',
    fill: '#fbf0cf',
    text: '#33210e',
    row: '#f3e3b0',
    rowLine: '#e6d090',
    tray: '#f1dfa6',
    light: '#fffaea',
  },
  // a chest's gold corner bracket with its rivet, laid right along the frame: the frame's line is
  // its outer edge, and the frame's stepped corner cuts its own
  brackets: {
    rows: [
      'yyhyyyyo',
      'yryooooo',
      'yyo.....',
      'yo......',
      'yo......',
      'yo......',
      'yo......',
      'oo......',
    ],
    colours: { o: '#3a2410', y: '#f0c94a', h: '#fff6d5', r: '#8a5a1a' },
  },
  // his name on a gold padlock whose shackle has sprung open (locked in the vault a thousand
  // years, and out), set high so the shackle sticks out over the frame's top edge
  nameIn: {
    back: { src: robPadlock, width: 51, height: 25 },
    textRow: 14,
    lift: 2, // its bottom just below the back / next buttons'
    cell: 3,
  },
  nameIndent: 10, // the padlock reaches well left of his name: clear of the corner bracket
  mark: DIAMOND,
  textDrop: 3,
  // a treasure map: a dotted trail down it, each quest a red X along the way
  questList: {
    look: 'map',
    colours: {
      paper: '#ead7a4',
      line: '#3a2410',
      edge: '#b8925a',
      trail: '#a0522d',
      mark: '#c0392b',
      ink: '#33210e',
      compass: '#8a5a1a',
    },
  },
};

// the Wheel as a big background picture `n` pixels across: a studded rim, `spokes` spokes and a
// ringed hub. colours: r rim, t studs, s spokes, h hub ring, c hub
const bigWheel = (n: number, colours: PixelArt['colours'], spokes = 16): PixelArt => {
  const c = (n - 1) / 2;
  const R = c - 0.5;
  const gap = (2 * Math.PI) / spokes;
  const rows = [...Array(n)].map((_, y) =>
    [...Array(n)]
      .map((_, x) => {
        const dx = x - c;
        const dy = y - c;
        const d = Math.hypot(dx, dy);
        const along = (Math.atan2(dy, dx) / gap) % 1;
        const a = along < 0 ? along + 1 : along;
        const b = (a + 0.5) % 1;
        if (d > R + 0.5) return '.';
        if (d > R - 1.2) return Math.min(b, 1 - b) * gap * d < 0.9 && d > R - 0.3 ? 't' : 'r';
        if (d < 2.2) return 'c';
        if (d < 4.6) return d < 3.4 ? 'h' : 'r';
        return Math.min(a, 1 - a) * gap * d < 0.95 ? 's' : '.';
      })
      .join('')
  );
  return { rows, colours };
};
const STAR = (colour: string): PixelArt => ({
  rows: ['.y.', 'yyy', '.y.'],
  colours: { y: colour },
});

// a quarter of a big round shape `n` pixels across, rising from the bottom-left corner, with a
// one-pixel edge (w inside, e the edge)
const quarterDisc = (n: number): string[] =>
  [...Array(n)].map((_, y) =>
    [...Array(n)]
      .map((_, x) => {
        const d = Math.hypot(x, n - 1 - y);
        return d < n - 1.5 ? 'w' : d < n - 0.5 ? 'e' : '.';
      })
      .join('')
  );

// the colours that dimidiatus' white half (#ece9e0, inverting what's under it) turns into these
const underHalf = (colours: Record<string, string>) =>
  Object.fromEntries(
    Object.entries(colours).map(([k, hex]) => {
      const white = [0xec, 0xe9, 0xe0];
      const rgb = [1, 3, 5].map((i, j) =>
        Math.max(0, white[j] - parseInt(hex.slice(i, i + 2), 16))
      );
      return [k, `#${rgb.map((v) => v.toString(16).padStart(2, '0')).join('')}`];
    })
  );

// dimidiatus: the Temple of the Wheel and its two faces, a bevelled black box with its white face
// at the bottom-left. as the cloud opens, one sweep from the top-right: the cream Wheel turns, the
// stars twinkle in order, then the blue Wheel turns the other way
const dimidiatusScenery = (): NonNullable<NpcSkin['scenery']> => {
  // the stars keep clear of the words, scattered round the two Wheels: the gold ones about the
  // cream Wheel at the top-right, the blue ones about the blue Wheel at the bottom-left
  const topStars = [
    [92, 8],
    [120, 28],
    [84, 48],
    [34, 100],
    [16, 132],
  ].sort((a, b) => a[0] + a[1] - (b[0] + b[1]));
  const bottomStars = [
    [72, 6],
    [92, 20],
    [62, 30],
    [8, 70],
    [6, 98],
  ].sort((a, b) => b[0] + b[1] - (a[0] + a[1]));
  const step = 0.12;
  const starsFrom = 0.5;
  return [
    {
      art: { rows: quarterDisc(20), colours: { w: '#ece9e0', e: '#bdb9ae' } },
      at: { left: 0, bottom: 0 },
      over: true,
      invert: true,
    },
    {
      art: bigWheel(37, { r: '#8a7f5c', s: '#7a7050', t: '#d8c88e', h: '#d8c88e', c: '#ffecb7' }),
      at: { right: -32, top: -32 },
    },
    ...topStars.map(([right, top], i) => ({
      art: STAR('#8a7f5c'),
      at: { right, top },
      twinkle: starsFrom + i * step,
    })),
    ...bottomStars.map(([left, bottom], i) => ({
      art: STAR('#8fb8cc'),
      at: { left, bottom },
      twinkle: starsFrom + (topStars.length + i) * step,
    })),
    {
      // under the words like the stars; what shows of it lies on the white half, which inverts what's
      // under it, so it's drawn in the colours that turn into its pale blues there
      art: bigWheel(
        19,
        underHalf({ r: '#b5cfe0', s: '#c3d8e6', t: '#8fb8cc', h: '#8fb8cc', c: '#609eb4' }),
        8
      ),
      at: { left: -12, bottom: -12 },
    },
  ];
};

const DIMIDIATUS: NpcSkin = {
  colours: {
    accent: '#ffecb7',
    scroll: '#c9a43c', // the gold of his contract
    name: '#ffecb7',
    namePlate: '#0e0e0e', // the panel's own black
    namePlateLine: '#a89e7a', // a thin muted-gold outline: a temple plaque
    line: '#000000',
    fill: '#0e0e0e',
    text: '#ffffff', // white, and black where it crosses the white half (which inverts it)
    row: '#1f1f1f',
    rowLine: '#333333',
    tray: 'color-mix(in srgb, #191919 35%, transparent)', // see-through: the white face shows between the choices
    light: '#232323',
    exit: '#ffecb7',
  },
  shape: 'bevel',
  scenery: dimidiatusScenery(),
  // his quests are the terms of his contract: a black scroll unrolled down by a gold rod,
  // lettered in the gold of its seal, a small Wheel pressed into the seal
  questList: {
    look: 'contract',
    colours: {
      paper: '#0e0e0e',
      ink: '#e0c060',
      numeral: '#ffffff',
      plaque: '#c9a43c',
      wax: '#c9a43c',
      rod: '#c9a43c',
      rodLight: '#f0d070',
      rodShade: '#7a6024',
      rodLine: '#000000',
    },
    seal: { src: dimidiatusSeal, width: 30, height: 30 },
  },
  // his ritual's tab: a temple plaque like his name's, in dusty sage with a darker sage line, a
  // small cream Wheel either side of its name
  ritual: {
    colours: {
      fill: '#9fb08a',
      name: '#1f2a18',
      stitch: '#55663f',
      plaque: '#55663f',
      burst: '#e0c060', // the gold of his Wheel
    },
    ornament: bigWheel(
      11,
      { r: '#d8c88e', s: '#a89e7a', t: '#ffecb7', h: '#a89e7a', c: '#ffecb7' },
      8
    ),
    plaque: '#a89e7a',
  },
  mark: DIAMOND,
  textDrop: 4,
};

// igor: the butterfly forest. a dusty violet cloud with a pumpkin vine along its top edge, his
// name on a little wooden sign hung from it, the forest's glowing butterflies resting on the sign
// and the cloud's corner, and his candies on the bottom edge
const IGOR: NpcSkin = {
  colours: {
    accent: '#ff8504',
    name: '#ffe0a0',
    line: '#22182c',
    fill: '#55456a', // dusty violet
    text: '#f4e3cf',
    row: '#66557c',
    rowLine: '#80709a',
    tray: '#493b5c',
    light: '#66557c',
    exit: '#f4e3cf',
    hover: '#e8792a', // a clean pumpkin orange, a touch softer than the accent
    hoverText: '#fff6ea',
  },
  // his name on a wooden sign hung on two ropes, which reach up over the frame's top edge
  nameIn: {
    back: { src: igorSign, width: 53, height: 25 },
    textRow: 12,
    cell: 3,
  },
  nameIndent: 5, // the sign reaches well left of his name: clear of the frame
  topEdge: {
    // the vine's stem with leaves above and below it, and a curling tendril
    art: {
      rows: [
        '......ll..............',
        '.....lLLl.......cc....',
        '....lLLLLl.....c..c...',
        '.....lLLl.........c...',
        'gggggggggggggggggcgggg',
        '...........ll.........',
        '..........lLLl........',
        '...........ll.........',
      ],
      colours: { g: '#2f5a22', c: '#2f5a22', l: '#3a6b2a', L: '#6ba83a' },
    },
    from: 40,
    to: 60,
    row: 4,
  },
  decor: [
    // the forest's glowing butterflies: they flutter in when the cloud opens and settle on top of
    // the sign and on the bottom-right corner
    {
      src: igorButterflySide,
      width: 10,
      height: 12,
      cell: 2,
      at: { top: -15, left: 62 },
      flutter: { from: [-70, -60], for: 2, delay: 0.1 },
    },
    {
      src: igorButterfly,
      width: 12,
      height: 12,
      cell: 2,
      flip: true,
      at: { top: -13, left: 114 },
      flutter: { from: [60, -80], for: 2.3 },
    },
    {
      src: igorButterflySide,
      width: 10,
      height: 12,
      cell: 2,
      flip: true,
      at: { top: -33, left: 146 },
      flutter: { from: [110, -40], for: 1.8, delay: 0.3 },
    },
    {
      src: igorButterfly,
      width: 12,
      height: 12,
      cell: 2,
      flip: true,
      at: { bottom: 6, right: 2 },
      flutter: { from: [70, 50], for: 2.1, delay: 0.2 },
    },
    {
      src: igorButterflySide,
      width: 10,
      height: 12,
      cell: 2,
      at: { bottom: 26, right: -18 },
      flutter: { from: [40, -70], for: 1.9 },
    },
    // his candies on the bottom edge, the wrapped one tilted, leaning on the mushroom sweet
    { src: igorApple, width: 12, height: 13, at: { bottom: -13, left: 30 } },
    { src: igorShroom, width: 10, height: 10, at: { bottom: 0, left: 80 } },
    { src: igorWrapTilt, width: 15, height: 12, at: { bottom: -13, left: 104 } },
  ],
  mark: DIAMOND,
  // his quests on a wooden sign like the one his name hangs on, its boards lighting up pumpkin
  questList: {
    look: 'sign',
    plank: { src: igorSignPlank, width: 46, height: 9 },
    rope: { src: igorSignRope, width: 2, height: 7 },
    titlePlank: { src: igorSignTitle, width: 46, height: 12 },
    colours: {
      outline: '#140d18', // the name sign's own outline
      wood: '#7a4e2c',
      grain: '#5e3b20',
      rope: '#c9a56a',
      row: '#8a5c36',
      rowLine: '#a5774a',
      text: '#fff6ea',
      hover: '#e8792a',
      title: '#ffe0a0',
    },
  },
  textDrop: 15,
};

const SKINS: Record<string, NpcSkin> = {
  mina: MINA,
  zevana: ZEVANA,
  rob: ROB,
  igor: IGOR,
  dimidiatus: DIMIDIATUS,
};

export const getSkin = (npcName: string): NpcSkin | undefined =>
  SKINS[npcName.trim().toLowerCase()];

// what plays once when an npc's cloud opens (npcs keeping the default cloud can have one too):
// `sew`, the stitch round the inside of the frame appears in steps from the top-left corner, as if
// being sewn; `curls`, the two curls beside the name unfurl from it outwards
export type Opening = { sew?: boolean; curls?: boolean };
const OPENINGS: Record<string, Opening> = {
  alaina: { sew: true, curls: true },
};
export const getOpening = (npcName: string): Opening =>
  OPENINGS[npcName.trim().toLowerCase()] ?? {};

// quest lists by name, for npcs keeping the default cloud (a skin brings its own)
const QUEST_LISTS: Record<string, QuestListLook> = {
  // alaina: a cabinet like the shelf in her room, of little potions like the jars she found and
  // named, each tagged with a quest, in one of eight colours by the quest's index
  alaina: {
    look: 'bottles',
    colours: {
      line: '#573359',
      paper: '#f6ecd2',
      string: '#d8c9a8',
      number: '#8a6a4a',
    },
    shelf: {
      top: { src: shelfTop, width: 24, height: 5 },
      wall: { src: shelfWall, width: 21, height: 10 },
      post: { src: shelfPost, width: 5, height: 8 },
      base: { src: shelfBase, width: 24, height: 5 },
      baseEnd: { src: shelfBaseEnd, width: 3, height: 5 },
      foot: { src: shelfFoot, width: 5, height: 5 },
      apron: { src: shelfApron, width: 9, height: 4 },
    },
    bottles: [
      potionGreen,
      potionPink,
      potionYellow,
      potionBlue,
      potionOrange,
      potionRed,
      potionPurple,
      potionTeal,
    ].map((src) => ({
      src,
      width: 26,
      height: 26,
    })),
  },
};
export const getQuestList = (npcName: string, skin?: NpcSkin): QuestListLook | undefined =>
  skin?.questList ?? QUEST_LISTS[npcName.trim().toLowerCase()];

// the ritual tab's colours: a skin's own, else by name for npcs keeping the default cloud
const RITUAL_COLOURS: Record<string, RitualColours> = {
  alaina: { fill: '#9a4a68', name: '#f8e6ec', stitch: '#f8e6ec', burst: '#f2a65a' }, // light rosewood, cream stitch and curls
};
export const getRitualColours = (npcName: string, skin?: NpcSkin): RitualColours | undefined =>
  skin?.ritual?.colours ?? RITUAL_COLOURS[npcName.trim().toLowerCase()];

// the css variables the cloud's styles read (each falls back to the default look)
export const skinVars = (skin?: NpcSkin): CSSProperties => {
  if (!skin) return {};
  const c = skin.colours;
  return {
    ...(skin.textDrop && { '--npc-text-drop': `${+((skin.textDrop * 100) / 1080).toFixed(4)}cqh` }),
    '--npc-name': c.name,
    '--npc-line': c.line,
    '--npc-fill': c.fill,
    '--npc-text': c.text,
    '--npc-row': c.row,
    '--npc-row-line': c.rowLine,
    '--npc-tray': c.tray,
    '--npc-light': c.light,
    '--npc-mark': skin.mark,
    ...(c.exit && { '--npc-exit': c.exit }),
    ...(c.hover && { '--npc-hover': c.hover }),
    ...(c.hoverText && { '--npc-hover-text': c.hoverText }),
    ...(c.second && { '--npc-second': c.second }),
    ...(c.namePlate && {
      '--npc-name-plate': c.namePlate,
      ...(c.namePlateLine && {
        // the line one step in from the plate's edge, so black always parts it from what's behind
        '--npc-name-plate-line': `inset 0 0 0 0.2844cqh ${c.namePlate}, inset 0 0 0 0.4622cqh ${c.namePlateLine}`,
      }),
      '--npc-name-plate-pad': '0.7111cqh 1.3333cqh 0.6222cqh 1.4222cqh',
      // the frame's stepped corners, one step of 3px (at 1920 wide)
      '--npc-name-plate-shape':
        'polygon(0 0.2844cqh, 0.2844cqh 0.2844cqh, 0.2844cqh 0, calc(100% - 0.2844cqh) 0, calc(100% - 0.2844cqh) 0.2844cqh, 100% 0.2844cqh, 100% calc(100% - 0.2844cqh), calc(100% - 0.2844cqh) calc(100% - 0.2844cqh), calc(100% - 0.2844cqh) 100%, 0.2844cqh 100%, 0.2844cqh calc(100% - 0.2844cqh), 0 calc(100% - 0.2844cqh))',
    }),
  } as CSSProperties;
};

const svg = ({ rows, colours }: PixelArt, flip = false) => {
  const w = Math.max(...rows.map((r) => r.length));
  const rects = rows.flatMap((row, y) =>
    [...row].flatMap((c, x) =>
      colours[c]
        ? [
            `<rect x="${flip ? w - 1 - x : x}" y="${y}" width="1.02" height="1.02" fill="${colours[c]}"/>`,
          ]
        : []
    )
  );
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${rows.length}" shape-rendering="crispEdges">${rects.join('')}</svg>`;
};

// each picture's data url is built once per art object (the skins' art is static): dimidiatus'
// big Wheel alone is over a thousand rects, and the cloud re-renders on every line and measurement
const dataUrls = new WeakMap<PixelArt, [string?, string?]>();
const pixelData = (art: PixelArt, flip = false) => {
  let urls = dataUrls.get(art);
  if (!urls) dataUrls.set(art, (urls = []));
  const i = flip ? 1 : 0;
  return (urls[i] ??= `data:image/svg+xml,${encodeURIComponent(svg(art, flip))}`);
};
export const pixelUrl = (art: PixelArt) => `url("${pixelData(art)}")`;

// a pixel picture drawn on the cloud's pixel grid (`cell` per pixel)
export const PixelSprite = ({
  art,
  cell,
  flip = false,
}: {
  art: PixelArt;
  cell: string;
  flip?: boolean;
}) => {
  const w = Math.max(...art.rows.map((r) => r.length));
  return (
    <img
      alt=''
      draggable={false}
      src={pixelData(art, flip)}
      style={{
        display: 'block',
        width: `calc(${w} * ${cell})`,
        height: `calc(${art.rows.length} * ${cell})`,
      }}
    />
  );
};
