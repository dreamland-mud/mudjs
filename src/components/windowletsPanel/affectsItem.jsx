import React from 'react'
import PanelItem from './panelItem'
import { t } from '../../i18n';
import './affects.css';

// Affect families in display order; membership is driven by the server, not
// hardcoded here. Base colour: 2 = green (buffs), 1 = red (maladictions) -- kept
// for the active state. Duration only adds two overrides on top: permanent = cyan
// (6), about to expire = yellow (3). See affColor().
//
// The six columns and their name headers are gone (Figma node 1025-1635): every
// affect now flows into ONE wrapping block of pill chips. This list still drives
// the ORDER (maladictions first -- bad news leads) and the colour SOURCE of each
// chip, it just no longer draws a separate column per family.
const COLUMNS = [
    { key: 'mal', type: 'malad',   color: '1' },   // maladictions/curses first: bad news leads
    { key: 'pro', type: 'protect', color: '2' },
    { key: 'det', type: 'detects', color: '2' },
    { key: 'trv', type: 'travel',  color: '2' },
    { key: 'enh', type: 'enhance', color: '2' },
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

// Sort key: soonest-to-expire first, non-expiring last. A permanent or
// equipment-bound affect (d < 0), or one with no duration, never runs out, so it
// sorts to the very end (cyan/blue last); a short timer sorts to the front
// (yellow first). Maladictions are pulled ahead of everything separately (red
// always first), so within each group this is a plain "time left" order.
function timeRank(aff) {
    const d = aff.d;
    if (d == null || d < 0) return Number.POSITIVE_INFINITY;
    return d;
}

export default function AffectsItem(prompt) {
    const l = prompt.lang;

    // Flatten every populated family into one list, then sort by urgency:
    // maladictions (red) always first, then by time left -- soonest to expire
    // first (yellow), non-expiring last (cyan/blue). The server already localized
    // each affect's label `n`; the chip's text colour carries its state via
    // affColor(), the same convention the old columns used.
    const items = [];
    COLUMNS.forEach(function (c) {
        if (!hasAffects(prompt[c.key])) return;
        prompt[c.key].forEach(function (aff, idx) {
            items.push({ aff: aff, color: c.color, key: c.key + '-' + idx });
        });
    });
    items.sort(function (a, b) {
        const am = a.color === '1', bm = b.color === '1';
        if (am !== bm) return am ? -1 : 1;                 // red maladictions always first
        return timeRank(a.aff) - timeRank(b.aff);          // then soonest-expiring first
    });
    const chips = items.map(function (it) {
        return <span key={it.key} className={'aff-chip ' + affColor(it.aff, it.color)}>{it.aff.n}</span>;
    });

    return (
        <PanelItem storageKey="affects" title={t('aff.title', l)}>
            <div id="player-affects-table" className="affects-flat" data-hint="hint-affects">
                { chips }
            </div>
        </PanelItem>
    );
}
