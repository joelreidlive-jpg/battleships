# Orbital Battleships Command — bugs found and how they were fixed

One page. Thirteen defects were found across two deliberate audit passes of the whole codebase, and
all thirteen are fixed and merged. Every non-cosmetic fix carries a regression test, so none can come
back quietly.

| # | Bug | How it was fixed | Severity |
| --- | --- | --- | --- |
| 1 | Any internal error came back to the browser as a `400` carrying the internal message — a database failure told the client which table was missing | Rejections carry their own status; anything unexpected is a `500` with the detail withheld and logged instead | high |
| 2 | If the final database write failed at the end of a game, the exception escaped and the player lost the victory screen they had just earned | The write is attempted and logged if it fails, but can never erase the finished game | high |
| 3 | One malformed stored row broke the whole career endpoint | Malformed data falls back to an empty career | medium |
| 4 | A deploy could go live before its database migrations | Migrations run before the deploy in the release workflow | medium |
| 5 | A Markdown table without a header row crashed the in-game Field Manual | The renderer skips it | low |
| 6 | If a spoken line failed, the audio queue was never released and every later callout fell silent | Failure releases the channel exactly as finishing does | low |
| 7 | The AI assumed a 10×10 board in hard-coded literals | The shared grid constants are used throughout | low |
| 8 | The runtime rebuilds an error message with the class name in front, which defeated the status tagging from bug 1 — every rejection became a `500` again | The match allows the prefix | medium |
| 9 | The end-of-game leaderboard highlighted *every* campaign you had ever posted and scrolled to the wrong one | Only your best row is marked | medium |
| 10 | Statuses travel inside the error text and any three digits were believed, so a fault reading `[999] retry later` produced an impossible response and a second failure | Only real HTTP statuses (400–599) are believed | medium |
| 11 | The fleet could not be deployed on a touch screen: placement followed the *hovered* cell, and touch has no hover, so every tap was ignored | The cell actually chosen decides the placement | medium |
| 12 | Malformed JSON posted to the API came back as a server fault rather than a rejected request | Rejected with `400` and a reason | low |
| 13 | The board could not be played by keyboard — firing was mouse-only, so the one control that plays the game was unreachable | Cells are focusable and fire on Enter or Space | low |

**Also checked and found correct**, so nothing was changed: shot resolution and scoring invariants
(120 simulated campaigns, no invariant broken), the secrecy of the invader's fleet, what the AI is
allowed to see, campaign concurrency, token storage, leaderboard ranking, the pacing that holds the
invader's reply, audio ordering, and documentation drift.

**How they were found.** Two structured passes over every source file in the monorepo — rules, AI,
Worker and Durable Object, database access, protocol, React client, audio, CI workflows and the
generated documentation — reading each failure path rather than only the happy one, plus simulated
campaigns and probes against the deployed game. Since then a browser test, an accessibility scan and
a phone-layout check run on every push, so this class of regression is now caught by CI rather than
by reading.

**The full report** — method, the reasoning behind each defect, the code involved, the regression
test that holds it, and a live verification pass against the deployed game — is at
[docs/reports/AUDIT.md](./AUDIT.md).
