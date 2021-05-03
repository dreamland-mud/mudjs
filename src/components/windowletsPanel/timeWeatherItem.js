import React from 'react'
import { makeStyles } from '@material-ui/core/styles';

import PanelItem from './panelItem'

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
export default function TimeWeatherItem(prompt) {
    const classes = useStyles();

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