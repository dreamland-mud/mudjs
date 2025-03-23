import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './app.jsx';

import { createTheme, ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { Provider } from 'react-redux';
import { store } from './store.js';

import './main.js'; // legacy JS

// Создаём тему с тёмным режимом
const theme = createTheme({
  palette: {
    mode: 'dark',
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
