import React from 'react'
import PanelItem from "./panelItem"
import { Races, Clans } from './windowletsConstants' 

// prompt 'who' fields: p - list of players, v - visible player count,
// t - total player count.
// Each player contains fields: n - name, r - first 2 letters of race,
// cn - first letter of clan name, cc - clan colour.
const WhoPlayer = (person) => {
    return (
        <tr>
            <td>{person.n}</td>
            <td>{Races[person.r]}</td>
            {person.cn ? <td><span className={'fg' + person.cc }> {Clans[person.cn]}</span></td> : <td></td>}
        </tr>
    )
}

export default function WhoItem(prompt) {

    return (
        <PanelItem title="Сейчас в мире:">
            <div id="who-table" data-hint="hint-who">
                <table>
                    <thead>
                        <tr>
                            <th>Имя</th>
                            <th>Раса</th>
                            <th>Клан</th>
                        </tr>
                    </thead>
                    <tbody>
                        {prompt.who.p.map((person,i) => {
                            return (
                                <WhoPlayer key={i} {...person} />
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </PanelItem>
    )
}