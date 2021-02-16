
const $ = require('jquery');

var sessionId = require('./sessionid')();
var placeholders = require('./data/placeholders.json');

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

/** 
  Choose a placeholder text for the main command input. Placeholders are 
  kept in a json file, per each area and room vnum or generic ones (*).
  Room placeholders can be an array of hint commands, or an entire hint string.
 */
function createPlaceholder(loc) {
    if (!placeholders)
        return '';

    var areahint = placeholders[loc.area] || placeholders["*"];
    if (!areahint) 
        return '';
   
    var roomhints = areahint[loc.vnum] || areahint["*"];
    if (!roomhints) 
        return '';

    if (typeof roomhints === 'string')
        return roomhints;

    if (Array.isArray(roomhints)) {
        var index;

        if (roomhints.length === 0)
            return ''; 
        
        // When just entered a new room, show the first hint as the 'main' one.
        if (!lastLocation || loc.vnum !== lastLocation.vnum)
            index = 0;
        else
            index = Math.floor(Math.random() * roomhints.length);
    
        return 'Введи команду, например: ' + roomhints[index];        
    }

    return '';
}

$(document).ready(function() {
    $('#rpc-events').on('rpc-prompt', function(e, b) {
        var loc = {
            area: b.area,
            vnum: b.vnum
        };
        $("#input input").attr("placeholder", createPlaceholder(loc));
        bcastLocation(loc);
    });
});

module.exports = function() {
    return lastLocation;
};
