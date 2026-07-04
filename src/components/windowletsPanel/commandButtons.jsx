import React from 'react'
import { useSelector } from 'react-redux'
import PanelItem from './panelItem'
import { t } from '../../i18n'

// const ButtonItem = (button) => {
//     return (
//         <button type="button" className="btn btn-ctrl-panel" data-action={button.action} >{button.title}</button>
//     )
//     // return null
// }

export default function CommandButtons() {
    const prompt = useSelector(state => state.prompt);

    if(!prompt)
        return null;

    // data-action stays in Russian: it is the command sent to the engine, which
    // resolves RU aliases regardless of the player's display language. Only the
    // visible label is localized.
    const l = prompt.lang;

    return (
        <PanelItem storageKey="commands" title={t('cmd.title', l)}>
            <div id="commands-table" className="flexcontainer-row collapse show">
                <div className="flexcontainer-column">
                    <button type="button" className="btn btn-ctrl-panel" data-action="см">{t('cmd.look', l)}</button>
                    <button type="button" className="btn btn-ctrl-panel" data-action="инв">{t('cmd.inv', l)}</button>
                    <button type="button" className="btn btn-ctrl-panel" data-action="одежда">{t('cmd.equip', l)}</button>
                    <button type="button" className="btn btn-ctrl-panel" data-action="ссчет">{t('cmd.score', l)}</button>
                    <button type="button" className="btn btn-ctrl-panel" data-action="/">{t('cmd.recall', l)}</button>
                    <button type="button" className="btn btn-ctrl-panel" data-action="сбежать">{t('cmd.flee', l)}</button>
                </div>
                <div className="flexcontainer-column">
                    <button type="button" className="btn btn-ctrl-panel" data-action="прак">{t('cmd.practice', l)}</button>
                    <button type="button" className="btn btn-ctrl-panel" data-action="умения заклинания">{t('cmd.magic', l)}</button>
                    <button type="button" className="btn btn-ctrl-panel" data-action="умения навыки">{t('cmd.skills', l)}</button>
                    <button type="button" className="btn btn-ctrl-panel" data-action="задания">{t('cmd.quests', l)}</button>
                    <button type="button" className="btn btn-ctrl-panel" data-action="команды">{t('cmd.title', l)}</button>
                    <button type="button" className="btn btn-ctrl-panel" data-action="конец" data-confirm={t('cmd.quitConfirm', l)}>{t('cmd.quit', l)}</button>
                </div>
            </div>
        </PanelItem>
    )
}
