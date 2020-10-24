
import React from 'react';
import { useState, useEffect, useRef } from 'react';
import ReactDom from 'react-dom';
import { useSelector } from 'react-redux';
import $ from 'jquery';
import { echo } from '../input';
import settings from '../settings';
import { connect } from '../websock';

const scrollPage = dir => {
    const wrap = $('#terminal-wrap');
    wrap.scrollTop(wrap.scrollTop() + wrap.height()*dir);
};

const input_history = localStorage.history ? JSON.parse(localStorage.history) : [];
let position = input_history.length;
let current_cmd = '';

const CmdInput = props => {
    const connection = useSelector(state => state.connection);
    const [ value, setValue ] = useState('');

    const historyUp = () => {
        if(position > 0) {
            if(position == input_history.length)
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

    const keydown = e => {
        e.stopPropagation();

        if(!e.shiftKey && !e.ctrlKey && !e.altKey) {
            switch(e.which) {
                case 33: // page up
                    e.preventDefault();
                    scrollPage(-0.8);
                    return;
                case 34: // page down
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
            }
        }

        settings.keydown()(e);
    };

    const submit = e => {
        e.preventDefault();
        const t = value;
        setValue('');

        if(t) {
            position = input_history.length;
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
        var lines = t.split('\n');
        $(lines).each(function() {
            echo(this);
            $('.trigger').trigger('input', ['' + this]);
        });
    };

    return connection.connected ?
            <form onSubmit={submit} id="input">
                <input onKeyDown={keydown} value={value} onChange={e => setValue(e.target.value)} type="text" />
            </form> :
            <button onClick={connect} type="button" className="btn btn-primary">Reconnect</button>;
};

export default CmdInput;
