import React from 'react'
import PanelItem from './panelItem'
import { Cnames, Dnames, Enames, Pnames, Tnames, Mnames } from './windowletsConstants';

// Column headers, localized by the player's `config language` (prompt.lang). Kept inline
// here until the app-wide i18n module lands; when it does, swap this map for useT().
const HEADERS = {
    en: { title: 'Affects on you', pro: 'Prot', det: 'Detect', trv: 'Travel', enh: 'Boost', mal: 'Curse', cln: 'Clan' },
    ru: { title: 'Воздействия на тебе', pro: 'Защита', det: 'Обнар', trv: 'Трансп', enh: 'Усилен', mal: 'Отриц', cln: 'Клан' },
    ua: { title: 'Впливи на тебе', pro: 'Захист', det: 'Виявл', trv: 'Трансп', enh: 'Підсил', mal: 'Негат', cln: 'Клан' },
};
function hdr(lang) { return HEADERS[lang] || HEADERS.en; }

// Legacy char-dict fallback for the old wire format ({a,z} strings of single-char keys).
// The server switches to the dynamic per-affect format ([{n,x}]); this branch keeps the
// panel working during the transition and can be deleted once the C++ bundle is live.
const LEGACY_NAMES = { pro: Pnames, det: Dnames, trv: Tnames, enh: Enames, mal: Mnames, cln: Cnames };

// Six fixed columns; membership is now driven by the server, not hardcoded here.
// color: 2 = green (active), 1 = red (maladictions); 3 = yellow (about to expire).
const COLUMNS = [
    { key: 'pro', type: 'protect', color: '2' },
    { key: 'det', type: 'detects', color: '2' },
    { key: 'trv', type: 'travel',  color: '2' },
    { key: 'enh', type: 'enhance', color: '2' },
    { key: 'mal', type: 'malad',   color: '1' },
    { key: 'cln', type: 'clan',    color: '2' },
];

function hasAffects(block) {
    if (block == null || block === 'none') return false;
    if (Array.isArray(block)) return block.length > 0;   // new format
    return block.a != null && block.a !== '';            // legacy {a,z}
}

// Draw one column. Handles BOTH the new dynamic format and the legacy char-dict format.
function AffectBlock(props) {
    const clr_active = 'fg-ansi-bright-color-' + props.color;
    const clr_zero = 'fg-ansi-bright-color-3';
    const rows = [];

    if (Array.isArray(props.block)) {
        // New format: server already localized `n`; `x` marks a zero-duration affect.
        props.block.forEach(function (aff, idx) {
            rows.push(<span key={idx} className={aff.x ? clr_zero : clr_active}>{aff.n}</span>);
        });
    } else {
        // Legacy format: {a,z} char strings mapped through the hardcoded RU dict.
        const names = props.bitNames || {};
        const active = props.block.a || '';
        const zero = props.block.z || '';
        for (const bit in names) {
            if (!names.hasOwnProperty(bit)) continue;
            let clr;
            if (zero.indexOf(bit) !== -1) clr = clr_zero;
            else if (active.indexOf(bit) !== -1) clr = clr_active;
            else continue;
            rows.push(<span key={bit} className={clr}>{names[bit]}</span>);
        }
    }

    if (rows.length === 0) return null;

    return (
        <div id={'pa-' + props.type} className="flexcontainer-column" data-hint={'hint-' + props.type}>
            <span style={{ color: '#d3d7cf' }}>{props.blockName}</span>
            { rows }
        </div>
    );
}

export default function AffectsItem(prompt) {
    const h = hdr(prompt.lang);

    return (
        <PanelItem title={h.title}>
            <div id="player-affects-table" className="flexcontainer-row flexcontainer-wrap " data-hint="hint-affects">
                { COLUMNS.map(function (c) {
                    if (!hasAffects(prompt[c.key])) return null;
                    return (
                        <AffectBlock
                            key={c.key}
                            block={prompt[c.key]}
                            blockName={h[c.key]}
                            bitNames={LEGACY_NAMES[c.key]}
                            color={c.color}
                            type={c.type}
                        />
                    );
                }) }
            </div>
        </PanelItem>
    );
}
