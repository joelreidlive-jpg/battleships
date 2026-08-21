/**
 * Bindings for the Worker. Regenerate with `pnpm --filter @bs/api cf-typegen`
 * after changing `wrangler.jsonc`.
 */
declare namespace Cloudflare {
  interface Env {
    MATCH: DurableObjectNamespace<import('./src/match-do.js').MatchDO>;
    DB: D1Database;
    ASSETS: Fetcher;
    /** Injected at deploy time from the release tag. */
    APP_VERSION: string;
  }
}
interface Env extends Cloudflare.Env {}
