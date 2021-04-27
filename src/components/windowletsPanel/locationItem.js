import React from 'react'
import PanelItem from './panelItem'

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
export default function LocationItem(prompt) {

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
