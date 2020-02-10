
import React, { useState } from 'react';
import ReactDom from 'react-dom';

import SplitterLayout from 'react-splitter-layout';
import { useMediaQuery } from 'react-responsive';
import AppBar from '@material-ui/core/AppBar';
import { makeStyles } from '@material-ui/core/styles';
import Toolbar from '@material-ui/core/Toolbar';
import Typography from '@material-ui/core/Typography';
import IconButton from '@material-ui/core/IconButton';
import MenuIcon from '@material-ui/icons/Menu';

import 'react-splitter-layout/lib/index.css';
import 'bootstrap';

import Terminal from './components/terminal';
import Panel from './components/panel'

const useStyles = makeStyles(theme => ({
    title: {
        flexGrow: 1
    },
    menuButton: {
        marginRight: theme.spacing(2),
    },
}));

const Main = (props) => { 
    // Hooks
    const [panel, setPanel] = useState(true);
    const classes = useStyles();
    const bigScreen = useMediaQuery({ minDeviceWidth: 768 });

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

    return <>
        { appBar }
        <div className="flex-grow-shrink-auto main-content">
            <SplitterLayout secondaryInitialSize={270} secondaryMinSize={270}>
                <Terminal />
                { panel && bigScreen && <Panel /> }
            </SplitterLayout>
        </div>
    </>;
};

export default () => {

    return <div id="page" className="flexcontainer-column">
        <Main />
        <button id="reconnect" type="button" className="btn btn-primary">Reconnect</button>
        <form id="input">
            <input type="text"></input>
        </form>
        <div id="stats">
            <div className="row">
                <div className="progress col-sm-4 position-relative">
                    <div id="hits" className="progress-bar" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100"></div>
                    <span className="justify-content-center d-flex position-absolute w-100"></span>
                </div>
                <div className="progress col-sm-4 position-relative">
                    <div id="mana" className="progress-bar" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100"></div>
                    <span className="justify-content-center d-flex position-absolute w-100"></span>
                </div>
                <div className="progress col-sm-4 position-relative">
                    <div id="moves" className="progress-bar" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100"></div>
                    <span className="justify-content-center d-flex position-absolute w-100"></span>
                </div>
            </div>
        </div>
    </div>;
};
