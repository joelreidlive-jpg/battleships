/**
 * Renders the victory cheer: a flight deck of voices shouting "Hooray!".
 *
 * A single synthesised voice shouting into an empty room does not read as a
 * crowd, so the clip is built as one: a dozen voices of different sex, pitch
 * and pace, each detuned and started a fraction apart so no two land together,
 * over a soft roar of the deck itself. The whole thing is then put in a room
 * with a short echo and brought to the same level as every other clip.
 */

import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { POLISH, publish } from './level.js';

interface Shout {
  /** espeak-ng voice, including its variant. */
  readonly voice: string;
  /** Words per minute. */
  readonly speed: number;
  /** espeak-ng pitch, 0-99. */
  readonly pitch: number;
  /** Resampling ratio, which detunes the voice away from its neighbours. */
  readonly detune: number;
  /** Where in the cheer this voice comes in, in milliseconds. */
  readonly delay: number;
  /** How close to the front this voice stands. */
  readonly gain: number;
}

/**
 * The deck. Spread deliberately rather than drawn at random, so a re-render
 * produces the clip that is committed. Late voices are quieter: they are the
 * ones at the back, taking the shout up.
 */
const CROWD: readonly Shout[] = [
  { voice: 'en-gb+m3', speed: 165, pitch: 55, detune: 1.0, delay: 0, gain: 1 },
  { voice: 'en-gb+f3', speed: 178, pitch: 80, detune: 1.04, delay: 60, gain: 0.9 },
  { voice: 'en-gb+m7', speed: 158, pitch: 30, detune: 0.94, delay: 110, gain: 0.85 },
  { voice: 'en-gb-x-rp+f4', speed: 185, pitch: 88, detune: 1.07, delay: 150, gain: 0.7 },
  { voice: 'en-gb+m1', speed: 150, pitch: 20, detune: 0.9, delay: 210, gain: 0.8 },
  { voice: 'en-gb+f2', speed: 172, pitch: 70, detune: 1.02, delay: 260, gain: 0.65 },
  { voice: 'en-gb+m5', speed: 168, pitch: 45, detune: 0.97, delay: 330, gain: 0.6 },
  { voice: 'en-gb+f5', speed: 190, pitch: 92, detune: 1.1, delay: 380, gain: 0.5 },
  { voice: 'en-gb+m2', speed: 160, pitch: 38, detune: 0.92, delay: 450, gain: 0.55 },
  { voice: 'en-gb+f1', speed: 175, pitch: 76, detune: 1.05, delay: 520, gain: 0.45 },
  { voice: 'en-gb+m4', speed: 155, pitch: 26, detune: 0.88, delay: 600, gain: 0.5 },
  { voice: 'en-gb-x-rp+f3', speed: 182, pitch: 84, detune: 1.08, delay: 680, gain: 0.4 },
];

const LINE = 'Hooray!';
/** Long enough for the last voice to finish and the room to fall quiet. */
const LENGTH_S = 3.4;

/** The deck under the voices: a swell of noise, not a hiss. */
const ROAR =
  `anoisesrc=c=pink:d=${LENGTH_S}:r=22050:seed=1970,` +
  'highpass=f=300,lowpass=f=2600,tremolo=f=7:d=0.7,' +
  'afade=t=in:d=0.5,afade=t=out:st=2.4:d=1,volume=0.22';

/** The room they are all standing in. */
const ROOM = 'aecho=0.9:0.85:45|75|120:0.32|0.2|0.12,lowpass=f=7000';

export function renderCheer(work: string, out: string): void {
  const voices = CROWD.map((_, index) => shout(work, index));
  const inputs = voices.flatMap((wav) => ['-i', wav]);
  const lanes = voices
    .map((_, index) => `[${index}:a]adelay=${CROWD[index].delay}|${CROWD[index].delay},volume=${CROWD[index].gain}[v${index}]`)
    .join(';');
  const mixed = voices.map((_, index) => `[v${index}]`).join('');
  const mp3 = join(out, 'crowd-hooray.mp3');
  const raw = join(work, 'cheer.wav');
  execFileSync('ffmpeg', [
    '-v',
    'error',
    '-y',
    ...inputs,
    '-f',
    'lavfi',
    '-i',
    ROAR,
    '-filter_complex',
    `${lanes};${mixed}amix=inputs=${voices.length}:normalize=0[deck];` +
      `[deck][${voices.length}:a]amix=inputs=2:normalize=0,${ROOM},${POLISH}[out]`,
    '-map',
    '[out]',
    '-ar',
    '22050',
    '-ac',
    '1',
    raw,
  ]);
  publish(raw, mp3);
}

/** One voice in the crowd, synthesised and detuned away from its neighbours. */
function shout(work: string, index: number): string {
  const { voice, speed, pitch, detune } = CROWD[index];
  const wav = join(work, `shout-${index}.wav`);
  const detuned = join(work, `shout-${index}-tuned.wav`);
  execFileSync('espeak-ng', ['-v', voice, '-s', String(speed), '-p', String(pitch), '-a', '190', '-w', wav, LINE]);
  execFileSync('ffmpeg', [
    '-v',
    'error',
    '-y',
    '-i',
    wav,
    '-af',
    `asetrate=22050*${detune},aresample=22050,${POLISH}`,
    '-ar',
    '22050',
    '-ac',
    '1',
    detuned,
  ]);
  return detuned;
}
