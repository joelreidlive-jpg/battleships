import productGuide from '../../../docs/product/GAME.md?raw';
import { Markdown } from './markdown.js';

/**
 * The game guide, served inside the game itself.
 *
 * It is imported from `docs/`, which is generated from the source of truth in
 * `@bs/rules` and `@bs/ai` and verified in CI, so what a player reads here is
 * what the code does — there is no second copy to fall out of date. The
 * technical specification is deliberately not offered here: it is written for
 * whoever rebuilds the game, not for whoever plays it.
 */
export function Manual({ onClose }: { onClose: () => void }) {
  return (
    <div className="manual" role="dialog" aria-label="Field manual">
      <div className="manual__inner">
        <header>
          <h2>Field manual</h2>
          <button type="button" onClick={onClose} aria-label="Close">
            Close
          </button>
        </header>
        <article className="prose">
          <Markdown source={productGuide} />
        </article>
      </div>
    </div>
  );
}
