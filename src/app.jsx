import React, { useEffect, useMemo, useState } from 'react';
import { Mosaic, MosaicWindow } from 'react-mosaic-component';
import useMediaQuery from '@mui/material/useMediaQuery';
import Box from '@mui/material/Box';

import 'react-mosaic-component/react-mosaic-component.css';
import 'bootstrap';

import MainWindow from './components/mainwindow';
import Panel from './components/windowletsPanel/panel';
import Stats from './components/stats';
import Map from './components/map';
import PropertiesStorage from './properties';

import 'react-mosaic-component/react-mosaic-component.css';

const propertiesStorage = PropertiesStorage;

const ELEMENT_MAP = {
  terminal: <MainWindow />,
  panel: <Panel />,
  map: <Map />,
};

const getInitialLayout = (bigScreen, hugeScreen) => {
  if (!bigScreen) return 'terminal';

  const panelPart = hugeScreen
    ? {
        direction: 'row',
        first: 'panel',
        second: 'map',
        splitPercentage:
          (propertiesStorage['panelLayoutWidth'] /
            (propertiesStorage['panelLayoutWidth'] +
              propertiesStorage['mapLayoutWidth'])) *
          100,
      }
    : 'panel';

  return {
    direction: 'row',
    first: 'terminal',
    second: panelPart,
    splitPercentage:
      (propertiesStorage['terminalLayoutWidth'] /
        (propertiesStorage['terminalLayoutWidth'] +
          propertiesStorage['panelLayoutWidth'] +
          (hugeScreen ? propertiesStorage['mapLayoutWidth'] : 0))) *
      100,
  };
};

export default function App() {
  const bigScreen = useMediaQuery(theme => theme.breakpoints.up('sm'));
  const hugeScreen = useMediaQuery(theme => theme.breakpoints.up('lg'));

  const [layout, setLayout] = useState(() => {
    const saved = localStorage.getItem('layout');
    return saved ? JSON.parse(saved) : getInitialLayout(bigScreen, hugeScreen);
  });

  // Сохраняем при изменении
  useEffect(() => {
    localStorage.setItem('layout', JSON.stringify(layout));
  }, [layout]);

  return (
    <Box
      display="flex"
      flexDirection="column"
      sx={{
        height: '100vh',
        width: '100vw',
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          flex: 1,
          overflow: 'hidden',
          position: 'relative',
          minHeight: 0,
        }}
      >
        <Mosaic
          value={layout}
          onChange={setLayout}
          renderTile={(id, path) => (
            <MosaicWindow
              path={path}
              title=""
              toolbarControls={[]}
              additionalControls={[]}
              renderToolbar={() => null}
            >
              {ELEMENT_MAP[id]}
            </MosaicWindow>
          )}
          className="mosaic-theme-default"
        />
      </Box>
      <Stats />
    </Box>
  );
}
