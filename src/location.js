
var sessionId = require('./sessionid')();

var lastLocation, locationChannel;

if('BroadcastChannel' in window) {
    locationChannel = new BroadcastChannel('location');

    locationChannel.onmessage = function(e) {
        if(e.data.what === 'where am i' && lastLocation) {
            bcastLocation(lastLocation);
        }
    };
}

function bcastLocation(loc) {
    lastLocation = loc;

    if(locationChannel) {
        locationChannel.postMessage({
            what: 'location',
            location: lastLocation,
            sessionId: sessionId
        });
    }
};

$(document).ready(function() {
    $('#rpc-events').on('rpc-prompt', function(e, b) {
        bcastLocation({
            area: b.area,
            vnum: b.vnum
        });
    });
});

module.exports = function() {
    return lastLocation;
};
