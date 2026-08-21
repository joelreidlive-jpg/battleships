# Orbital Battleships Command — game guide

> **Generated document — do not edit.**
> Produced by `pnpm docs` from the code that implements the behaviour it
> describes. CI runs `pnpm docs:check`, so this file cannot drift from the
> engine, the AI, the API surface or the database schema.

## The premise

An alien invasion fleet has taken up station beyond the orbit of the Moon. You
command Earth's remaining defence wing. Neither side can see the other: both
fleets sit hidden on a 10x10 sector grid, and the only way to find an enemy hull
is to fire into a sector and see what comes back.

It is Battleship. The rules, the grid, the fleet sizes and the turn order are
the classic ones; the fiction, the artwork and the scoring are ours.


## The board

Each side has one grid of 10 columns (A–J) by 10 rows (1–10): 100 sectors.
A sector is named by its column letter and row number, so `B7` is the seventh
row of the second column.

- **Invasion Grid** — what you know about the alien fleet. You fire here.
- **Home Grid** — your own fleet, and every shot the invader has taken at it.


## The fleets

Both sides field the same 10 hulls under different names. Where a class is
deployed more than once the individual craft are numbered — Ion Cruiser I and
Ion Cruiser II — and each is positioned, damaged and destroyed separately.

| Count | Sections each | Earth Defence Wing | Invasion Fleet | Notes |
| --- | --- | --- | --- | --- |
| 1 | 4 | Solar Battleship | Hive Dreadnought | Four sections of armoured spine. The flagship, and the hardest hull to hide. |
| 2 | 3 | Ion Cruiser | Swarm Cruiser | Three sections of ion lance. Fast enough to reposition between waves. |
| 3 | 2 | Nova Destroyer | Needle Skiff | Two sections. Numerous, and the hull that decides most endgames. |
| 4 | 1 | Void Submarine | Shadow Lurker | A single section running dark. Impossible to deduce, and found only by luck. |

That is **10 hulls, 20 sections** per side. A hull occupies that many adjacent sectors in a
straight line, north–south or east–west. Hulls may not overlap and may not run
off the edge of the grid, but they *may* sit alongside one another — the
standard rule, and one a careful player can use to hide a short hull against a
long one.

You may position your fleet by hand, or let Fleet Command deploy it for you.
The invader's fleet is positioned by the server and is never sent to your
browser until the battle ends.


## How a turn works

1. **You fire** at one sector of the Invasion Grid that you have not already
   fired on.
2. The result is announced immediately:
   - **Miss** — nothing there.
   - **Hit** — you struck a hull, but you are *not* told which one.
   - **Destroyed** — that hit was the hull's last intact section, and that
     individual craft is named. A single-section submarine is therefore
     destroyed by the first hit that finds it.
3. **The invader fires back** at one sector of your Home Grid, and the same
   three results apply.

Turn order strictly alternates. A hit does not earn a second shot, so both
sides always have taken the same number of shots — which is what makes
accuracy worth scoring.


## Winning

The first side to destroy all 10 of the opponent's hulls — all 20 sections — wins
immediately. Because you fire first, the invader does not get a reply to the
shot that destroys its last hull.

If you abandon the defence, the campaign is recorded as a loss and the alien
deployment is revealed.


## Scoring

Score accrues as you fire, so the number on screen during a battle is real. The
three bonuses marked *on victory* are paid only if you win.

| Line | Value | When |
| --- | --- | --- |
| Hit | 100 | Per section struck |
| Hull destroyed | 60 x sections | When a hull is destroyed, so a 4-section hull pays 240 |
| Wasted ordnance | -10 | Per shot beyond the 20 a flawless campaign needs |
| Accuracy bonus | 1000 x hit rate | On victory |
| Fleet preserved | 200 | Per section of *your* fleet still intact, on victory |
| Victory | 1000 | On victory |

The subtotal is floored at zero, then multiplied by the doctrine multiplier
below. A flawless campaign — 20 shots, 20 hits, nothing lost — against the
hardest doctrine scores **18,400**, which is the highest score the game can
produce.


### A worked example

A campaign against **Raider Flight** in which you find every hull without a wasted
shot, while the invader lands three hits on your Solar Battleship:

| Line | Score |
| --- | --- |
| Hits | 2,000 |
| Hulls destroyed | 1,200 |
| Accuracy bonus | 1,000 |
| Fleet preserved | 3,400 |
| Victory | 1,000 |
| Wasted ordnance | 0 |
| Subtotal | 8,600 |
| Doctrine multiplier | x1.5 |
| **Total** | **12,900** |


## Invasion doctrines

Difficulty is the invader's targeting doctrine. Nothing else changes: the
grid, the fleets and the scoring are identical at every level.

| Doctrine | Score multiplier | Mean shots to clear a fleet | Mean shots to the last multi-section hull | How it aims |
| --- | --- | --- | --- | --- |
| Scout Wave | x1 | 96.7 | 95.5 | Fires at a uniformly random cell it has not tried before, ignoring its own hits. |
| Raider Flight | x1.5 | 85.6 | 66.4 | Sweeps cells on a diagonal whose spacing equals the smallest hull still afloat; on a hit, works outward along the axis the hits establish. |
| Overmind | x2 | 85.5 | 50.3 | Counts, for every untried cell, how many placements of the surviving hulls are consistent with its shot history — weighting those that explain a known hit — and fires at the maximum. |

Both figures are measured over 300 simulated campaigns; 20 shots is perfect and
100 is the whole grid. The second column is the fairer comparison: a
single-section submarine leaves nothing to deduce, so the last four kills are a
search that costs every doctrine about the same, which flattens the first
column. On the hulls where skill applies, Overmind needs roughly half the
shots Scout Wave does.


## Career

Scores accumulate across campaigns against an anonymous identity held in your
browser. There is no sign-up; clearing your browser storage starts a new
career.

| Rank | Lifetime score |
| --- | --- |
| Cadet | 0 |
| Flight Officer | 5,000 |
| Squadron Leader | 20,000 |
| Wing Commander | 50,000 |
| Star Marshal | 100,000 |
| Defender of Earth | 250,000 |


## Not in this release

Stated so nobody plans around them:

- No human-versus-human play. The architecture allows it — the invader submits
  shots through the same code path a second player would — but no transport or
  matchmaking exists.
- No accounts, and therefore no cross-device career.
- No global leaderboard; the career record is per browser.
- No sound.
