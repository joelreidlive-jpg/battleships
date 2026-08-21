import { useState } from 'react';
import productGuide from '../../../docs/product/GAME.md?raw';
import technicalSpec from '../../../docs/technical/SPEC.md?raw';
import { Markdown } from './markdown.js';

/**
 * The two published documents, served inside the game itself.
 *
 * They are imported from `docs/`, which is generated from the source of truth
 * in `@bs/rules` and `@bs/ai` and verified in CI, so what a player reads here
 * is what the code does — there is no second copy to fall out of date.
 */
export function Manual({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<'product' | 'technical'>('product');

  return (
    <div className="manual" role="dialog" aria-label="Field manual">
      <div className="manual__inner">
        <header>
          <div className="controls">
            <button
              type="button"
              className={tab === 'product' ? 'primary' : ''}
              onClick={() => setTab('product')}
            >
              Game guide
            </button>
            <button
              type="button"
              className={tab === 'technical' ? 'primary' : ''}
              onClick={() => setTab('technical')}
            >
              Technical specification
            </button>
          </div>
          <button type="button" onClick={onClose} aria-label="Close">
            Close
          </button>
        </header>
        <article className="prose">
          <Markdown source={tab === 'product' ? productGuide : technicalSpec} />
        </article>
      </div>
    </div>
  );
}
