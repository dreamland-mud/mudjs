// Bracket placeholders in server output, turned into links in ONE replace:
//   [map=file.are]          a button to the zone's page on the maps site
//   [read=KEYWORDS,see=L]   extra description: click sends "examine 'KEYWORDS'"
//   [look=KEYWORD,see=L]    room exit: click sends "look KEYWORD"
//   [cmd=C,see=L,nonce=N]   any command, server-made, valid only with the
//                           session's nonce (websocketrpc.cpp web_cmd)
//
// Player text reaches the terminal with only < and > escaped, so a player can
// type any of these into a channel, a title or a config field. Rules that keep
// that harmless:
// - One regex, one pass: no placeholder is ever read out of markup an earlier
//   pass generated, or out of text an earlier pass deleted.
// - No part may hold '[' or ']', so a match never spans another placeholder's
//   opener.
// - read/look carry no nonce, so their parts must pass an allowlist (letters,
//   digits, space, _ ' . -) after entity decoding. Server keywords never hold
//   anything else. A refused one prints its label as plain text.
// - A cmd link is refused when an opener that never completed a placeholder
//   sits earlier in the text: that is player text inside, or right before, a
//   server link, positioned to borrow its nonce. The link prints without its
//   nonce.
// - A cmd action is entity-decoded, refused if it holds a control character
//   (the server's line reader obeys backspace), and written back escaped.
//
// No imports: the test in test/placeholder-injection.cjs loads this file as is.
// Needs a global `document` for entity decoding.

function decodeHtmlText(s) {
  // A textarea's content is raw text: nothing in it is parsed into elements,
  // so this cannot run script or load anything.
  var el = document.createElement('textarea');
  el.innerHTML = s;
  return el.value;
}

function escapeHtmlAttr(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

var SAFE_PART = /^[\p{L}\p{N} _'.-]+$/u;
var CONTROL_CHAR = /[\x00-\x1f\x7f]/;
var OPENER = /\[(?:cmd|read|look)=/i;

var PLACEHOLDER = new RegExp(
  '\\[(?:' +
    'map=([-0-9a-z_]{1,15})\\.are' +
    '|(read|look)=([^,[\\]]{1,200}),see=([^[\\]]{1,30})' +
    '|cmd=([^,[\\]]{1,200}),see=([^[\\]]{1,50}),nonce=([A-Za-z0-9]{8})' +
  ')\\]',
  'gi'
);

function safePart(s) {
  var plain = decodeHtmlText(s);
  return SAFE_PART.test(plain) ? plain : null;
}

function mapLink(file, t) {
  return (
    '<a class="btn btn-sm btn-primary" ' +
    'href="https://dreamland.rocks/maps.html#' +
    file +
    '" target=_blank>' +
    t('help.openMap') +
    '</a>'
  );
}

function edLink(kind, rawKey, rawSee, t) {
  var key = safePart(rawKey);
  var see = safePart(rawSee);
  if (key === null || see === null) return escapeHtmlAttr(decodeHtmlText(rawSee));

  var action, echo;
  if (kind.toLowerCase() === 'read') {
    // A read whose label is not a word of its keywords renders as nothing.
    if (key.toLowerCase().split(' ').indexOf(see.toLowerCase()) === -1) return '';
    // The read tag keeps its historical name; 'examine' resolves room and
    // object extra descriptions on the server.
    action = "examine '" + key + "'";
    echo = t('echo.examine') + ' ' + see;
  } else {
    // Room exits resolve via 'look', not 'read'.
    action = 'look ' + key;
    echo = t('echo.look') + ' ' + see;
  }

  return (
    '<span class="manip-cmd manip-ed" data-action="' +
    escapeHtmlAttr(action) +
    '" data-echo="' +
    escapeHtmlAttr(echo) +
    '">' +
    escapeHtmlAttr(see) +
    '</span>'
  );
}

function cmdLink(cmd, see) {
  // A function, so a '$&' or "$'" in the label is not a replacement pattern.
  var action = decodeHtmlText(cmd.replace(/\$1/, function () { return see; }));
  if (CONTROL_CHAR.test(action)) return null;
  action = escapeHtmlAttr(action);

  // The link only surrounds the label itself, spaces are not underlined.
  return see.replace(/^( *)(.*[^ ])( *)$/, function (all, spaceBegin, msg, spaceEnd) {
    var label;
    switch (msg) {
      case 'edit':
        label = '<i class="fa fa-edit"></i>';
        break;
      case 'save':
      case 'done':
        label = '<i class="fa fa-save"></i>';
        break;
      case 'cancel':
        label = '<i class="fa fa-window-close"></i>';
        break;
      case 'show':
        label = '<i class="fa fa-eye"></i>';
        break;
      default:
        // Already HTML from the page, and nonce-checked: kept as it came.
        label = msg;
        break;
    }

    return (
      '&nbsp;'.repeat(spaceBegin.length) +
      '<span class="manip-cmd" data-action="' +
      action +
      '" data-echo="' +
      action +
      '">' +
      label +
      '</span>' +
      '&nbsp;'.repeat(spaceEnd.length)
    );
  });
}

// html: serialized terminal HTML. opts.nonce: the session's nonce (ws.nonce),
// opts.t: the i18n lookup.
function replacePlaceholders(html, opts) {
  // Matches arrive in order. An opener in the text between two matches never
  // completed a placeholder; once one is seen, no later cmd link is trusted.
  var stray = false;
  var scanFrom = 0;

  return html.replace(
    PLACEHOLDER,
    function (match, mapFile, edKind, edKey, edSee, cmd, cmdSee, nonce, offset, string) {
      if (!stray && OPENER.test(string.slice(scanFrom, offset))) stray = true;
      scanFrom = offset + match.length;

      if (mapFile !== undefined) {
        // The map page names its zones in lower case.
        if (mapFile !== mapFile.toLowerCase() || match.slice(1, 4) !== 'map') return match;
        return mapLink(mapFile, opts.t);
      }

      if (edKind !== undefined) return edLink(edKind, edKey, edSee, opts.t);

      // Ensure the command is coming from the server.
      if (!opts.nonce || nonce !== opts.nonce) {
        console.log("Invalid nonce in command, someone's up to no good", match);
        return match;
      }

      // From here on the nonce is real: never print it back as text.
      var link = stray ? null : cmdLink(cmd, cmdSee);
      if (link === null) return match.replace(/,nonce=[A-Za-z0-9]{8}\]$/, ']');
      return link;
    }
  );
}

export { replacePlaceholders };
