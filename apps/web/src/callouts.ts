/**
 * Every line the bridge crew and the Kraal say, and which voice says it.
 *
 * A campaign runs long enough to hear each of these several times, so every
 * moment has a handful of readings of the same thought and one is picked at
 * random, never the one just heard. Tone and intent are fixed per moment: the
 * crew are urgent and steady, the Kraal is contemptuous.
 *
 * `tools/audio/render.ts` reads this file and renders `clip` for each line, so
 * a browser with no British voice installed still hears the right one. Add a
 * line here, then rerun `pnpm audio` and commit the clip.
 */

/** Which speaker renders the line; the profiles live in the render tool. */
export type Voice = 'crew' | 'crew-2' | 'crew-3' | 'crew-4' | 'kraal';

export interface Callout {
  readonly line: string;
  /** Pre-rendered file under `public/audio`, used when no voice is installed. */
  readonly clip: string;
  readonly voice: Voice;
  /** Pitch for the browser's own synthesiser, on the crew's lines only. */
  readonly pitch: number;
}

/** The player struck an invader hull. */
export const HIT_CALLOUTS: readonly Callout[] = [
  { line: 'Direct hit!', clip: 'direct-hit.mp3', voice: 'crew', pitch: 1.6 },
  { line: 'Target hit, Captain!', clip: 'hit-2.mp3', voice: 'crew-2', pitch: 1.3 },
  { line: "That's a hit! Good shooting!", clip: 'hit-3.mp3', voice: 'crew-3', pitch: 1.75 },
  { line: 'Solid hit on the invader!', clip: 'hit-4.mp3', voice: 'crew-4', pitch: 1.1 },
  { line: 'Hit confirmed! Her hull is burning!', clip: 'hit-5.mp3', voice: 'crew-3', pitch: 1.5 },
  { line: 'Right on target, Captain! Beautiful shot!', clip: 'hit-6.mp3', voice: 'crew', pitch: 1.45 },
  { line: 'We struck her clean, Captain!', clip: 'hit-7.mp3', voice: 'crew-2', pitch: 1.2 },
];

/** The player destroyed an invader hull, and the Kraal is unimpressed. */
export const ALIEN_LOSS_CALLOUTS: readonly Callout[] = [
  { line: 'You destroyed one of my ships, but the Kraal have many!', clip: 'kraal-have-many.mp3', voice: 'kraal', pitch: 0.4 },
  { line: 'One hull is nothing. The Kraal are numberless!', clip: 'kraal-numberless.mp3', voice: 'kraal', pitch: 0.4 },
  { line: 'A lucky strike, human. It changes nothing!', clip: 'kraal-lucky.mp3', voice: 'kraal', pitch: 0.4 },
  { line: 'Burn one of ours, and ten more take its place!', clip: 'kraal-ten-more.mp3', voice: 'kraal', pitch: 0.4 },
];

/** The invader struck the player's fleet. */
export const INCOMING_CALLOUTS: readonly Callout[] = [
  { line: 'We will destroy you!', clip: 'we-will-destroy-you.mp3', voice: 'kraal', pitch: 0.4 },
  { line: 'Your world burns next, human!', clip: 'kraal-world-burns.mp3', voice: 'kraal', pitch: 0.4 },
  { line: 'Earth will fall, and the Kraal shall feast!', clip: 'kraal-earth-falls.mp3', voice: 'kraal', pitch: 0.4 },
  { line: 'You cannot stop us. Nothing ever has!', clip: 'kraal-cannot-stop.mp3', voice: 'kraal', pitch: 0.4 },
];

/** The player lost a hull, and the crew take it. */
export const OWN_LOSS_CALLOUTS: readonly Callout[] = [
  { line: 'We lost a ship, Captain, but we are okay. Earth needs us!', clip: 'ship-lost.mp3', voice: 'crew-2', pitch: 1.1 },
  { line: 'Ship down, Captain. We are still in this fight!', clip: 'ship-lost-2.mp3', voice: 'crew-4', pitch: 1 },
  { line: 'They took one of ours, Captain. The fleet holds. For Earth!', clip: 'ship-lost-3.mp3', voice: 'crew', pitch: 1.2 },
  { line: 'We are hit hard, Captain, but the line is not broken!', clip: 'ship-lost-4.mp3', voice: 'crew-3', pitch: 1.15 },
];

/** One hull left. */
export const LAST_HULL_CALLOUTS: readonly Callout[] = [
  { line: 'We are down to one ship, Captain. Hang in there!', clip: 'last-ship.mp3', voice: 'crew-2', pitch: 1.2 },
  { line: 'One ship left, Captain. Hold the line!', clip: 'last-ship-2.mp3', voice: 'crew-4', pitch: 1.1 },
  { line: 'Last hull standing, Captain. Everything we have got!', clip: 'last-ship-3.mp3', voice: 'crew-3', pitch: 1.3 },
];

/** Every line, for the renderer. */
export const CALLOUTS: readonly Callout[] = [
  ...HIT_CALLOUTS,
  ...ALIEN_LOSS_CALLOUTS,
  ...INCOMING_CALLOUTS,
  ...OWN_LOSS_CALLOUTS,
  ...LAST_HULL_CALLOUTS,
];
