import React from 'react';
import { usePrompt } from '../react-hooks';
import Box from '@mui/material/Box';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';

const Stat = ({ v, max_v, caption, color }) => {
  const theme = useTheme();
  const big = useMediaQuery(theme.breakpoints.up('sm'));

  if (!max_v) return null;

  const style = {
    width: `${Math.floor((100 * v) / max_v)}%`,
    backgroundColor: color,
  };

  const span = big && (
    <Box component="span" className="justify-content-center d-flex position-absolute w-100">
      {`${caption} ${v}/${max_v}`}
    </Box>
  );

  return (
    <Box
      className="progress"
      sx={{
        position: 'relative',
        flex: '1 1 auto',
        height: { xs: '4px', sm: '1rem' },
        color: 'white',
      }}
    >
      <Box style={style} className="progress-bar" role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={max_v} />
      {span}
    </Box>
  );
};

const StatPercent = ({ percent, caption, color }) => {
  const theme = useTheme();
  const big = useMediaQuery(theme.breakpoints.up('sm'));

  if (!percent || percent <= 0) return null;

  const style = {
    width: `${percent}%`,
    backgroundColor: color,
  };

  const span = big && (
    <Box component="span" className="justify-content-center d-flex position-absolute w-100">
      {`${caption} ${percent}%`}
    </Box>
  );

  return (
    <Box
      className="progress"
      sx={{
        position: 'relative',
        flex: '1 1 auto',
        height: { xs: '4px', sm: '1rem' },
        color: 'white',
      }}
    >
      <Box style={style} className="progress-bar" role="progressbar" aria-valuenow={percent} aria-valuemin={1} aria-valuemax={100} />
      {span}
    </Box>
  );
};

export default function Stats() {
  const theme = useTheme();
  const big = useMediaQuery(theme.breakpoints.up('sm'));
  const { hit, max_hit, mana, max_mana, move, max_move, fight } = usePrompt();

  return (
    <Box
      sx={{
        display: { xs: 'block', sm: 'flex' },
        flexDirection: 'row',
      }}
    >
      <Stat caption="Здоровье" color="#bb0000" v={hit} max_v={max_hit} />
      <StatPercent caption="Противник" color="#ff0000" percent={fight} />
      <Stat caption="Мана" color="#3465a4" v={mana} max_v={max_mana} />
      <Stat caption="Шаги" color="#055705" v={move} max_v={max_move} />
    </Box>
  );
}
