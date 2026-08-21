/**
 * Renders every battle callout to a pre-rendered clip, so a browser with no
 * British voice installed still hears the right one.
 *
 * The lines live with the client (`apps/web/src/callouts.ts`); this reads them
 * from there, so a line added to the game cannot be forgotten here. Needs
 * `espeak-ng` and `ffmpeg`, neither of which is on a clean box:
 *
 *   sudo apt-get install -y espeak-ng ffmpeg
 *   pnpm audio            # rewrites apps/web/public/audio/*.mp3
 *
 * Run it after changing a line, and commit what it produces.
 */

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CALLOUTS, type Voice } from '../../apps/web/src/callouts.js';

const OUT = new URL('../../apps/web/public/audio/', import.meta.url).pathname;

interface Profile {
  /** espeak-ng voice, including its variant. */
  readonly voice: string;
  /** Words per minute. */
  readonly speed: number;
  /** espeak-ng pitch, 0–99. */
  readonly pitch: number;
  /** ffmpeg chain applied after synthesis. */
  readonly filter: string;
}

/** Trim the dead air espeak leaves at both ends. */
const POLISH =
  'silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse';

/**
 * Mean level every line is brought to, in dBFS. It is where the clips this
 * replaces already sat, so nothing in the mix shifts under them. Levelling is
 * measured and applied rather than left to `loudnorm`, whose single pass
 * mangles anything as short as "Direct hit!".
 */
const TARGET_DBFS = -18;
const MEAN = /mean_volume:\s*(-?\d+(?:\.\d+)?) dB/;

/**
 * One profile per speaker. The crew are ordinary British voices at a clip; the
 * Kraal is dropped an octave and a half by resampling, its length put back with
 * `atempo` only far enough to stay intelligible, then smeared with a chorus so
 * it does not sound like a person.
 */
const PROFILES: Readonly<Record<Voice, Profile>> = {
  crew: { voice: 'en-gb+f3', speed: 172, pitch: 65, filter: POLISH },
  'crew-2': { voice: 'en-gb+m3', speed: 165, pitch: 45, filter: POLISH },
  'crew-3': { voice: 'en-gb-x-rp+f4', speed: 178, pitch: 72, filter: POLISH },
  'crew-4': { voice: 'en-gb+m7', speed: 160, pitch: 35, filter: POLISH },
  kraal: {
    voice: 'en-gb+m1',
    speed: 148,
    pitch: 1,
    filter: `asetrate=22050*0.74,aresample=22050,atempo=1.02,chorus=0.6:0.9:50|60:0.4|0.32:0.25|0.4:2|1.3,lowpass=f=3400,${POLISH}`,
  },
};

function render(line: string, voice: Voice, clip: string, work: string): void {
  const profile = PROFILES[voice];
  const wav = join(work, 'raw.wav');
  execFileSync('espeak-ng', [
    '-v',
    profile.voice,
    '-s',
    String(profile.speed),
    '-p',
    String(profile.pitch),
    '-w',
    wav,
    line,
  ]);
  const spoken = join(work, 'spoken.wav');
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', wav, '-af', profile.filter, '-ar', '22050', '-ac', '1', spoken]);
  execFileSync('ffmpeg', [
    '-v',
    'error',
    '-y',
    '-i',
    spoken,
    '-af',
    `volume=${(TARGET_DBFS - meanDbfs(spoken)).toFixed(2)}dB,alimiter=limit=0.95`,
    '-codec:a',
    'libmp3lame',
    '-q:a',
    '5',
    join(OUT, clip),
  ]);
}

/** What the line came out at, so the gain that reaches the target is known. */
function meanDbfs(file: string): number {
  const report = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-af', 'volumedetect', '-f', 'null', '-'], {
    encoding: 'utf8',
  });
  const found = MEAN.exec(report.stderr);
  if (!found) throw new Error(`ffmpeg reported no level for ${file}`);
  return Number(found[1]);
}

const work = mkdtempSync(join(tmpdir(), 'callouts-'));
try {
  for (const callout of CALLOUTS) {
    render(callout.line, callout.voice, callout.clip, work);
    process.stdout.write(`${callout.clip}  ${callout.line}\n`);
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}
