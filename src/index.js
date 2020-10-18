
import React from 'react';
import ReactDom from 'react-dom';
import App from './app';
import { createMuiTheme, ThemeProvider } from '@material-ui/core/styles';

import './main.js'; // legacy JS

const theme = createMuiTheme({
    palette: {
        type: 'dark'
    },
});

ReactDom.render(
    <ThemeProvider theme={theme}>
        <App/>
    </ThemeProvider>, 
    document.getElementById('app')
);
