import React from 'react'
import PanelItem from "./panelItem";
import { t } from '../../i18n';

// prompt params fields p1: ps - array of permanent stats, cs - array of current stats.
// prompt params fields p2: h - hitroll, d - damroll, a - armor class, s - saves vs spell.
const BaseStats = (stats) => {
    const l = stats.lang;
    return (
        <table id="player-params-1">
            <tbody>
                <tr>
                    <td><b>{t('par.str', l)}</b>:</td><td>{stats.ps[0]}(<b>{stats.cs[0]}</b>)</td>
                    <td><b>{t('par.int', l)}</b>:</td><td>{stats.ps[1]}(<b>{stats.cs[1]}</b>)</td>
                </tr>
                <tr>
                    <td><b>{t('par.wis', l)}</b>:</td><td>{stats.ps[2]}(<b>{stats.cs[2]}</b>)</td>
                    <td><b>{t('par.dex', l)}</b>:</td><td>{stats.ps[3]}(<b>{stats.cs[3]}</b>)</td>
                </tr>
                <tr>
                    <td><b>{t('par.con', l)}</b>:</td><td>{stats.ps[4]}(<b>{stats.cs[4]}</b>)</td>
                    <td><b>{t('par.cha', l)}</b>:</td><td>{stats.ps[5]}(<b>{stats.cs[5]}</b>)</td>
                </tr>
            </tbody>
        </table>
    )
}

const SecondaryStats = (stats) => {
    const l = stats.lang;
    return (
        <table id="player-params-2">
            <tbody>
                <tr>
                    <td><b>{t('par.hit', l)}</b>:</td><td>{stats.h}</td>
                    <td><b>{t('par.dam', l)}</b>:</td><td>{stats.d}</td>
                </tr>
                <tr>
                    <td><b>{t('par.ac', l)}</b>:</td><td>{stats.a}</td>
                    <td><b>{t('par.save', l)}</b>:</td><td>{stats.s}</td>
                </tr>
            </tbody>
        </table>
    )
}

export default function PlayerParamsItem(prompt) {

    return (
        <PanelItem storageKey="params" title={t('par.title', prompt.lang)} collapsed={true}>
            <div id="player-params-table" data-hint="hint-params">
                {(prompt.p1 && prompt.p1 !== "none") && <BaseStats {...prompt.p1} lang={prompt.lang} />}
                <br/>
                {(prompt.p2 && prompt.p2 !== "none") && <SecondaryStats {...prompt.p2} lang={prompt.lang} />}
            </div>
        </PanelItem>
    )
}
