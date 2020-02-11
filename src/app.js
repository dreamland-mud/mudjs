
import React, { useState } from 'react';
import ReactDom from 'react-dom';

import SplitterLayout from 'react-splitter-layout';
import useMediaQuery from '@material-ui/core/useMediaQuery';
import Box from '@material-ui/core/Box';
import AppBar from '@material-ui/core/AppBar';
import { makeStyles } from '@material-ui/core/styles';
import Toolbar from '@material-ui/core/Toolbar';
import Typography from '@material-ui/core/Typography';
import IconButton from '@material-ui/core/IconButton';
import MenuIcon from '@material-ui/icons/Menu';

import 'react-splitter-layout/lib/index.css';
import 'bootstrap';

import Terminal from './components/terminal';
import Panel from './components/panel';
import Stats from './components/stats';

const useStyles = makeStyles(theme => ({
    page: {
        height: '100%',
        width: '100%',
        overflow: 'hidden',
    },
    main: {
        overflow: 'hidden',
        position: 'relative',
    },
    title: {
        flexGrow: 1
    },
    menuButton: {
        marginRight: theme.spacing(2),
    },
}));

export default props => {
    // Hooks
    const [panel, setPanel] = useState(true);
    const classes = useStyles();
    const bigScreen = useMediaQuery(theme => theme.breakpoints.up('sm'));

    const toggle = e => setPanel(!panel);

    const appBar = bigScreen &&
        <AppBar position="static" color="default">
            <Toolbar variant="dense">
                <Typography className={classes.title}>I'm sure Ruffina will find some very important text to put in here.</Typography>
                <IconButton edge="end" onClick={toggle} className={classes.menuButton} color="inherit" aria-label="menu">
                    <MenuIcon />
                </IconButton>
            </Toolbar>
        </AppBar>;

    return <Box display="flex" flexDirection="column" className={classes.page}>
        { appBar }
        <Box flex="1 1 auto" className={classes.main}>
            <SplitterLayout secondaryInitialSize={270} secondaryMinSize={270}>
                <Terminal />
                { panel && bigScreen && <Panel /> }
            </SplitterLayout>
        </Box>
        <button id="reconnect" type="button" className="btn btn-primary">Reconnect</button>
        <form id="input">
            <input type="text"></input>
        </form>
        <Stats />
    </Box>;
};

