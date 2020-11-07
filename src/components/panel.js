import React from 'react';
import { useState } from 'react';
import { useSelector } from 'react-redux';
import ReactDom from 'react-dom';
import Box from '@material-ui/core/Box';
import Collapse from '@material-ui/core/Collapse';
import { makeStyles } from '@material-ui/core/styles';
import $ from 'jquery';

import Help from './panel-help';

const useStyles = makeStyles(theme => ({
    timeWeather: {
        '& .wi': {
            fontSize: '150%'
        },

        '& .fa': {
            fontSize: '140%'
        },

        '& td > i': {
            textAlign: 'left'
        }
    }
}));

const PanelItem = props => {
    const [collapsed, setCollapsed] = useState(false);

    const toggle = e => {
        e.preventDefault();
        setCollapsed(!collapsed);
    };

    return <div className="table-wrapper">
        <span onClick={toggle} className="dark-panel-title">{props.title}</span>
        <button onClick={toggle} className={`close ${collapsed && 'collapsed'}`} type="button" />
        <Collapse in={!collapsed}>
            { props.children }
        </Collapse>
    </div>;
};

const TimeRow = ({h, tod, l}) => <tr>
        <td><i className={`wi wi-fw wi-time-${h}`}></i></td>
        <td><span>{`${h} ${tod}`}{l && `, ${l}`}</span></td>
    </tr>;

const DateRow = ({d, m, y}) => <tr>
        <td><i className="fa">&#xf073;</i></td>
        <td><span>{`${d} / ${m} / ${y}`}</span></td>
    </tr>;

const WeatherRow = ({i, m}) => <tr>
        <td><i className={`wi wi-fw wi-${i}`}></i></td>
        <td><span>{m}</span></td>
    </tr>;

const TimeWeatherItem = props => {
    const classes = useStyles();
    const prompt = useSelector(state => state.prompt);

    if(!prompt)
        return null;

    const { time, date, w: weather } = prompt;
    
    return <PanelItem title="Погода и время:">
        <table className={`table-with-icons ${classes.timeWeather}`}>
            <tbody>
                { time && time !== 'none' && <TimeRow {...time} /> }
                { date && date !== 'none' && <DateRow {...date} /> }
                { weather && weather !== 'none' && <WeatherRow {...weather} /> }
            </tbody>
        </table>
    </PanelItem>;
};

const hide = { display: 'none' };

export default class Panel extends React.Component {

    componentDidMount() {
        if (global.mudprompt)
            $('#rpc-events').trigger('rpc-prompt', [global.mudprompt]);
    }

    render() {
        return <Box id="panel-wrap" flex="1" aria-hidden="true">
            <TimeWeatherItem />
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
                    <thead><tr><th>Имя</th><th>Ур.</th><th>Здор.</th><th>Опыт</th></tr></thead>
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
                        <thead><tr><th>Имя</th><th>Раса</th><th>Клан</th></tr></thead>
                        <tbody></tbody>
                    </table>
                </div>
            </div>
            <Help />

            <div id="commands" className="table-wrapper" style={hide}>
                <span className="dark-panel-title" data-toggle="collapse" data-target="#commands-table">Команды</span>
                <button className="close" type="button" data-toggle="collapse" data-target="#commands-table"></button>
                <div id="commands-table" className="flexcontainer-row collapse show">
                    <div className="flexcontainer-column">
                        <button type="button" className="btn btn-ctrl-panel" data-action="см">Смотреть</button>
                        <button type="button" className="btn btn-ctrl-panel" data-action="инв">Инвентарь</button>
                        <button type="button" className="btn btn-ctrl-panel" data-action="одежда">Одежда</button>
                        <button type="button" className="btn btn-ctrl-panel" data-action="ссчет">Счет</button>
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
        </Box>;
    }
}
