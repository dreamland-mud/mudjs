
'use strict';

var websock = require('./websock');
var terminalInit = require('./terminal');
var lastLocation = require('./location');
var sessionId = require('./sessionid')();

require('./notify');
require('./input');
require('./settings');
require('./prompt');
require('./textedit');
require('./cs');

var connect = websock.connect, rpccmd = websock.rpccmd, send = websock.send;


$(window).bind('beforeunload', function() {
    return 'leaving already?';
});

$(document).ready(function() {

    $('#map-button').click(function(e) {
        e.preventDefault();

        if(!lastLocation()) {
            return;
        }

        var basefilename = lastLocation().area.replace(/\.are$/, '');
        var mapfile = '/maps/' + basefilename + '.html?sessionId=' + sessionId;
        window.open(mapfile);
    });


    terminalInit()
        .then(function() {
            connect();
        })
        .catch(function(e) {
            console.log(e);
        });

    $('#reconnect').click(function(e) {
        e.preventDefault();
        connect();
    });

    $('body').on('keydown', function(e) {
        var input = $('#input input');

        // dont autofocus if modal dialog is present
        if($('body.modal-open').length != 0)
            return;

        if(e.ctrlKey || e.altKey)
            return;

        if(input.is(':focus'))
            return;

        input.focus();
    });

    /*
     * Handlers for plus-minus buttons to change terminal font size.
     */ 
    var fontDelta = 2;
    
    function changeFontSize(delta) {
        var terminal = $('#terminal');
        var style = terminal.css('font-size'); 
        var fontSize = parseFloat(style); 
        terminal.css('font-size', (fontSize + delta) + 'px');
    }

    $('#font-plus-button').click(function(e) {
        e.preventDefault();
        changeFontSize(fontDelta);
    });

    $('#font-minus-button').click(function(e) {
        e.preventDefault();
        changeFontSize(-fontDelta);
    });

    /*
     * Handlers for 'keypad' key area.
     */
    // Long press: open/close direction etc.
    var btnTimer;
    var wasLongPress = false;
    var longPressDelay = 800;

    $('.btn-keypad').on('touchstart', function(e) {
        wasLongPress = false;

        // Send specified long-cmd once the delay has elapsed.
        btnTimer = setTimeout(function() {
            btnTimer = null;
            wasLongPress = true;
            var btn = $(e.currentTarget), cmd = btn.data('long-cmd');
            if (cmd) {
                send(cmd);
            }

        }, longPressDelay);

    }).on('touchend', function(e) {
        if (btnTimer)  
            clearTimeout(btnTimer);
    });

    // Single click: go direction, look etc.`
    $('.btn-keypad').click(function(e) {
        if (wasLongPress)
            return;

        e.preventDefault();
        var btn = $(e.currentTarget), cmd = btn.data('cmd');

        if (cmd) {
            send(cmd);
        }
    });

});

