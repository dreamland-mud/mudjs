import React from 'react';
import PanelItem from './panelItem';
import { t } from '../../i18n';

// Plain tables (no MUI). Layout/colour lives in runeforge.css under .rf-tw: compact
// rows, one uniform icon box aligned left with a gap to the text, tinted client purple.

/**
 * Prompt time fields: h - hour, tod - time of day, l - daylight.
 * Daylight can be hidden.
 */
const TimeRow = ({ h, tod, l }) => (
  <tr>
    <td className="tw-ic"><i className={`wi wi-fw wi-time-${h}`}></i></td>
    <td>{`${h} ${tod}`}{l && `, ${l}`}</td>
  </tr>
);

/**
 * Prompt date fields: d - day, m - month, s - season, y - year.
 * The year is deliberately not shown: it never changes within a session, while
 * the season does and is worth the space. It still arrives in the prompt.
 */
const DateRow = ({ d, m, s }) => (
  <tr>
    <td className="tw-ic"><i className="fa">&#xf073;</i></td>
    <td>{`${d} / ${m}`}{s && ` / ${s}`}</td>
  </tr>
);

/**
 * Prompt weather (w) fields: i - icon to use, m - weather message.
 */
const WeatherRow = ({ i, m }) => (
  <tr>
    <td className="tw-ic"><i className={`wi wi-fw wi-${i}`}></i></td>
    <td>{m}</td>
  </tr>
);

/**
 * Render weather & time windowlet.
 */
export default function TimeWeatherItem(prompt) {
  const { time, date, w: weather } = prompt;

  return (
    <PanelItem storageKey="timeWeather" title={t('tw.title', prompt.lang)}>
      <table className="rf-tw">
        <tbody>
          {time && time !== 'none' && <TimeRow {...time} />}
          {date && date !== 'none' && <DateRow {...date} />}
          {weather && weather !== 'none' && <WeatherRow {...weather} />}
        </tbody>
      </table>
    </PanelItem>
  );
}
