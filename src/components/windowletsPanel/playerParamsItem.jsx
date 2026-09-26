import React from 'react'
import PanelItem from "./panelItem";
import { openWidgetHelp } from '../helpSheet/HelpSheet';
import { t } from '../../i18n';
import './affects.css';

// prompt.p1: ps - permanent stats [str, int, wis, dex, con, cha], cs - current stats
// (same order). prompt.p2: h - hitroll, d - damroll, a - armor class, s - saves vs spell.
// Rendered as flat chips (same family as the affects widget) in the Online widget's font
// style, replacing the old two-table stat grid.
const BASE = ['str', 'int', 'wis', 'dex', 'con', 'cha'];

export default function PlayerParamsItem(prompt) {
    const l = prompt.lang;
    const p1 = prompt.p1;
    const p2 = prompt.p2;
    const chips = [];

    if (p1 && p1 !== "none") {
        BASE.forEach(function (key, i) {
            chips.push(
                <span className="stat-chip" key={key}>
                    <b>{t('par.' + key, l)}</b>
                    <span className="stat-val">{p1.ps[i]}<span className="stat-cur">({p1.cs[i]})</span></span>
                </span>
            );
        });
    }
    if (p2 && p2 !== "none") {
        chips.push(<span className="stat-chip" key="hit"><b>{t('par.hit', l)}</b><span className="stat-val">{p2.h}</span></span>);
        chips.push(<span className="stat-chip" key="dam"><b>{t('par.dam', l)}</b><span className="stat-val">{p2.d}</span></span>);
        chips.push(<span className="stat-chip" key="ac"><b>{t('par.ac', l)}</b><span className="stat-val">{p2.a}</span></span>);
        chips.push(<span className="stat-chip" key="save"><b>{t('par.save', l)}</b><span className="stat-val">{p2.s}</span></span>);
    }

    return (
        <PanelItem storageKey="params" title={t('par.title', prompt.lang)} collapsed={true}
            onOpen={() => openWidgetHelp({ kind: 'stats' })}>
            <div id="player-params-table" className="stats-chips">
                {chips}
            </div>
        </PanelItem>
    )
}
