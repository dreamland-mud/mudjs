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

// Prompt time fields: h - hour, tod - time of day, l - daylight.
// Daylight can be hidden.
const TimeRow = ({h, tod, l}) => <tr>
        <td><i className={`wi wi-fw wi-time-${h}`}></i></td>
        <td><span>{`${h} ${tod}`}{l && `, ${l}`}</span></td>
    </tr>;

// Prompt date fields: d - day, m - month, y - year.
const DateRow = ({d, m, y}) => <tr>
        <td><i className="fa">&#xf073;</i></td>
        <td><span>{`${d} / ${m} / ${y}`}</span></td>
    </tr>;

// Prompt weather (w) fields: i - icon to use, m - weather message.
const WeatherRow = ({i, m}) => <tr>
        <td><i className={`wi wi-fw wi-${i}`}></i></td>
        <td><span>{m}</span></td>
    </tr>;

/** 
 * Render weather&time windowlet. Special values:
 * undefined value -- time etc is unchanged since last prompt.
 * 'none' value -- time etc is now hidden. 
 */
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

// Prompt zone field: string with area name.
const ZoneRow = ({zone}) => {
    return <tr>
        <td>&nbsp;<i className="fa">&#xf041;</i></td>
        <td>"<span className="fg-ansi-dark-color-6">{zone}</span>"</td>
    </tr>;
}

// Prompt room field: string with room name.
const RoomRow = ({room}) => {
    return <tr>
        <td></td>
        <td>"<span className="fg-ansi-bright-color-6">{room}</span>"</td>
    </tr>;
}

// Draw a single exit letter or a dot if no such exit exists.
const ExitCell = ({ex_ru, ex_en, ex_hidden, ex_visible, lang}) => {
    let exit = ex_en.toLowerCase();

    // See if this exit letter is among hidden exits.
    let hidden = ex_hidden.indexOf(exit) !== -1;
    // See if this exit letter is among visible exits.
    let visible = ex_visible.indexOf(exit) !== -1;

    // If found anywhere, draw a letter of selected language, otherwise a dot.
    let letter;
    if (hidden || visible) {
        letter = (lang === 'r' ? ex_ru : ex_en);
    } else {
        letter = '\u00B7';
    }

    // Mark hidden exits with default color, other exits with bright blue.
    let color = (hidden ? '' : 'fg-ansi-bright-color-6');

    return <span className={`${color}`}>{letter}</span> 
};

// Prompt exits field: e - open exits, h - closed exits, l - language (r, e)
const ExitsRow = ({e, h, l, sector}) => {
    return <tr>
        <td className="v-top">&nbsp;<i className="fa">&#xf277;</i></td>
        <td className="v-bottom">выходы:&nbsp;
            <ExitCell ex_ru='С' ex_en='N' ex_hidden={h} ex_visible={e} lang={l} />
            <ExitCell ex_ru='В' ex_en='E' ex_hidden={h} ex_visible={e} lang={l} />
            <ExitCell ex_ru='Ю' ex_en='S' ex_hidden={h} ex_visible={e} lang={l} />
            <ExitCell ex_ru='З' ex_en='W' ex_hidden={h} ex_visible={e} lang={l} />
            <ExitCell ex_ru='О' ex_en='D' ex_hidden={h} ex_visible={e} lang={l} />
            <ExitCell ex_ru='П' ex_en='U' ex_hidden={h} ex_visible={e} lang={l} />
        </td>
    </tr>;
};

/**
 * Render player location windowlet.
 */
const LocationItem = props => {
    const classes = useStyles();
    const prompt = useSelector(state => state.prompt);

    if(!prompt)
        return null;

    const { zone, room, exits } = prompt;

    return <PanelItem title="Твое местоположение:">
        <table>
            <tbody>
                { zone && zone !== 'none' && <ZoneRow zone={zone} /> }
                { room && room !== 'none' && <RoomRow room={room} /> }
                { exits && exits !== 'none' && <ExitsRow {...exits} /> }
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
            <LocationItem />
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
