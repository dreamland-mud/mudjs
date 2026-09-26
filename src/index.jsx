import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './app.jsx';
import SettingsDialog from './components/settings/SettingsDialog.jsx';
import HelpSheet from './components/helpSheet/HelpSheet.jsx';

import { createTheme, ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { Provider } from 'react-redux';
import { store } from './store.js';

import './main.js'; // legacy JS

// Runeforge dark theme -- feeds the MUI components (Box grounds, map AppBar,
// panel Table cells, Collapse) so they inherit the skin instead of Material defaults.
const theme = createTheme({
  palette: {
    mode: 'dark',
    background: { default: '#0f0e13', paper: '#17161d' },
    primary: { main: '#bb86fc' },
    secondary: { main: '#2cf4eb' },
    success: { main: '#8ee34f' },
    error: { main: '#ed2330' },
    text: { primary: '#d3d7cf', secondary: '#8b8798' },
    divider: 'rgba(255,255,255,0.08)',
  },
  shape: { borderRadius: 6 },
  typography: { fontFamily: "'Fira Code', ui-monospace, monospace" },
  components: {
    MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
    MuiTableCell: { styleOverrides: { root: { borderColor: 'rgba(255,255,255,0.06)' } } },
  },
});

// Рендерим приложение
const rootElement = document.getElementById('root');
const root = createRoot(rootElement);

root.render(
  <React.StrictMode>
    <Provider store={store}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <App />
      </ThemeProvider>
    </Provider>
  </React.StrictMode>
);

// The settings window lives inside the Bootstrap modal that was always there,
// so the gear button, its data-toggle and the overlay keep working untouched.
// The widget help sheet shares the root: both are side sheets over the game.
const settingsElement = document.getElementById('settings-root');
if (settingsElement) {
  createRoot(settingsElement).render(
    <React.StrictMode>
      <Provider store={store}>
        <ThemeProvider theme={theme}>
          <SettingsDialog />
          <HelpSheet />
        </ThemeProvider>
      </Provider>
    </React.StrictMode>
  );
}
