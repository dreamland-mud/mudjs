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
      <i className={`wi wi-fw wi-time-${h}`}></i>
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
      <i className="fa">&#xf073;</i>
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
      <i className={`wi wi-fw wi-${i}`}></i>
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
        // Compact rows; icons share one uniform box, aligned to the left edge with an
        // 8px gap to the text, tinted to the client purple.
        '& .MuiTableCell-root': { padding: '1px 0', border: 0 },
        // Left-align icons with the .dark-panel-title header (which has 5px padding).
        '& td:first-of-type': { width: '1.4em', paddingLeft: '5px', paddingRight: '8px' },
        '& .wi, & .fa': {
          fontSize: '16px',
          width: '1.4em',
          display: 'inline-block',
          textAlign: 'left',
          color: '#bb86fc',
        },
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
