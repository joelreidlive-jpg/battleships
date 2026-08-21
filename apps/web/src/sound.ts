/**
 * Battle audio: explosions synthesised from Web Audio primitives, and callouts
 * either spoken by the platform's speech synthesiser or played from a
 * pre-rendered clip where no British voice is installed.
 *
 * Everything goes through one channel. A cue is never started while another is
 * still sounding — it is scheduled for the moment the channel falls silent —
 * because two callouts talking over each other is unintelligible, and because
 * an exchange can produce up to four of them (blast, hit, blast, reply) while
 * the player is free to fire again 1.7s later.
 *
 * Browsers refuse to start audio before a gesture, so the context is created
 * lazily on the first shot — by then the player has clicked a cell.
 */

import {
  ALIEN_LOSS_CALLOUTS,
  HIT_CALLOUTS,
  INCOMING_CALLOUTS,
  LAST_HULL_CALLOUTS,
  OWN_LOSS_CALLOUTS,
  type Callout,
} from './callouts.js';
import { browserClock, Channel } from './channel.js';
import { Rotation } from './rotation.js';

const MUTE_KEY = 'bs.muted';
/** Silence between two cues, so they read as separate lines. */
const GAP_MS = 200;
/** How much of the blast plays before its callout comes in over the decay. */
const BLAST_MS = 520;

let context: AudioContext | null = null;
let voices: SpeechSynthesisVoice[] = [];
const channel = new Channel(browserClock, GAP_MS);
const clips = new Map<string, HTMLAudioElement>();

// Which reading of each moment is heard is drawn fresh every time, so a
// campaign never settles into a script. Nothing here decides the battle, so
// the platform's own randomness is fine.
// eslint-disable-next-line no-restricted-properties -- flavour only; play is decided on the server
const chance = () => Math.random();
const hits = new Rotation(HIT_CALLOUTS, chance);
const alienLosses = new Rotation(ALIEN_LOSS_CALLOUTS, chance);
const incoming = new Rotation(INCOMING_CALLOUTS, chance);
const ownLosses = new Rotation(OWN_LOSS_CALLOUTS, chance);
const lastHull = new Rotation(LAST_HULL_CALLOUTS, chance);

/**
 * Measured lengths, used until the browser has the metadata. Being wrong here
 * only costs a slightly loose gap; the real duration takes over once known.
 */
const CLIP_MS: Readonly<Record<string, number>> = {
  'alien-laugh.mp3': 4362,
  'crowd-hooray.mp3': 3056,
  'direct-hit.mp3': 722,
  'hit-2.mp3': 1489,
  'hit-3.mp3': 1750,
  'hit-4.mp3': 1463,
  'hit-5.mp3': 2298,
  'hit-6.mp3': 2820,
  'hit-7.mp3': 1959,
  'kraal-cannot-stop.mp3': 3606,
  'kraal-earth-falls.mp3': 3554,
  'kraal-have-many.mp3': 4493,
  'kraal-lucky.mp3': 4519,
  'kraal-numberless.mp3': 4023,
  'kraal-ten-more.mp3': 4023,
  'kraal-world-burns.mp3': 2977,
  'last-ship-2.mp3': 3084,
  'last-ship-3.mp3': 3319,
  'last-ship.mp3': 3188,
  'ship-lost-2.mp3': 3188,
  'ship-lost-3.mp3': 3815,
  'ship-lost-4.mp3': 3267,
  'ship-lost.mp3': 3867,
  'we-will-destroy-you.mp3': 1515,
};

export function muted(): boolean {
  return localStorage.getItem(MUTE_KEY) === '1';
}

export function setMuted(value: boolean): void {
  localStorage.setItem(MUTE_KEY, value ? '1' : '0');
  if (value) silence();
}

