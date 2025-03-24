import React, { useEffect, useState } from 'react';
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

const propertiesStorage = PropertiesStorage;

const ELEMENT_MAP = {
  terminal: <MainWindow />,
  panel: <Panel />,
  map: <Map />,
};

const getResponsiveLayout = (bigScreen, hugeScreen) => {
  if (!bigScreen) return 'terminal';

  if (!hugeScreen) {
    return {
      direction: 'row',
      first: 'terminal',
      second: 'panel',
      splitPercentage: 70,
    };
  }

  return {
    direction: 'row',
    first: 'terminal',
    second: {
      direction: 'row',
      first: 'panel',
      second: 'map',
      splitPercentage:
        (propertiesStorage['panelLayoutWidth'] /
          (propertiesStorage['panelLayoutWidth'] +
            propertiesStorage['mapLayoutWidth'])) *
        100,
    },
    splitPercentage:
      (propertiesStorage['terminalLayoutWidth'] /
        (propertiesStorage['terminalLayoutWidth'] +
          propertiesStorage['panelLayoutWidth'] +
          propertiesStorage['mapLayoutWidth'])) *
      100,
  };
};

export default function App() {
  const bigScreen = useMediaQuery('(min-width:600px)');
  const hugeScreen = useMediaQuery('(min-width:1280px)');

  const [layout, setLayout] = useState(() =>
    getResponsiveLayout(bigScreen, hugeScreen)
  );

  useEffect(() => {
    setLayout(getResponsiveLayout(bigScreen, hugeScreen));
  }, [bigScreen, hugeScreen]);

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
