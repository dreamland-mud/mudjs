import $ from 'jquery';
import getSessionId from './sessionid.js';
import placeholders from './data/placeholders.json' assert { type: 'json' };
import { fmt } from './i18n';

const sessionId = getSessionId();
var lastLocation, locationChannel;
// Remembered across prompts: the server may send the player's sex once (delta prompt), so
// hold the last value seen and keep attaching it to every location broadcast.
var lastSex;
// Same delta-prompt treatment for the display language ("en"/"ru"/"ua"): the web prompt
// carries it (interprethandler.cpp webPrompt -> Player::displayLang), and the map switches
// its room/area names + UI chrome to it. Held so a `config language` change propagates.
var lastLang;

if ('BroadcastChannel' in window) {
  locationChannel = new BroadcastChannel('location');

  locationChannel.onmessage = function (e) {
    if (e.data.what === 'where am i' && lastLocation) {
      bcastLocation(lastLocation);
    }
  };
}

function bcastLocation(loc) {
  lastLocation = loc;

  if (locationChannel) {
    locationChannel.postMessage({
      what: 'location',
      location: lastLocation,
      sessionId: sessionId,
    });
  }
}

/** 
  Choose a placeholder text for the main command input. Placeholders are 
  kept in a json file, per each area and room vnum or generic ones (*).
  Room placeholders can be an array of hint commands, or an entire hint string.
 */
function createPlaceholder(loc) {
  if (!placeholders) return '';

  var areahint = placeholders[loc.area] || placeholders['*'];
  if (!areahint) return '';

  var roomhints = areahint[loc.vnum] || areahint['*'];
  if (!roomhints) return '';

  if (typeof roomhints === 'string') return roomhints;

  if (Array.isArray(roomhints)) {
    var index;

    if (roomhints.length === 0) return '';

    // When just entered a new room, show the first hint as the 'main' one.
    if (!lastLocation || loc.vnum !== lastLocation.vnum) index = 0;
    else index = Math.floor(Math.random() * roomhints.length);

    return fmt('ph.example', roomhints[index], loc.lang);
  }

  return '';
}

$(document).ready(function () {
  $('#rpc-events').on('rpc-prompt', function (e, b) {
    if (b.sex != null) lastSex = b.sex;
    if (b.lang != null) lastLang = b.lang;
    var loc = {
      area: b.area,
      vnum: b.vnum,
      sex: lastSex,
      lang: lastLang,
    };
    $('#input input').attr('placeholder', createPlaceholder(loc));
    bcastLocation(loc);
  });
});

export default function getLastLocation() {
  return lastLocation;
}
