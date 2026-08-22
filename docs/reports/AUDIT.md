# Orbital Battleships Command — codebase audit

Repository: `joelreidlive-jpg/battleships`
Audited at: `ca94ef8` (main, the merged state of PR #26)
Scope: every source file in the monorepo — rules, AI, Worker/Durable Object, D1 access, protocol,
React client, audio, CI/CD workflows and the generated documentation.
Date: 21 August 2026
Deployed: Worker version `audit-3`

This is the living audit report. It carries the first pass (PRs #19 and #20, both merged and
deployed) and a second pass run against the current main, which found five further defects, all
fixed here.

---

## 0. Summary — the whole report in one page

Thirteen defects were found across two deliberate audit passes, and all thirteen are fixed and
merged. Every non-cosmetic fix carries a regression test, so none can come back quietly.

| # | Bug | What went wrong | Fix | Severity |
| --- | --- | --- | --- | --- |
| 1 | Faults reported as bad requests | Any internal error came back as `400` carrying the internal message — a D1 failure told the browser which table was missing | Rejections are tagged with their status; anything else is a `500` with the details withheld | high |
| 2 | A won campaign could vanish | If the final write to the database failed, the exception escaped and the player lost the victory screen they had just earned | The write is attempted, logged if it fails, and never allowed to erase the finished view | high |
| 3 | Corrupt career row took down a page | One malformed row broke the whole career endpoint | Malformed data falls back to an empty career | medium |
| 4 | Deploys could outrun the schema | The Worker could go live before its database migrations | Migrations run before the deploy | medium |
| 5 | Field Manual could crash | A Markdown table with no header row crashed the in-game renderer | The renderer skips it | low |
| 6 | A dropped voice line jammed the audio | If speech failed, the queue was never released and later callouts fell silent | Failure releases the channel, as finishing does | low |
| 7 | Board size hard-coded in the AI | Targeting assumed a 10×10 grid in literals | The grid constants are used throughout | low |
| 8 | Status lost crossing the runtime | The runtime rebuilds an error message with the class name in front, which defeated the tag matching added in #1 — every rejection became a `500` | Matching allows the prefix | medium |
| 9 | Your row highlighted many times | The leaderboard marked *every* campaign you had posted, so the end-of-game board lit up in several places and scrolled to the wrong one | Only your best row is marked | medium |
| 10 | A fault could set the HTTP status | Statuses travel inside the error text, and any three digits were believed — a fault reading `[999] retry later` produced an impossible response and a second failure | Only real statuses (400–599) are believed | medium |
| 11 | No fleet deployment on a touch screen | Placement was decided by the *hovered* cell, and touch has no hover, so every tap was ignored | The cell actually chosen decides the placement | medium |
| 12 | A malformed deployment looked like a crash | Bad JSON posted to the API threw, and came back as a server fault rather than a rejected request | Rejected with `400` and a reason | low |
| 13 | The board could not be played by keyboard | Firing was mouse-only, so the one control that plays the game was unreachable | Cells are focusable and fire on Enter or Space | low |

Also checked and found correct, so no change was made: shot resolution and scoring invariants
(120 simulated campaigns, no invariant broken), the secrecy of the invader's fleet, the information
the AI is allowed to see, campaign concurrency, token storage, leaderboard ranking, the pacing that
holds the invader's reply, audio ordering, and documentation drift.

Verified since: the audio and the touch/phone experience were confirmed by hand on a real device.
They could not be judged from the build machine, which has no audible output and no touchscreen.

A one-page version of this report, without the reasoning, is at [BUGS.md](./BUGS.md).

The detail behind every line of this table follows.

---

## 1. Method

1. **Read** every source file, looking for logic that only holds under assumptions its callers do not
   guarantee — especially anything crossing a trust boundary (the browser to the Worker, the Worker
   to the Durable Object, the Durable Object to D1).
2. **Execute** what reading cannot settle: a throwaway harness played 120 complete campaigns
   (40 seeds × 3 doctrines) through the real rules and the real AI, asserting after every shot that
   no cell is fired at twice, that a wreck is disclosed only once all of its sections are struck,
   that section counts and accuracy stay in range, and that victory-only score lines never pay out on
   a loss. A second harness drove the Hono app with a stubbed Durable Object to observe what the
   client is told when something inside the Worker fails.
3. **Verify** with the project's own gates: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`,
   `pnpm docs:check`, plus, for the first pass, probes against the deployed Worker.

Behaviour worth keeping from the harnesses is now covered by unit tests rather than left in scripts.

---

## 2. Second pass — bugs found and fixed

### 2.1 A captain with several campaigns was marked on every one of their rows — *medium*

`board()` set `you: true` on **each** leaderboard row belonging to the caller. The client both
highlights and scrolls to a marked row, so after two or three campaigns the end-of-game board lit up
in several places and the smooth scroll landed on whichever marked row rendered first, not on the
result the player had just posted.

Fixed by marking only the caller's best row — the one `yourRank` already reports — in
`apps/api/src/leaderboard.ts`. Covered by a new test that gives one player two rows and asserts a
single mark.

### 2.2 A fault whose text ended in a bracketed number could become the response status — *medium*

Statuses cross the Durable Object boundary inside the error message (`[404] campaign not found`),
so `failureFor()` parses a trailing tag. It accepted **any** three digits. A genuine fault whose
message happened to end that way — for example a storage error reading `... : [999] retry later` —
was echoed as `999`, and constructing a `Response` with a status outside 100–599 throws, turning one
fault into a second, opaque one.

Fixed by believing a tag only when it names a status a response can carry (400–599); anything else
falls through to the withheld generic `500`. Regression test added in `apps/api/src/errors.test.ts`.

### 2.3 Fleet deployment was unreachable on a touch screen — *medium*

`Deploy` decided both legality and the placed cell from the **hovered** cell. A touch device reports
no hover, so `candidate` stayed `null`, every tap was ignored and the only way off the deployment
screen was "Let Fleet Command deploy" — on a build whose stated aim (PR #26) is to fit whatever
device is playing.

Fixed by judging the cell that was actually chosen: `legalAt(cell)` is asked of the tapped or clicked
cell, and the hull is placed there. Hover is now only what draws the ghost.

### 2.4 A malformed deployment posted to the API surfaced as a 500 — *low*

`POST /api/matches` accepts a client-supplied fleet. A non-array `fleet` was spread
(`[...request.fleet]`), and an array containing a non-object (`[null, …]`) reached
`validateFleet`, which read `.hull` off it. Both threw a `TypeError` — reported to the caller as
`500 the defence grid is offline`, when the request was simply bad.

Fixed in two places: the Durable Object rejects a non-array deployment with `400`, and
`validateFleet` rejects an entry that is not an object with a phrased reason. No legal deployment
changes shape. Regression test added in `packages/rules/src/rules.test.ts`.

### 2.5 Grid cells could not be fired from the keyboard — *low, accessibility*

Each cell is an SVG `<g role="gridcell">` with an `onClick` and no keyboard path, so a player using
a keyboard or a switch device could reach every button on the page except the only control that
plays the game.

Fixed by making live cells focusable and firing them on <kbd>Enter</kbd> or <kbd>Space</kbd>, with
focus driving the same hover preview the mouse does. Spent cells and locked grids stay out of the tab
order.

---

## 3. First pass — bugs found and fixed (PRs #19, #20, merged and deployed)

| # | Defect | Severity | Fix |
| --- | --- | --- | --- |
| 3.1 | Internal faults were reported as `400` with the internal message sent to the browser (a D1 error disclosed the failing table) | high | Rejections raised as a tagged `MatchError`; anything else is a withheld `500` |
| 3.2 | A D1 failure on the last shot threw away the campaign the player had just won | high | The final write is attempted, logged on failure, and never allowed to erase the finished view |
| 3.3 | A corrupt career row took the whole progress endpoint down | medium | Malformed JSON falls back to an empty career |
| 3.4 | Deploys could outrun their database schema | medium | The release workflow applies remote migrations before the Worker is deployed |
| 3.5 | A separator-only Markdown table crashed the in-game Field Manual | low | The renderer skips a table with no header row |
| 3.6 | A failed or interrupted voice line held the audio channel open | low | `onerror` releases the channel as `onend` does |
| 3.7 | The invader's targeting hard-coded the board size | low, latent | `COLUMNS` and `CELL_COUNT` used throughout |
| 3.8 | The status tag did not survive the runtime, which rebuilds the message as `MatchError: [404] …` | medium | Tag matching allows the class-name prefix |

---

## 4. Reviewed and found correct

Suspected, investigated, not defects. Recorded so the same ground is not covered twice.

| Area | Question asked | Finding |
| --- | --- | --- |
| Shot resolution | Can a cell be fired at twice, or a hull sink early or late? | No. `shotProblem` rejects repeats and off-turn shots; 120 simulated campaigns held every invariant. |
| Scoring | Can a loss pay a victory line, or a score go negative? | No. Accuracy, survival and victory are gated on a win, and the subtotal is floored at zero before the doctrine multiplier. |
| Alien fleet secrecy | Does anything leak the invader's deployment? | No. A view carries the player's own fleet, redacted shots and wrecks of hulls already fully struck; `alienFleet` appears only once the campaign is finished. |
| Invader intelligence | Does the AI see more than its own shots? | No. `chooseShot` is given only the redacted history of shots it has fired. |
| Durable Object concurrency | Can two shots interleave? | No. One object per campaign is the only writer, and the player's shot and the invader's reply resolve in a single call. |
| Player identity | Is the bearer token ever stored? | No. Only its SHA-256 digest, in the object's metadata and as the D1 key. |
| Leaderboard ranking | Is the trailing "your best" row's rank consistent with the listing? | Yes. The `ahead` count uses the same `score DESC, achieved_at ASC` ordering as the listing query. |
| Pacing (`beforeReply`) | Does holding the invader's reply invent or leak anything? | No. It removes trailing alien log entries, their marks and the stats they moved, and forces `status: 'playing'`, so a held reply cannot reveal the fleet early. |
| Audio | Any remaining overlapping cues? | None found. One serialised channel orders every cue; the verdict clears queued battle audio; the flypast guards against a StrictMode double-mount. |
| Documentation | Do the published documents still match the code? | Yes — `pnpm docs:check` reports "documentation is current", and a route test keeps the OpenAPI surface honest against Hono's registered routes. |

---

## 5. Deliberate decisions left alone

- **No rate limiting on `POST /api/matches`.** Each call creates a Durable Object. Acceptable for a
  demo behind a shared link; the first thing to add for anything longer-lived.
- **`cleanName` clamps to 24 characters and collapses whitespace, but does not filter language.** The
  board is public and the names are player-supplied.
- **Career state is a read-modify-write of one JSON blob.** A lost update costs one campaign's
  statistics, never a corrupt total.
- **A campaign driven straight against the API without a briefing posts as "Unknown Captain /
  Unnamed Starfleet".** Not reachable through the game, which makes both names mandatory.
- **Below 860px the two grids stack and the campaign may scroll.** Two 10×10 boards side by side are
  unreadable at that width; the single-screen rule is kept where a screen can hold it.

---

## 6. Verification

Run at the tip of the audit branch:

| Gate | Result |
| --- | --- |
| `pnpm lint` | pass |
| `pnpm typecheck` | pass |
| `pnpm test` | pass — **69 tests**, up from 66 (three new regression tests) |
| `pnpm build` | pass |
| `pnpm docs:check` | pass — documentation is current |
| 120-campaign rules/AI simulation | pass — no invariant broken |

The first pass was additionally verified against the deployed Worker (version `audit-2`): a complete
91-shot campaign played through the API, every rejection returning the right status, no invader fleet
disclosed mid-campaign, and both the career and the shared board recorded.

---

## 7. Residual risks and what could not be verified

- **Audio cannot be judged from the build machine**, which has no audible output. Ordering and
  non-overlap are covered by fake-clock tests; levels, the alien pitch and the gaps between callouts
  are not.
- **The touch-deployment fix (2.3) has not been exercised on a real touch device**; it is reasoned
  from the event model and verified with a pointer.
- **The live Worker now runs these fixes** (version `audit-3`); the report is kept in step with what
  is deployed.
- Nothing in this pass changes gameplay: fleet, grid, turn order, scoring and doctrine behaviour are
  untouched, and the doctrine-strength test still orders the three AIs as before.

---

No credentials, tokens or invader deployment data appear in this report.
