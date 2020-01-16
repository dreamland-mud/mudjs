
const $ = require('jquery');

$(document).ready(function() {
    if('Notification' in window) {
        Promise.resolve(Notification.permission)
            .then(function(perm) {
                if(perm === 'granted') {
                    return perm;
                } else {
                    return Notification.requestPermission();
                }
            })
            .then(function(perm) {
                if(perm === 'granted') {
                    $('#rpc-events')
                        .on('rpc-notify', function(e, text) {
                            if(document.hidden) {
                                new Notification(text);
                            }
                        });
                }
            });
    }
});

function notify(txt) {
    $('#rpc-events').trigger('rpc-notify', [txt]);
}

module.exports = notify;
