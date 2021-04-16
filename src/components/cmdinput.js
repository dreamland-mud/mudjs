
import React from 'react';
import { useState } from 'react';
import { useSelector } from 'react-redux';
import $ from 'jquery';
import { echo } from '../input';
import { send } from '../websock';
import settings from '../settings';
import { connect } from '../websock';
import { makeStyles } from '@material-ui/core/styles';
import useMediaQuery from '@material-ui/core/useMediaQuery';
import Commands, { splitCommand, echoHtml, errCmdDoesNotExist } from './SysCommands'


$('body').on('click', '.builtin-cmd', function(e) {
    var cmd = $(e.currentTarget);
    const { sysCmd,  sysCmdArgs} = splitCommand(cmd.attr('data-action'))
    echo(cmd.attr('data-echo'));
    Commands[sysCmd]['payload'](sysCmdArgs);
});

const scrollPage = dir => {
    const wrap = $('.terminal-wrap');
    wrap.scrollTop(wrap.scrollTop() + wrap.height()*dir);
};

const useStyles = makeStyles(theme => ({
    activity: {
        flexDirection: 'row'
    },
    btn: {
        pointerEvents: 'all',
        height: "1.7em",
        width: "1.7em"
    },
    history: {
        position: 'absolute',
        bottom: 0,
        right: 0
    }
}));


const input_history = localStorage.history ? JSON.parse(localStorage.history) : [];
let position = input_history.length;
let current_cmd = '';

// This component draws either a "Reconnect" button or the main input field for the terminal.
// Handles command history browsing and terminal scrolling (pgUp/pgDown).
const CmdInput = props => {
    const classes = useStyles();
    const big = useMediaQuery(theme => theme.breakpoints.up('sm'));
    // A hook to access the redux store's state; takes a selector function as an argument. 
    // The selector is called with the store state. Component's render will be called only when
    // 'connection' field has changed.
    const connection = useSelector(state => state.connection);
    // Input box value.
    const [ value, setValue ] = useState('');

    function saveCmd(t) {
        if(t) {
            position = input_history.length;
            if (input_history.length === 0 || t !== input_history[input_history.length-1]) {
                    input_history[position++] = t;

                    let drop = input_history.length - 1000; // store only 1000 most recent entries;
                
                    if(drop < 0)
                        drop = 0;
                
                    const save = JSON.stringify(input_history.slice(drop));
                
                    try {
                        localStorage.history = save;
                    } catch(e) {
                        console.log('Opps, saving command history to the local storage: save.length=' + save.length, e);
                    }
            }
	    }
    }

    // Arrow up. Retrieve previous command from history and populate the input box.
    // Called from onKeyDown handler.
    const historyUp = () => {
        if(position > 0) {
            if(position === input_history.length)
                current_cmd = value;

            for(var i=position-1;i >= 0;i--) {
                if(input_history[i].indexOf(current_cmd) >= 0) {
                    var v = input_history[(position=i)];
                    setValue(v);
                    return;
                }
            }
        }
    };

    // Arrow down. Retrieve next command, if any, and populate the input box.
    // Called from onKeyDown handler.
    const historyDown = () => {
        if(position < input_history.length) {
            var i;
            for(i=position+1;i < input_history.length;i++) {
                if(input_history[i].indexOf(current_cmd) >= 0) {
                    var v = input_history[(position=i)];
                    setValue(v);
                    return;
                }
            }
            position=i;
            setValue(current_cmd);
        }
    };

    const historyRepeat = () => {
        let cmd;

        if (!input_history[position]) {
            cmd = input_history[position-1]
        } else {
            cmd = input_history[position]
        }
        setValue('');
        position = input_history.length;
        saveCmd(cmd)
        echo(cmd)
        send(cmd)
    }

    // Main onKeyDown handler. Reacts to pageUp/pageDown to scroll the main terminal window,
    // arrow keys to navigate history, and passes everything else to the user-defined triggers (settings).
    const keydown = e => {
        e.stopPropagation();
        const isPgKeysScroll = localStorage.properties ? JSON.parse(localStorage.properties)['isPgKeysScroll'] : true
  
        if(!e.shiftKey && !e.ctrlKey && !e.altKey) {
            switch(e.which) {
                case 33: // page up
                    if (!isPgKeysScroll) return
                    e.preventDefault();
                    scrollPage(-0.8);
                    return;
                case 34: // page down
                    if (!isPgKeysScroll) return
                    e.preventDefault();
                    scrollPage(0.8);
                    return;
                case 38: // up
                    e.preventDefault();
                    historyUp();
                    return;
                case 40: // down
                    e.preventDefault();
                    historyDown();
                    return;
                default:
                    break;
            }
        }

        // Call user settings.
        settings.keydown()(e);
    };

    // Handles enter key. Records command in history and passes it to the server via 'input' trigger.
    // Allows to paste multi-line text.
    const submit = e => {
        e.preventDefault();
        const userCommand = value;
        const commandList = Commands
        setValue('');
        saveCmd(userCommand)

        //Check if string is system command
        if (userCommand.startsWith('#')) {
            echo(userCommand)
            const { sysCmd,  sysCmdArgs} = splitCommand(userCommand)
            if (Number.isInteger(+sysCmd)) {
                saveCmd(userCommand)
                commandList['multiCmd']['payload'](userCommand)
                return
            }
            if (sysCmd.length < 3) {
                return echoHtml(errCmdDoesNotExist)
            }
            const re = new RegExp(sysCmd)
            for (let command in commandList) {
                if (re.test(command)) {
                    commandList[command]['payload'](sysCmdArgs)
                    return 
                }
            }
            return echoHtml(errCmdDoesNotExist)
        }
        
        var lines = userCommand.split('\n')
        $(lines).each(function() {
            echo(this)
            $('.trigger').trigger('input', ['' + this])
        })
    }

    // Draws either 'Reconnect' button or input box, depending on the global state.
    // onChange ensures that the state of this component changes whenever user inputs something.
    // Current 'value' state is used from all key handlers.
    return connection.connected ?
            <div flex="1" className={classes.activity}>
                <form onSubmit={submit} id="input">
                    <input id="inputBox" onKeyDown={keydown} value={value} onChange={e => setValue(e.target.value)} type="text" autoComplete="off" />
                </form> 
                { !big > 0 &&
                <table className={classes.history}>
                    <tbody>
                        <tr>
                            <button onClick={historyRepeat} cmd="repeat" className={`btn btn-sm btn-ctrl btn-outline-primary ${classes.btn}`}><i className="fa fa-repeat"></i></button>
                            <button onClick={historyDown} cmd="history-down" className={`btn btn-sm btn-ctrl btn-outline-primary ${classes.btn}`}><i className="fa fa-arrow-down"></i></button>
                            <button onClick={historyUp} cmd="history-up" className={`btn btn-sm btn-ctrl btn-outline-primary ${classes.btn}`}><i className="fa fa-arrow-up"></i></button>		    
                        </tr>
                    </tbody>
                </table>
                }
            </div> :
            <button onClick={connect} type="button" className="btn btn-primary">Reconnect</button>;
};

export default CmdInput;
