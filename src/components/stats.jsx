import React from 'react';
import { usePrompt } from '../react-hooks';
import { t } from '../i18n';
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
    <>
      <Box component="span" className="position-absolute" sx={{ left: '4px' }}>
        {caption}
      </Box>
      <Box component="span" className="d-flex justify-content-center position-absolute w-100">
        <b>{v}</b>/{max_v}
      </Box>
    </>
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
      {caption} <b>{percent}</b>%
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
  const prompt = usePrompt();
  const { hit, max_hit, mana, max_mana, move, max_move, fight } = prompt;
  const lang = prompt.lang;

  return (
    <Box
      sx={{
        display: { xs: 'block', sm: 'flex' },
        flexDirection: 'row',
      }}
    >
      <Stat caption={t('st.health', lang)} color="#cc0000" v={hit} max_v={max_hit} />
      <StatPercent caption={t('st.enemy', lang)} color="#ff0000" percent={fight} />
      <Stat caption={t('st.mana', lang)} color="#3465a4" v={mana} max_v={max_mana} />
      <Stat caption={t('st.moves', lang)} color="#4e9a06" v={move} max_v={max_move} />
    </Box>
  );
}
