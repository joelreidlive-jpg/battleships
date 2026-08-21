# Contributing

## Branching and review

Trunk-based: short-lived branches off `main`, one pull request each, squash
merged. `main` is protected — no direct pushes, one approving review, and CI
green before merge.

Suggested branch protection for `main`:

- require a pull request with 1 approval, dismiss stale approvals on new commits
- require the `Lint, typecheck, test, build` and `CodeQL / Analyse` checks
- require branches to be up to date before merging
- no force pushes, no deletions, include administrators

## Commits

Conventional Commits, because the release notes and the version bump are
derived from them:

```
feat(ai): weight placements that explain an open hit
fix(rules): reject a shot after the campaign ends
docs(spec): regenerate after the scoring change
```

`feat` is a minor bump, `fix` a patch, and `!` or a `BREAKING CHANGE:` footer a
major one.

## Before you push

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm docs:check && pnpm build
```

`pnpm docs:check` is the one that catches people out. The published documents
are generated from the code, so a change to a game constant, an API route or
the database schema means running `pnpm docs` and committing the result.

## What needs a test

- Any change to `packages/rules`: the invariants in §13 of the technical
  specification are the checklist.
- Any change to targeting: rerun `pnpm bench` and update `expectedShots` in
  `packages/ai/src/doctrine.ts`, keeping the doctrines strictly ordered.
- Any new or changed API route: update `API_ROUTES` in `@bs/protocol` — a test
  diffs it against the routes Hono registers, in both directions.

Coverage thresholds are enforced on `packages/*` in CI.

## Releasing

Semantic Versioning. Tag `main`:

```bash
git tag v1.2.0 && git push origin v1.2.0
```

The release workflow verifies, builds and deploys, and the tag becomes the
version reported by `GET /api/health`. Rollback is deploying the previous tag.
