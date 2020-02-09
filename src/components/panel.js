import React from 'react';
import ReactDom from 'react-dom';

const hide = { display: 'none' };
const $ = require('jquery');

export default class Panel extends React.Component {

    componentDidMount() {
        if (global.mudprompt)
            $('#rpc-events').trigger('rpc-prompt', [global.mudprompt]);
    }

    render() {
        return <div id="panel-wrap" className="d-none d-md-block flexcontainer-column flex-nogrow-shrink-panel" aria-hidden="true">
            <div id="time-weather" className="table-wrapper" style={hide}>
                <span className="dark-panel-title" data-toggle="collapse" data-target="#time-weather-table">Погода и время:</span>
                <button className="close" type="button" data-toggle="collapse" data-target="#time-weather-table"></button>
                <div id="time-weather-table" className="collapse show">
                    <table className="table-with-icons">
                        <tbody>
                            <tr id="tw-time" data-hint="hint-time" style={hide}><td><i className="wi wi-fw"></i></td><td><span></span></td></tr>
                            <tr id="tw-date" data-hint="hint-date" style={hide}><td><i className="fa">&#xf073;</i></td><td><span></span></td></tr>
                            <tr id="tw-weather" data-hint="hint-weather" style={hide}><td><i className="wi wi-fw"></i></td><td><span></span></td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
            <div id="player-location" className="table-wrapper" style={hide}>
                <span className="dark-panel-title" data-toggle="collapse" data-target="#player-location-table">Твое местоположение:</span>
                <button className="close" type="button" data-toggle="collapse" data-target="#player-location-table"></button>
                <div id="player-location-table" className="collapse show">
                    <table className="">
                        <tbody>
                            <tr id="pl-zone" data-hint="hint-zone" style={hide}><td>&nbsp;<i className="fa">&#xf041;</i></td><td>"<span className="fg-ansi-dark-color-6"></span>"</td></tr>
                            <tr id="pl-room" data-hint="hint-room" style={hide}><td></td><td>"<span className="fg-ansi-bright-color-6"></span>"</td></tr>
                            <tr id="pl-exits" data-hint="hint-exits" style={hide}><td className="v-top">&nbsp;<i className="fa">&#xf277;</i></td><td className="v-bottom">выходы: <span id="ple-n" className="fg-ansi-bright-color-6">&#183;</span> <span id="ple-e" className="fg-ansi-bright-color-6">&#183;</span> <span id="ple-s" className="fg-ansi-bright-color-6">&#183;</span> <span id="ple-w" className="fg-ansi-bright-color-6">&#183;</span> <span id="ple-u" className="fg-ansi-bright-color-6">&#183;</span> <span id="ple-d">&#183;</span></td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
            <div id="group" className="table-wrapper" style={hide}>
                <span className="dark-panel-title" data-toggle="collapse" data-target="#group-table">Группа <span id="g_leader"></span>:</span>
                <button className="close collapsed" type="button" data-toggle="collapse" data-target="#group-table"> </button>
                <div id="group-table" className="collapse" data-hint="hint-group">
                    <table>
                    <thead><th>Имя</th><th>Ур.</th><th>Здор.</th><th>Опыт</th></thead>
                    <tbody></tbody>
                    </table>
                </div>
            </div>
            <div id="player-affects" className="table-wrapper" style={hide}>
                <span className="dark-panel-title" data-toggle="collapse" data-target="#player-affects-table">Воздействия на тебе:</span>
                <button className="close" type="button" data-toggle="collapse" data-target="#player-affects-table"></button>
                <div id="player-affects-table" className="flexcontainer-row flexcontainer-wrap collapse show" data-hint="hint-affects">
                    <div id="pa-protect" className="flexcontainer-column" style={hide} data-hint="hint-protect">
                    </div>
                    <div id="pa-detects" className="flexcontainer-column" style={hide} data-hint="hint-detects">
                    </div>
                    <div id="pa-travel" className="flexcontainer-column" style={hide} data-hint="hint-travel">
                    </div>
                    <div id="pa-enhance" className="flexcontainer-column" style={hide} data-hint="hint-enhance">
                    </div>
                    <div id="pa-malad" className="flexcontainer-column" style={hide} data-hint="hint-malad">
                    </div>
                    <div id="pa-clan" className="flexcontainer-column" style={hide} data-hint="hint-clan">
                    </div>
                </div>
            </div>


            <div id="player-params" className="table-wrapper" style={hide}>
                <span className="dark-panel-title" data-toggle="collapse" data-target="#player-params-table">Твои параметры:</span>
                <button className="close collapsed" type="button" data-toggle="collapse" data-target="#player-params-table"> </button>
                <div id="player-params-table" className="collapse" data-hint="hint-params">
                    <table id="player-params-1">
                        <tbody></tbody>
                    </table>
                    <br/>
                    <table id="player-params-2" style={hide}>
                        <tbody></tbody>
                    </table>
                </div>
            </div>
            <div id="questor" className="table-wrapper" style={hide}>
                <span className="dark-panel-title" data-toggle="collapse" data-target="#questor-table">Задание квестора: &nbsp;<span id="quest-time" className="fgby"></span> мин</span>
                <button className="close" type="button" data-toggle="collapse" data-target="#questor-table"> </button>
                <div id="questor-table" className="collapse show" data-hint="hint-questor">
                    <p className="fgbw"></p>
                </div>
            </div>
            <div id="who" className="table-wrapper" style={hide}>
                <span className="dark-panel-title" data-toggle="collapse" data-target="#who-table">Сейчас в мире:</span>
                <button className="close" type="button" data-toggle="collapse" data-target="#who-table"> </button>
                <div id="who-table" className="collapse show" data-hint="hint-who">
                    <table>
                        <thead><th>Имя</th><th>Раса</th><th>Клан</th></thead>
                        <tbody></tbody>
                    </table>
                </div>
            </div>
            <div id="help" className="table-wrapper">
                <span className="dark-panel-title" data-toggle="collapse" data-target="#help-table">Поиск по справке:</span>
                <button className="close" type="button" data-toggle="collapse" data-target="#help-table"> </button>
                <div id="help-table" className="" data-hint="hint-help">
                    <span className="fa fa-search form-control-feedback"></span>
                    <input type="text" className="form-control" placeholder="Введи ключевое слово" />
                </div>
            </div>

            <div id="commands" className="table-wrapper" style={hide}>
                <span className="dark-panel-title" data-toggle="collapse" data-target="#commands-table">Команды</span>
                <button className="close" type="button" data-toggle="collapse" data-target="#commands-table"></button>
                <div id="commands-table" className="flexcontainer-row collapse show">
                    <div className="flexcontainer-column">
                        <button type="button" className="btn btn-ctrl-panel" data-action="см">Смотреть</button>
                        <button type="button" className="btn btn-ctrl-panel" data-action="инв">Инвентарь</button>
                        <button type="button" className="btn btn-ctrl-panel" data-action="одежда">Одежда</button>
                        <button type="button" className="btn btn-ctrl-panel" data-action="счет">Счет</button>
                        <button type="button" className="btn btn-ctrl-panel" data-action="/">Возврат</button>
                        <button type="button" className="btn btn-ctrl-panel" data-action="сбежать">Сбежать</button>
                    </div>
                    <div className="flexcontainer-column">
                        <button type="button" className="btn btn-ctrl-panel" data-action="прак">Практика</button>
                        <button type="button" className="btn btn-ctrl-panel" data-action="заклинания">Магия</button>
                        <button type="button" className="btn btn-ctrl-panel" data-action="умения">Умения</button>
                        <button type="button" className="btn btn-ctrl-panel" data-action="задания">Задания</button> 
                        <button type="button" className="btn btn-ctrl-panel" data-action="команды">Команды</button>
                        <button type="button" className="btn btn-ctrl-panel" data-action="конец" data-confirm="покинуть мир">Конец</button>
                    </div>
                </div>
            </div>
        </div>;
    }
}
