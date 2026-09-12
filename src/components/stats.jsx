import React from 'react';
import { usePrompt } from '../react-hooks';
import { t } from '../i18n';
import Box from '@mui/material/Box';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';

// Skeuomorphic vial: square glass tube, liquid fill (color-matched glow + top
// sheen), graduated tick dividers with end caps. Colour comes in as the --c
// custom property so the fill and its glow match. ARIA on the container.
const Stat = ({ v, max_v, caption, color }) => {
  const theme = useTheme();
  const big = useMediaQuery(theme.breakpoints.up('sm'));

  if (!max_v) return null;

  const pct = Math.max(0, Math.min(100, Math.floor((100 * v) / max_v)));

  return (
    <div className="rf-vial" role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={max_v}>
      <div className="rf-vial-fill" style={{ width: `${pct}%`, '--c': color }} />
      <div className="rf-vial-ticks" aria-hidden="true" />
      {big && <span className="rf-vial-cap">{caption}</span>}
      {big && (
        <span className="rf-vial-val">
          <b>{v}</b>/{max_v}
        </span>
      )}
    </div>
  );
};

const StatPercent = ({ percent, caption, color }) => {
  const theme = useTheme();
  const big = useMediaQuery(theme.breakpoints.up('sm'));

  if (!percent || percent <= 0) return null;

  const pct = Math.max(0, Math.min(100, percent));

  return (
    <div className="rf-vial" role="progressbar" aria-valuenow={percent} aria-valuemin={1} aria-valuemax={100}>
      <div className="rf-vial-fill" style={{ width: `${pct}%`, '--c': color }} />
      <div className="rf-vial-ticks" aria-hidden="true" />
      {big && (
        <span className="rf-vial-val">
          {caption} <b>{percent}</b>%
        </span>
      )}
    </div>
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
