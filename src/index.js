
import React from 'react';
import ReactDom from 'react-dom';
import App from './app';
import { createMuiTheme, ThemeProvider } from '@material-ui/core/styles';
import { Provider } from 'react-redux';
import { store } from './store';

import './main.js'; // legacy JS

const theme = createMuiTheme({
    palette: {
        type: 'dark'
    },
});

ReactDom.render(
    <Provider store={store}>
        <ThemeProvider theme={theme}>
            <App/>
        </ThemeProvider>
    </Provider>, 
    document.getElementById('app')
);
