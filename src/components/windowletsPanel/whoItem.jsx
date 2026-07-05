import React from 'react'
import PanelItem from "./panelItem"
import { raceName, clanName } from './windowletsConstants'
import { t } from '../../i18n'

// prompt 'who' fields: p - list of players, v - visible player count,
// t - total player count.
// Each player contains fields: n - name, r - first 2 letters of race,
// cn - first letter of clan name, cc - clan colour. lang is threaded in for the
// localized race/clan names.
const WhoPlayer = (person) => {
    return (
        <tr>
            <td>{person.n}</td>
            <td>{raceName(person.r, person.lang)}</td>
            {person.cn ? <td><span className={'fg' + person.cc }> {clanName(person.cn, person.lang)}</span></td> : <td></td>}
        </tr>
    )
}

export default function WhoItem(prompt) {

    return (
        <PanelItem storageKey="who" title={t('who.title', prompt.lang)}>
            <div id="who-table" data-hint="hint-who">
                <table>
                    <thead>
                        <tr>
                            <th>{t('who.name', prompt.lang)}</th>
                            <th>{t('who.race', prompt.lang)}</th>
                            <th>{t('who.clan', prompt.lang)}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {prompt.who.p.map((person,i) => {
                            return (
                                <WhoPlayer key={i} {...person} lang={prompt.lang} />
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </PanelItem>
    )
}
