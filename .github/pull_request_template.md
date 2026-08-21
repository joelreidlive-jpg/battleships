## What and why

<!-- What changes, and what problem it solves. Link the issue if there is one. -->

## How it was verified

<!-- Tests added or changed; anything exercised by hand. -->

## Checklist

- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build` pass locally
- [ ] `pnpm docs:check` passes, or `pnpm docs` was rerun and the result committed
- [ ] Rules or AI changes have tests, and `pnpm bench` was rerun if targeting changed
- [ ] No secrets, and nothing that reveals the alien deployment to the client