/** Stop everything sounding or waiting to sound, and free the channel. */
export function silence(): void {
  channel.clear();
  speech()?.cancel();
  for (const clip of clips.values()) {
    clip.pause();
    clip.currentTime = 0;
  }
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

/** Hold a cue until the channel is free, and drop it if the player mutes meanwhile. */
function enqueue(play: () => void, lengthMs: number): void {
  if (muted()) return;
  channel.play(() => {
    if (!muted()) play();
  }, lengthMs);
}

const release = () => channel.release();

/** Voice lists load asynchronously in some browsers, so keep a warm copy. */
export function primeVoices(): () => void {
  for (const file of Object.keys(CLIP_MS)) clipFor(file);
  const synth = speech();
  if (!synth) return () => undefined;
  const load = () => {
    voices = synth.getVoices();
  };
  load();
  synth.addEventListener('voiceschanged', load);
  return () => synth.removeEventListener('voiceschanged', load);
}

/** Only a genuinely British voice will do; an American one would undercut the joke. */
function britishVoice(): SpeechSynthesisVoice | undefined {
  const available = voices.length > 0 ? voices : (speech()?.getVoices() ?? []);
  return (
    available.find((voice) => /Daniel|Serena|Google UK English/i.test(voice.name)) ??
    available.find((voice) => /^en[-_]GB/i.test(voice.lang))
  );
}

/** One element per clip, kept so its length is known and it can be stopped. */
function clipFor(file: string): HTMLAudioElement {
  const held = clips.get(file);
  if (held) return held;
  const clip = new Audio(`/audio/${file}`);
  clip.preload = 'auto';
  clips.set(file, clip);
  return clip;
}

function clipLength(file: string): number {
  const known = clipFor(file).duration;
  return Number.isFinite(known) && known > 0 ? known * 1000 : (CLIP_MS[file] ?? 3000);
}

/** Pre-rendered fallbacks, for browsers that ship no British voice (most of Linux). */
function playClip(file: string, gain: number): void {
  const clip = clipFor(file);
  clip.volume = gain;
  clip.currentTime = 0;
  clip.onended = release;
  void clip.play().catch(release);
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

/** Roughly how long a line takes to speak, so the next cue waits for it. */
function spokenLength(text: string, rate: number): number {
  return (text.length * 75) / rate + 400;
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
  utterance.onend = release;
  // A voice that fails or is cut short must free the channel too, or the cue
  // behind it waits out a line that was never spoken.
  utterance.onerror = release;
  // No cancel: the channel is already clear, and cancelling here is what used
  // to cut one callout off mid-word when the next exchange came in.
  synth.speak(utterance);
}

/** Explosion, then the callout over its decay. Two cues, so neither is clipped. */
function blast(gain: number): void {
  enqueue(() => {
    const ctx = audio();
    if (ctx) explosion(ctx, gain);
  }, BLAST_MS);
}

function callout(file: string, gain = 1): void {
  enqueue(() => playClip(file, gain), clipLength(file));
}

/**
 * Speak the crew's line where a British voice exists, and fall back to its
 * pre-rendered clip where one does not.
 */
function crew(line: Callout, gain: number): void {
  const voice = britishVoice();
  if (voice) enqueue(() => say(line.line, 1.25, line.pitch, voice), spokenLength(line.line, 1.25));
  else callout(line.clip, gain);
}

/** The player landed a shot: a bright blast and whichever of the crew answers. */
export function playDirectHit(): void {
  blast(0.5);
  crew(hits.next(), 0.9);
}

/** A fresh campaign: silence whatever is still sounding, and forget what was said. */
export function resetCallouts(): void {
  silence();
  for (const rotation of [hits, alienLosses, incoming, ownLosses, lastHull]) rotation.reset();
}

/**
 * The player destroyed an invader hull: the Kraal are unimpressed. Its lines
 * are always the clip — no installed voice sounds like the Kraal.
 */
export function playAlienHullLost(): void {
  blast(0.6);
  callout(alienLosses.next().clip);
}

/** The player lost a hull: the crew take it, and keep going. */
export function playOwnHullLost(): void {
  blast(0.7);
  crew(ownLosses.next(), 1);
}

/** One hull left. No blast — this rides on the one that just sank a ship. */
export function playLastHullWarning(): void {
  crew(lastHull.next(), 1);
}

/** The invader landed a shot: a heavier blast and a slow, guttural threat. */
export function playIncomingHit(): void {
  blast(0.65);
  callout(incoming.next().clip);
}

/**
 * The curtain call. A verdict is a scene change, not another line in the
 * exchange, so it takes the channel from whatever the battle was still saying.
 */
function verdict(file: string): void {
  silence();
  callout(file);
}

/** Earth holds: the flight deck erupts as the fleet goes past. */
export function playCheer(): void {
  verdict('crowd-hooray.mp3');
}

/** Earth falls: the invader enjoys it. */
export function playAlienLaugh(): void {
  verdict('alien-laugh.mp3');
}
