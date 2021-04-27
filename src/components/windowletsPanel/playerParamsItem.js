import React from 'react'
import PanelItem from "./panelItem";

// prompt params fields p1: ps - array of permanent stats, cs - array of current stats.
// prompt params fields p2: h - hitroll, d - damroll, a - armor class, s - saves vs spell.
const BaseStats = (stats) => {
    return (
        <table id="player-params-1">
            <tbody>
                <tr>
                    <td><b>Сила</b>:</td><td>{stats.ps[0]}(<b>{stats.cs[0]}</b>)</td>
                    <td><b>Ум</b>:</td><td>{stats.ps[1]}(<b>{stats.cs[1]}</b>)</td>
                </tr>
                <tr>
                    <td><b>Мудр</b>:</td><td>{stats.ps[2]}(<b>{stats.cs[2]}</b>)</td>
                    <td><b>Ловк</b>:</td><td>{stats.ps[3]}(<b>{stats.cs[3]}</b>)</td>
                </tr>
                <tr>
                    <td><b>Слож</b>:</td><td>{stats.ps[4]}(<b>{stats.cs[4]}</b>)</td>
                    <td><b>Обая</b>:</td><td>{stats.ps[5]}(<b>{stats.cs[5]}</b>)</td>
                </tr>
            </tbody>
        </table>
    )
}

const SecondaryStats = (stats) => {
    return (
        <table id="player-params-2">
            <tbody>
                <tr>
                    <td><b>Точность</b>:</td><td>{stats.h}</td>
                    <td><b>Урон</b>:</td><td>{stats.d}</td>
                </tr>
                <tr>
                    <td><b>Броня</b>:</td><td>{stats.a}</td>
                    <td><b>Заклин</b>:</td><td>{stats.s}</td>
                </tr>
            </tbody>
        </table>
    )
}

export default function PlayerParamsItem(prompt) {

    return (
        <PanelItem title="Твои параметры:" collapsed={true}>
            <div id="player-params-table" data-hint="hint-params">
                {(prompt.p1 && prompt.p1 !== "none") && <BaseStats {...prompt.p1} />}
                <br/>
                {(prompt.p2 && prompt.p2 !== "none") && <SecondaryStats {...prompt.p2} />}
            </div>
        </PanelItem>
    )
}
