/**
 * Battle audio, synthesised in the browser: an explosion built from Web Audio
 * primitives and the two callouts spoken by the platform's speech synthesiser.
 * Nothing is fetched, so there are no assets to host and nothing to preload.
 *
 * Browsers refuse to start audio before a gesture, so the context is created
 * lazily on the first shot — by then the player has clicked a cell.
 */

const MUTE_KEY = 'bs.muted';

let context: AudioContext | null = null;
let voices: SpeechSynthesisVoice[] = [];

export function muted(): boolean {
  return localStorage.getItem(MUTE_KEY) === '1';
}

export function setMuted(value: boolean): void {
  localStorage.setItem(MUTE_KEY, value ? '1' : '0');
  if (value) speech()?.cancel();
}

function speech(): SpeechSynthesis | null {
  return typeof window === 'undefined' ? null : (window.speechSynthesis ?? null);
}

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  context ??= new Ctor();
  void context.resume();
  return context;
}

/** Voice lists load asynchronously in some browsers, so keep a warm copy. */
export function primeVoices(): void {
  const synth = speech();
  if (!synth) return;
  const load = () => {
    voices = synth.getVoices();
  };
  load();
  synth.addEventListener('voiceschanged', load);
}

/** Only a genuinely British voice will do; an American one would undercut the joke. */
function britishVoice(): SpeechSynthesisVoice | undefined {
  const available = voices.length > 0 ? voices : (speech()?.getVoices() ?? []);
  return (
    available.find((voice) => /Daniel|Serena|Google UK English/i.test(voice.name)) ??
    available.find((voice) => /^en[-_]GB/i.test(voice.lang))
  );
}

/** Pre-rendered fallbacks, for browsers that ship no British voice (most of Linux). */
function playClip(file: string, gain: number): void {
  const clip = new Audio(`/audio/${file}`);
  clip.volume = gain;
  void clip.play().catch(() => undefined);
}

/** A noise burst through a falling low-pass, over a sub-bass thump. */
function explosion(ctx: AudioContext, gain: number): void {
  const now = ctx.currentTime;
  const frames = Math.floor(ctx.sampleRate * 1.4);
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let i = 0; i < frames; i += 1) {
    // eslint-disable-next-line no-restricted-properties -- noise for the blast, nothing here touches play
    samples[i] = (Math.random() * 2 - 1) * (1 - i / frames) ** 2.4;
  }

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(2600, now);
  filter.frequency.exponentialRampToValueAtTime(140, now + 1.1);

  const body = ctx.createGain();
  body.gain.setValueAtTime(gain, now);
  body.gain.exponentialRampToValueAtTime(0.0001, now + 1.4);

  const thump = ctx.createOscillator();
  thump.type = 'sine';
  thump.frequency.setValueAtTime(120, now);
  thump.frequency.exponentialRampToValueAtTime(28, now + 0.6);

  const thumpGain = ctx.createGain();
  thumpGain.gain.setValueAtTime(gain * 0.9, now);
  thumpGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.7);

  noise.connect(filter).connect(body).connect(ctx.destination);
  thump.connect(thumpGain).connect(ctx.destination);
  noise.start(now);
  thump.start(now);
  thump.stop(now + 0.7);
}

function say(text: string, rate: number, pitch: number, voice: SpeechSynthesisVoice): void {
  const synth = speech();
  if (!synth) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = rate;
  utterance.pitch = pitch;
  utterance.volume = 1;
  utterance.voice = voice;
  utterance.lang = voice.lang;
  synth.cancel();
  synth.speak(utterance);
}

/** Explosion, then the callout once the blast has decayed. */
function fire(gain: number, callout: () => void, afterMs: number): void {
  if (muted()) return;
  const play = () => {
    if (muted()) return;
    const ctx = audio();
    if (ctx) explosion(ctx, gain);
    window.setTimeout(() => {
      if (!muted()) callout();
    }, 700);
  };
  if (afterMs > 0) window.setTimeout(play, afterMs);
  else play();
}

/** The player landed a shot: a bright blast and an excited British callout. */
export function playDirectHit(afterMs = 0): void {
  fire(
    0.5,
    () => {
      const voice = britishVoice();
      if (voice) say('Direct hit!', 1.25, 1.6, voice);
      else playClip('direct-hit.mp3', 0.9);
    },
    afterMs,
  );
}

/** The invader landed a shot: a heavier blast and a slow, guttural threat. */
export function playIncomingHit(afterMs = 0): void {
  fire(0.65, () => playClip('we-will-destroy-you.mp3', 1), afterMs);
}

/** Earth holds: the flight deck erupts as the fleet goes past. */
export function playCheer(): void {
  if (!muted()) playClip('crowd-hooray.mp3', 1);
}

/** Earth falls: the invader enjoys it. */
export function playAlienLaugh(): void {
  if (!muted()) playClip('alien-laugh.mp3', 1);
}
