# Security

## Reporting

Report a vulnerability privately through GitHub's **Report a vulnerability**
button under the Security tab. Please do not open a public issue.

## What is defended

The whole secret of the game is where the alien fleet is, so that is what the
design protects.

- The alien deployment exists only inside the Durable Object that owns the
  campaign. It is never sent to the browser while a campaign is in progress,
  and a lint rule keeps the AI package out of the client bundle.
- Every shot is re-validated server-side against the server's own state —
  turn, bounds, and whether that cell was already fired at. A client-supplied
  fleet is re-validated before it is accepted.
- Identity is an opaque 32-byte token in `localStorage`. Only its SHA-256
  digest is stored, in both the Durable Object and D1, so neither store holds a
  credential.
- All randomness affecting play comes from `crypto.getRandomValues`.
  `Math.random` is a lint error.
- Every response carries `Content-Security-Policy: default-src 'self'`,
  `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` and
  `Referrer-Policy: no-referrer`.

## What is not

There are no accounts and no password reset, so anyone holding the token is the
player. Clearing browser storage abandons the career; there is no recovery.

## Supply chain

Dependencies are pinned by lockfile and installed with `--frozen-lockfile` in
CI. Dependabot raises weekly updates, and CodeQL runs on every pull request and
weekly on `main`.

## Secrets

There are no secrets in the repository and none in the client bundle. The
Cloudflare credentials used by the release workflow exist only as GitHub
Actions secrets (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`), scoped to
the `production` environment.
