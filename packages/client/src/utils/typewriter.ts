// synthesized typewriter keys: a soft low-passed tap every other letter and a lower thump for a
// space, each varied a little so a line doesn't sound looped. no audio files; the fx volume applies

let ctx: AudioContext | undefined;
let strike: AudioBuffer | undefined;
let letters = 0;

const audio = () => {
  ctx ??= new AudioContext();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
};

// a burst of noise that dies away quickly: the raw sound of a key going down
const strikeBuffer = (ac: AudioContext) => {
  if (strike) return strike;
  const length = Math.ceil(ac.sampleRate * 0.04);
  strike = ac.createBuffer(1, length, ac.sampleRate);
  const data = strike.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (length / 6));
  return strike;
};

// the settings are parsed again only when they change (this runs on every letter typed)
let settingsRaw: string | null = null;
let volume = 0.5;
const fxVolume = () => {
  const raw = localStorage.getItem('settings');
  if (raw !== settingsRaw) {
    settingsRaw = raw;
    volume = JSON.parse(raw || '{}').volume?.fx ?? 0.5;
  }
  return volume;
};

const vary = (amount: number) => 1 + (Math.random() * 2 - 1) * amount;

// one strike, rounded off above `freq` so it taps rather than ticks
const tap = (ac: AudioContext, at: number, freq: number, level: number, rate = 1) => {
  const src = ac.createBufferSource();
  const filter = ac.createBiquadFilter();
  const gain = ac.createGain();
  src.buffer = strikeBuffer(ac);
  src.playbackRate.value = rate;
  filter.type = 'lowpass';
  filter.frequency.value = freq;
  filter.Q.value = 0.7;
  gain.gain.value = level;
  src.connect(filter).connect(gain).connect(ac.destination);
  src.start(at);
};

// called with each newly typed piece of a line
export const playKeystroke = (typed: string) => {
  const volume = fxVolume();
  if (!volume) return;
  const ac = audio();
  const at = ac.currentTime + Math.random() * 0.01;
  const level = 0.2 * volume * vary(0.15);

  if (typed === ' ') {
    tap(ac, at, 450 * vary(0.1), level * 0.5, 0.7);
    return;
  }
  if (!typed.trim()) return;
  // every other letter, so the taps feel like a calm rhythm rather than a rattle
  if (letters++ % 2) return;
  tap(ac, at, 1600 * vary(0.12), level);
};
