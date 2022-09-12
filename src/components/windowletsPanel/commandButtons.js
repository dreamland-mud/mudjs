import React from 'react'
import { useSelector } from 'react-redux'
import PanelItem from './panelItem'

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

    return (
        <PanelItem title="Команды">
            <div id="commands-table" className="flexcontainer-row collapse show">
                <div className="flexcontainer-column">
                    <button type="button" className="btn btn-ctrl-panel" data-action="см">Смотреть</button>
                    {/* <ButtonItem action='см' title='Смотреть'></ButtonItem> */}
                    <button type="button" className="btn btn-ctrl-panel" data-action="инв">Инвентарь</button>
                    <button type="button" className="btn btn-ctrl-panel" data-action="одежда">Одежда</button>
                    <button type="button" className="btn btn-ctrl-panel" data-action="ссчет">Счет</button>
                    <button type="button" className="btn btn-ctrl-panel" data-action="/">Возврат</button>
                    <button type="button" className="btn btn-ctrl-panel" data-action="сбежать">Сбежать</button>
                </div>
                <div className="flexcontainer-column">
                    <button type="button" className="btn btn-ctrl-panel" data-action="прак">Практика</button>
                    <button type="button" className="btn btn-ctrl-panel" data-action="умения заклинания">Магия</button>
                    <button type="button" className="btn btn-ctrl-panel" data-action="умения навыки">Умения</button>
                    <button type="button" className="btn btn-ctrl-panel" data-action="задания">Задания</button> 
                    <button type="button" className="btn btn-ctrl-panel" data-action="команды">Команды</button>
                    {/* <ButtonItem action='конец' confirm='покинуть мир' title='Конец'></ButtonItem> */}
                    <button type="button" className="btn btn-ctrl-panel" data-action="конец" data-confirm="покинуть мир">Конец</button>
                </div>
            </div>
        </PanelItem>
    )
}
