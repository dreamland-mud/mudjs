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
// - A cmd link is refused when an opener that never completed a placeholder,
//   or a cmd placeholder with a wrong nonce, sits earlier in the text: that is
//   player text inside, or right before, a server link, positioned to borrow
//   its nonce (a fake ",nonce=XXXXXXXX]" tail can complete the server's own
//   opener). A server link has one real tail, and a forged link must end in
//   it, so only the next valid-nonce link is refused, and it prints as its
//   label.
// - A cmd action is entity-decoded, refused if it holds a control character
//   (the server's line reader obeys backspace), and written back escaped.
// - Whatever is left, the session's nonce never stays in the text.
//
// The terminal (replacePlaceholders) and the help sheet (replaceCmdLinks,
// helpMarkup.js) run the same tokenizer and differ only in what a link
// renders as.
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
    '|cmd=([^,[\\]]{1,200}),see=([^[\\]]{1,120}),nonce=([A-Za-z0-9]{8})' +
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

// action: decoded and checked by the tokenizer. see: the label as page HTML.
function cmdLink(action, see) {
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

// The one tokenizer. on.map(file, match), on.ed(kind, key, see, match) and
// on.cmd(action, see) render a match; action is entity-decoded, see is page
// HTML.
function tokenize(html, nonce, on) {
  // A nonce the client cannot vouch for makes no link at all.
  if (typeof nonce !== 'string' || !/^[A-Za-z0-9]{8}$/.test(nonce)) nonce = null;

  // Matches arrive in order: the gap before each one is scanned once.
  var stray = false;
  var scanFrom = 0;

  var out = html.replace(
    PLACEHOLDER,
    function (match, mapFile, edKind, edKey, edSee, cmd, cmdSee, n, offset, string) {
      if (!stray && OPENER.test(string.slice(scanFrom, offset))) stray = true;
      scanFrom = offset + match.length;

      if (mapFile !== undefined) return on.map(mapFile, match);
      if (edKind !== undefined) return on.ed(edKind, edKey, edSee, match);

      var label = escapeHtmlAttr(decodeHtmlText(cmdSee));

      // Never this session's server text. It may be a fake tail completing a
      // server link's own opener, so it counts as a stray opener.
      if (nonce === null || n !== nonce) {
        console.log("Invalid nonce in command, someone's up to no good", match);
        stray = true;
        return label;
      }

      if (stray) {
        stray = false;
        return label;
      }

      // A function, so a '$&' or "$'" in the label is not a replacement pattern.
      var action = decodeHtmlText(cmd.replace(/\$1/, function () { return cmdSee; }));
      if (CONTROL_CHAR.test(action)) return label;
      return on.cmd(action, cmdSee);
    }
  );

  // A server link the regex did not match (a label over the cap, a bracket in
  // it) would otherwise print the nonce.
  if (nonce !== null) out = out.replace(new RegExp(',nonce=' + nonce, 'gi'), '');
  return out;
}

// Terminal: html is serialized terminal HTML, opts.nonce the session's nonce
// (ws.nonce), opts.t the i18n lookup.
function replacePlaceholders(html, opts) {
  return tokenize(html, opts.nonce, {
    map: function (file, match) {
      // The map page names its zones in lower case.
      if (file !== file.toLowerCase() || match.slice(1, 4) !== 'map') return match;
      return mapLink(file, opts.t);
    },
    ed: function (kind, key, see) {
      return edLink(kind, key, see, opts.t);
    },
    cmd: cmdLink,
  });
}

// Help sheet: only cmd links become something, button(action, see) renders
// one; map/read/look stay as text.
function replaceCmdLinks(html, nonce, button) {
  var keep = function () { return arguments[arguments.length - 1]; };
  return tokenize(html, nonce, { map: keep, ed: keep, cmd: button });
}

export { replacePlaceholders, replaceCmdLinks };
