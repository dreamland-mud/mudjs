
const $ = require('jquery');

require('brace');
require('brace/mode/javascript');
require('brace/theme/monokai');

const websock = require('./websock');
const notify = require('./notify');
const send = websock.send;

const echo = txt => {
    $('.terminal').trigger('output', [txt]);
};

let keydown = function(e) {};

const applySettings = s => {
    const settings = `return function(params) {
        'use strict';
        // pupulate local scope from params
        let { keydown, notify, send, echo, $ } = params;
        (function() { ${s} })();
        // return assigned callbacks
        return { keydown };
    }`;

    // assign new values to potentially minified variables
    // eslint-disable-next-line
    const exports = Function(settings)()({ keydown, notify, send, echo, $ });
    keydown = exports.keydown;
};

$(document).ready(function() {
    function hashCode(s) {
        var hash = 0, i, chr;

        if (!s) return hash;

        for (i = 0; i < s.length; i++) {
            chr   = s.charCodeAt(i);
            hash  = ((hash << 5) - hash) + chr;
            hash |= 0; // convert to 32bit integer
        }

        return hash;
    }

    $.ajax({
            url: 'defaults.js',
            datatype: 'text',
            beforeSend: function(xhr) {
                xhr.overrideMimeType('text/plain');
            }
        })
        .then(function(contents) {
            var contentsHash = '' + hashCode(contents);
            var settingsHash = '' + hashCode(localStorage.settings);
            
            // defaults version has changed?
            if(contentsHash !== localStorage.defaultsHash) {
                console.log(contentsHash + ', ' + localStorage.defaultsHash);
                // has user ever edited settings?
                if(localStorage.defaultsHash && settingsHash !== localStorage.defaultsHash) {
                    console.log(settingsHash + ': ' + localStorage.defaultsHash);
                } else {
                    // silently override
                    localStorage.settings = contents;
                }
                localStorage.defaultsHash = contentsHash;
            }

            editor.setValue(localStorage.settings);

            try {
                applySettings(editor.getValue());
            } catch(e) {
                console.log(e);
                echo(e);
            }
        });


    var editor = global.ace.edit($('#settings-modal .editor')[0]);
    editor.setTheme('ace/theme/monokai');
    editor.session.setMode('ace/mode/javascript');

    $('#settings-save-button')
        .click(function(e) {
            e.preventDefault();
            
            $('.trigger').off();
            var val = editor.getValue();
            applySettings(val);
            localStorage.settings = val;
        });
});

module.exports = {
    keydown: function() {
        return keydown;
    } 
};
