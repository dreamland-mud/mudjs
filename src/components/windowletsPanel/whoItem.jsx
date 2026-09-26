import React from 'react'
import PanelItem from "./panelItem"
import { openWidgetHelp } from '../helpSheet/HelpSheet'
import { raceName, clanName } from './windowletsConstants'
import { t } from '../../i18n'
import './who.css'

// Clans with a badge in the Figma set; any other letter falls back to coloured text.
const BADGE_CLANS = 'hlcrsbkifg'

const ClanBadge = ({ cn, cc, lang }) => {
    const name = clanName(cn, lang)
    if (!BADGE_CLANS.includes(cn))
        return <span className={'fg' + cc}>{name}</span>
    return (
        <span className="clan-chip" data-clan={cn}>
            <span className="clan-chip__glow" />
            <span className="clan-chip__label">{name}</span>
            <span className="clan-chip__orn clan-chip__orn--l" />
            <span className="clan-chip__orn clan-chip__orn--r" />
        </span>
    )
}

// prompt 'who' fields: p - list of players, v - visible player count,
// t - total player count.
// Each player contains fields: n - name, r - first 2 letters of race,
// cn - first letter of clan name, cc - clan colour. lang is threaded in for the
// localized race/clan names.
// A row is display:contents, so its three cells stay in the grid and one click
// anywhere on them opens that player's whois.
const WhoPlayer = (person) => (
    <div className="who-row hs-opener" onClick={() => openWidgetHelp({ kind: 'cmd', what: 'whois', arg: person.n })}>
        <span className="who-name">{person.n}</span>
        <span className="who-race">{raceName(person.r, person.lang)}</span>
        <span className="who-clan">
            {person.cn && person.cn !== 'n' && <ClanBadge cn={person.cn} cc={person.cc} lang={person.lang} />}
        </span>
    </div>
)

export default function WhoItem(prompt) {

    return (
        <PanelItem storageKey="who" title={t('who.title', prompt.lang)}>
            <div id="who-table" className="who-grid">
                {prompt.who.p.map((person, i) => (
                    <WhoPlayer key={i} {...person} lang={prompt.lang} />
                ))}
            </div>
        </PanelItem>
    )
}
