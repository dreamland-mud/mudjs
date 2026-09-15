import React from 'react';
import { usePrompt } from '../react-hooks';
import { t } from '../i18n';
// Faceted gem exported from Figma (node 1026:1934). Its base facets are painted
// with currentColor, so `.pbar.<type> .pbar-gem { color }` recolors the whole
// jewel per resource while the gold socket ring stays constant.
import gemSvg from './gem.svg?raw';

// Parchment vitals: gem-tipped pill bars (Figma nodes 1026:2005 empty track,
// 1026:1658 filled, 1026:1933 gem). Empty stone track + colored fill whose width
// is the value percent, a gem on the left indicating the resource, and value|max
// inside. Word captions are gone -- the gem is the visual type marker, so the
// resource name lives in aria-label and screen readers still hear "Health, N of M".
// One component, three configs: the modifier class (hp/mana/move) carries the
// gradient, rim, glow and gem colour as custom properties.
const Bar = ({ type, caption, v, max_v }) => {
  if (!max_v) return null;
  const pct = Math.max(0, Math.min(100, Math.floor((100 * v) / max_v)));
  return (
    <div
      className={`pbar ${type}`}
      role="progressbar"
      aria-label={caption}
      aria-valuenow={v}
      aria-valuemin={0}
      aria-valuemax={max_v}
    >
      <div className="pbar-fill" style={{ width: `${pct}%` }} />
      <span className="pbar-gem" aria-hidden="true" dangerouslySetInnerHTML={{ __html: gemSvg }} />
      <span className="pbar-val">
        <b>{v}</b>|{max_v}
      </span>
    </div>
  );
};

// Enemy health during combat: same bar, hp-red, no gem (the gem marks YOUR
// resource, not the target). Percent only.
const EnemyBar = ({ caption, percent }) => {
  if (!percent || percent <= 0) return null;
  const pct = Math.max(0, Math.min(100, percent));
  return (
    <div
      className="pbar enemy"
      role="progressbar"
      aria-label={caption}
      aria-valuenow={percent}
      aria-valuemin={1}
      aria-valuemax={100}
    >
      <div className="pbar-fill" style={{ width: `${pct}%` }} />
      <span className="pbar-val">
        {caption} <b>{percent}</b>%
      </span>
    </div>
  );
};

export default function Stats() {
  const prompt = usePrompt();
  const { hit, max_hit, mana, max_mana, move, max_move, fight } = prompt;
  const lang = prompt.lang;

  return (
    <div className="pbars">
      <Bar type="hp" caption={t('st.health', lang)} v={hit} max_v={max_hit} />
      <EnemyBar caption={t('st.enemy', lang)} percent={fight} />
      <Bar type="mana" caption={t('st.mana', lang)} v={mana} max_v={max_mana} />
      <Bar type="move" caption={t('st.moves', lang)} v={move} max_v={max_move} />
    </div>
  );
}
