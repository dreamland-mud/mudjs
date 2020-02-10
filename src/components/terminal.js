
import React from 'react';
import ReactDom from 'react-dom';

import { send } from '../websock';

const OverlayCell = ({ aria, fa, children, ...props }) => {
    const ariaProps = aria ? { "aria-label": aria } : { "aria-hidden": true };

    return <td>
        <button {...ariaProps} {...props} className="btn btn-sm btn-ctrl btn-outline-primary">
            { children }
        </button>
    </td>;
};

const longPressDelay = 800;

/*
 * Handlers for 'keypad' key area.
 */
const KeypadCell = ({cmd, longCmd, children, ...props}) => {
    // Long press: open/close direction etc.
    let btnTimer = null;
    let wasLongPress = false;

    console.log(cmd, longCmd);

    const touchstart = e => {
        wasLongPress = false;

        // send specified long-cmd once the delay has elapsed.
        btnTimer = setTimeout(() => {
            wasLongPress = true;
            btnTimer = null;
            send(longCmd);
        }, longPressDelay);
    };

    const touchend = e => {
        if (btnTimer)  
            clearTimeout(btnTimer);
    };

    // Single click: go direction, look etc.`
    const click = e => {
        if (wasLongPress)
            return;

        e.preventDefault();
        send(cmd);
    };

    let handlers = {};

    if(longCmd) {
        handlers = {
            ...handlers,
            onTouchStart: touchstart,
            onTouchEnd: touchend,
            onMouseDown: touchstart,
            onMouseUp: touchend,
            onMouseLeave: touchend
        };
    }

    if(cmd) {
        handlers = {
            ...handlers,
            onClick: click
        };
    }

    return <OverlayCell {...handlers} {...props}>{ children }</OverlayCell>;
};

const hide = { display: 'none' };

const Overlay = props =>
    <div id="overlay">
        <table id="nav" >
            <tbody>
                <tr>
                    <OverlayCell id="logs-button" aria="логи"> <i className="fa fa-download"></i> </OverlayCell>
                    <OverlayCell id="settings-button" data-toggle="modal" data-target="#settings-modal" aria="настройки"> <i className="fa fa-cog"></i> </OverlayCell>
                    <OverlayCell id="map-button" aria="карта"> <i className="fa fa-map"></i> </OverlayCell>
                    <OverlayCell id="font-plus-button"> <i className="fa fa-plus"></i> </OverlayCell>
                    <OverlayCell id="font-minus-button"> <i className="fa fa-minus"></i> </OverlayCell>
                </tr>
                <tr className="nav-hidden-md">
                    <td></td>
                    <td></td>
                    <KeypadCell cmd="scan"><i className="fa  fa-fw fa-refresh"></i></KeypadCell>
                    <KeypadCell cmd="n" longCmd="отпер север|откр север"><span>N</span></KeypadCell>
                    <KeypadCell cmd="u" longCmd="отпер вверх|откр вверх"><span>U</span></KeypadCell>
                </tr>
                <tr className="nav-hidden-md">
                    <td></td>
                    <td></td>
                    <KeypadCell cmd="w" longCmd="отпер запад|откр запад"><span>W</span></KeypadCell>
                    <KeypadCell cmd="l"> <i className="fa fa-fw  fa-eye"></i></KeypadCell>
                    <KeypadCell cmd="e" longCmd="отпер восток|откр восток"><span>E</span></KeypadCell>
                </tr>
                <tr className="nav-hidden-md">
                    <td></td>
                    <td></td>
                    <KeypadCell cmd="where"><i className="fa fa-fw fa-map-marker"></i></KeypadCell>
                    <KeypadCell cmd="s" longCmd="отпер юг|откр юг"><span>S</span></KeypadCell>
                    <KeypadCell cmd="d" longCmd="отпер вниз|откр вниз"><span>D</span></KeypadCell>
                </tr>
            </tbody>
        </table>
        <button style={hide} id="terminal-activity" className="btn btn-sm btn-ctrl btn-outline-primary"><span></span></button>
    </div>;

export default props => 
    <div id="terminal-wrap" className="flex-grow-shrink-auto">
        <div id="terminal"></div>
        <Overlay />
    </div>;
