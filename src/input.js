
const $ = require('jquery');

var websock = require('./websock');
var send = websock.send;

var settings = require('./settings');

function echo(txt) {
    if (!txt)
        return;

    if (txt.length !== 0) {
        var output = $('<div/>').addClass('echo-with-anchor').text(txt+'\n');
        $('#terminal').trigger('output-html', [output[0].outerHTML]);
    } else {
        $('#terminal').trigger('output', '\n');
    }
}

$(document).ready(function() {

    $('#triggers').on('input', function(e, text) {
        send(text);
    });
});

module.exports = {
    echo: echo
};
