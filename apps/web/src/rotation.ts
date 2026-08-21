/**
 * Picks a line at random, never the one just heard.
 *
 * A campaign lands dozens of hits, so a fixed order becomes a jingle and plain
 * random repeats itself often enough to sound broken. Excluding the previous
 * pick costs nothing and is what stops "Direct hit!" landing twice in a row.
 */
export class Rotation<T> {
  private last = -1;

  /** `random` returns [0, 1); it is passed in so a test can drive the choice. */
  constructor(
    private readonly items: readonly T[],
    private readonly random: () => number,
  ) {
    if (items.length === 0) throw new Error('a rotation needs at least one line');
  }

  next(): T {
    const choices = this.items.length;
    if (choices === 1) return this.items[0];
    // Nothing is recent yet, so any line will do; afterwards draw from the
    // others and map back past the one just used, which keeps each of them
    // equally likely.
    const index =
      this.last < 0 ? this.draw(choices) : this.skipPast(this.draw(choices - 1), this.last);
    this.last = index;
    return this.items[index];
  }

  private draw(choices: number): number {
    return Math.min(Math.floor(this.random() * choices), choices - 1);
  }

  private skipPast(drawn: number, used: number): number {
    return drawn >= used ? drawn + 1 : drawn;
  }

  /** A new campaign: the previous campaign's last line is no longer recent. */
  reset(): void {
    this.last = -1;
  }
}
