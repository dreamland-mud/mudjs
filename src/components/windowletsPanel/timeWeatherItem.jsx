import React from 'react';
import PanelItem from './panelItem';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';

/**
 * Prompt time fields: h - hour, tod - time of day, l - daylight.
 * Daylight can be hidden.
 */
const TimeRow = ({ h, tod, l }) => (
  <TableRow>
    <TableCell sx={{ textAlign: 'left' }}>
      <i className={`wi wi-fw wi-time-${h}`} style={{ fontSize: '150%' }}></i>
    </TableCell>
    <TableCell>{`${h} ${tod}`}{l && `, ${l}`}</TableCell>
  </TableRow>
);

/**
 * Prompt date fields: d - day, m - month, y - year.
 */
const DateRow = ({ d, m, y }) => (
  <TableRow>
    <TableCell sx={{ textAlign: 'left' }}>
      <i className="fa" style={{ fontSize: '140%' }}>&#xf073;</i>
    </TableCell>
    <TableCell>{`${d} / ${m} / ${y}`}</TableCell>
  </TableRow>
);

/**
 * Prompt weather (w) fields: i - icon to use, m - weather message.
 */
const WeatherRow = ({ i, m }) => (
  <TableRow>
    <TableCell sx={{ textAlign: 'left' }}>
      <i className={`wi wi-fw wi-${i}`} style={{ fontSize: '150%' }}></i>
    </TableCell>
    <TableCell>{m}</TableCell>
  </TableRow>
);

/**
 * Render weather & time windowlet.
 */
export default function TimeWeatherItem(prompt) {
  const { time, date, w: weather } = prompt;

  return (
    <PanelItem title="Погода и время">
      <Table sx={{
        '& .wi': { fontSize: '150%' },
        '& .fa': { fontSize: '140%' },
        '& td > i': { textAlign: 'left' },
      }}>
        <TableBody>
          {time && time !== 'none' && <TimeRow {...time} />}
          {date && date !== 'none' && <DateRow {...date} />}
          {weather && weather !== 'none' && <WeatherRow {...weather} />}
        </TableBody>
      </Table>
    </PanelItem>
  );
}
