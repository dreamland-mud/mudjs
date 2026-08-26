import React from 'react'
import PanelItem from './panelItem'
import { t } from '../../i18n';

// Six fixed columns; membership is driven by the server, not hardcoded here.
// Base column color: 2 = green (buffs), 1 = red (maladictions) -- kept for the active state.
// Duration only adds two overrides on top: permanent = cyan (6), about to expire = yellow (3).
// See affColor().
const COLUMNS = [
    { key: 'pro', type: 'protect', color: '2' },
    { key: 'det', type: 'detects', color: '2' },
    { key: 'trv', type: 'travel',  color: '2' },
    { key: 'enh', type: 'enhance', color: '2' },
    { key: 'mal', type: 'malad',   color: '1' },
    { key: 'cln', type: 'clan',    color: '2' },
];

function hasAffects(block) {
    return Array.isArray(block) && block.length > 0;
}

// Color one affect by its remaining duration `d` (ticks). Negative durations are
// non-expiring: -1 = permanent, -2 = bound to worn equipment (set bonuses) -- both
// are stable, so both read as cyan, not as "about to expire".
//   maladictions (red column) -> always red: a curse ending is not a buff-warning,
//                                and a permanent curse is still bad news
//   permanent / equipment-bound (d < 0) -> light cyan  ({C, ANSI bright 6)
//   buff about to expire (0-1 ticks)     -> yellow (bright 3)
//   otherwise                            -> column base color (green buffs)
function affColor(aff, baseColor) {
    const d = aff.d;
    if (baseColor === '1') return 'fg-ansi-bright-color-1';               // maladictions -> always red
    if (d != null && d < 0) return 'fg-ansi-bright-color-6';             // permanent / set-bound -> cyan
    if (d != null && d >= 0 && d <= 1) return 'fg-ansi-bright-color-3';  // about to expire -> yellow
    return 'fg-ansi-bright-color-' + baseColor;                          // otherwise -> column base
}

// Draw one column: the server already localized each affect's label `n`.
function AffectBlock(props) {
    const rows = props.block.map(function (aff, idx) {
        return <span key={idx} className={affColor(aff, props.color)}>{aff.n}</span>;
    });

    if (rows.length === 0) return null;

    return (
        <div id={'pa-' + props.type} className="flexcontainer-column" data-hint={'hint-' + props.type}>
            <span style={{ color: '#d3d7cf' }}>{props.blockName}</span>
            { rows }
        </div>
    );
}

export default function AffectsItem(prompt) {
    const l = prompt.lang;

    return (
        <PanelItem storageKey="affects" title={t('aff.title', l)}>
            <div id="player-affects-table" className="flexcontainer-row flexcontainer-wrap " data-hint="hint-affects">
                { COLUMNS.map(function (c) {
                    if (!hasAffects(prompt[c.key])) return null;
                    return (
                        <AffectBlock
                            key={c.key}
                            block={prompt[c.key]}
                            blockName={t('aff.' + c.key, l)}
                            color={c.color}
                            type={c.type}
                        />
                    );
                }) }
            </div>
        </PanelItem>
    );
}
