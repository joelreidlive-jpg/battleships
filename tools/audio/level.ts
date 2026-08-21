/** Shared level and trim handling for everything rendered into the game. */

import { execFileSync, spawnSync } from 'node:child_process';

/** Trim the dead air espeak leaves at both ends. */
export const POLISH =
  'silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse';

/**
 * Mean level every clip is brought to, in dBFS. It is where the clips this
 * replaces already sat, so nothing in the mix shifts under them. Levelling is
 * measured and applied rather than left to `loudnorm`, whose single pass
 * mangles anything as short as "Direct hit!".
 */
export const TARGET_DBFS = -18;
const MEAN = /mean_volume:\s*(-?\d+(?:\.\d+)?) dB/;

/** What the clip came out at, so the gain that reaches the target is known. */
export function meanDbfs(file: string): number {
  const report = spawnSync(
    'ffmpeg',
    ['-hide_banner', '-nostats', '-i', file, '-af', 'volumedetect', '-f', 'null', '-'],
    { encoding: 'utf8' },
  );
  const found = MEAN.exec(report.stderr);
  if (!found) throw new Error(`ffmpeg reported no level for ${file}`);
  return Number(found[1]);
}

/** Bring a rendered wav to the house level and write it out as the shipped mp3. */
export function publish(source: string, mp3: string): void {
  execFileSync('ffmpeg', [
    '-v',
    'error',
    '-y',
    '-i',
    source,
    '-af',
    `volume=${(TARGET_DBFS - meanDbfs(source)).toFixed(2)}dB,alimiter=limit=0.95`,
    '-codec:a',
    'libmp3lame',
    '-q:a',
    '5',
    mp3,
  ]);
}
