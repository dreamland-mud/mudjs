import $ from 'jquery';
import { send, ws } from './websock.js';
import { echo } from './input.js';
import { t } from './i18n.js';

$(document).ready(function () {
  // Control panel buttons.
  $('body').on('click', '.btn-ctrl-panel', function (e) {
    var cmd = $(e.currentTarget).attr('data-action');
    var conf = $(e.currentTarget).attr('data-confirm');

    // data-confirm carries the whole question, already in the player's language.
    if (conf !== undefined && !window.confirm(conf)) return;

    echo(cmd);
    send(cmd);
  });

  // Send comman to the server when command hyper link is clicked
  // e. g. 'read sign' or 'walk trap'.
  $('body').on('click', '.manip-cmd', function (e) {
    var cmd = $(e.currentTarget);
    echo(cmd.attr('data-echo'));
    send(cmd.attr('data-action'));
  });

  // Send command to the server when individual menu item is clicked.
  $('body').on('click', '.manip-item', function (e) {
    var cmd = $(e.currentTarget);
    echo(cmd.attr('data-echo'));
    send(cmd.attr('data-action'));
  });

  // Underline current selection when dropdown is shown.
  $('body').on('show.bs.dropdown', '.dropdown', function (e) {
    $(e.relatedTarget).css('text-decoration', 'underline');
  });

  // Remove underline when dropdown is hidden.
  $('body').on('hide.bs.dropdown', '.dropdown', function (e) {
    $(e.relatedTarget).removeAttr('style');
  });
});

// Replace colour "<c c='fgbr'/>" tags coming from the server with spans.
function colorParseAndReplace(span) {
  span.find('c').each(function (index) {
    var style = $(this).attr('c');
    $(this).replaceWith(function () {
      var result = $('<span/>').append($(this).contents());
      result.addClass(style);
      return result;
    });
  });
}

// Command shapes an <hc cmd='...'> attribute is allowed to send blind, because
// the server generates them and a player cannot forge one that matters. Keep
// every entry anchored and as narrow as the thing that emits it.
var SAFE_HC_COMMANDS = [
  /^path \d{1,7}$/, // clickable room names in 'where' output
];

function safeExplicitAction(value) {
  if (!value) return null;

  var safe = SAFE_HC_COMMANDS.some(function (re) {
    return re.test(value);
  });

  return safe ? value : null;
}

function manipParseAndReplace(span) {
  /* Replace placeholders [map=filename.are] with a link to the zone's page on
   * the maps site. It used to point at /maps/<file>.html -- the old per-zone
   * static page, on the pre-redesign layout -- and was gated on a bundled
   * areas.json that had gone stale at 129 of the game's 158 zones, so the ~29
   * newest zones silently rendered no link at all. The marker only ever
   * appears in a zone article, and every zone the game has is on the map page,
   * so there is nothing left to gate on. */
  var html = span
    .html()
    .replace(/\[map=([-0-9a-z_]{1,15})\.are\]/g, function (match, p1, string) {
      return (
        '<a class="btn btn-sm btn-outline-info btn-orange" ' +
        'href="https://dreamland.rocks/maps.html#' +
        p1 +
        '" target=_blank>' +
        t('help.openMap') +
        '</a>'
      );
    });

  // Replace extra-description placeholders [read=sign знак,see=sign] with <span class="manip-cmd manip-ed" data-action="read 'sign знак'">sign</span>.
  // The link styling is the affordance in the web client; the literal (parentheses)
  // stay telnet-only (server keeps them in the {IW non-web branch of decorateExtraDescr).
  // Returns empty string if 'see' part is not contained within 'read' part.
  html = html.replace(
    /\[read=([^,]{1,200}),see=([^\]]{1,30})]/gi,
    function (match, p1, p2, string) {
      if (p1.toLowerCase().split(' ').indexOf(p2.toLowerCase()) === -1)
        return '';
      return (
        '<span class="manip-cmd manip-ed" data-action="read \'' +
        p1 +
        '\'" data-echo="' + t('echo.read') + ' ' +
        p2 +
        '">' +
        p2 +
        '</span>'
      );
    }
  );

  // Replace exit-keyword placeholders [look=door,see=door] with a clickable
  // <span> that sends "look door" -- room exits resolve via 'look', not 'read'.
  html = html.replace(
    /\[look=([^,]{1,200}),see=([^\]]{1,30})]/gi,
    function (match, p1, p2, string) {
      return (
        '<span class="manip-cmd manip-ed" data-action="look ' +
        p1 +
        '" data-echo="' + t('echo.look') + ' ' +
        p2 +
        '">' +
        p2 +
        '</span>'
      );
    }
  );

  // Replace random commands with data-action span.
  html = html.replace(
    /\[cmd=([^,]{1,200}),see=([^\]]{1,50}),nonce=(.{8})]/gi,
    function (match, cmd, see, nonce, string) {
      // Ensure the command is coming from the server.
      if (nonce !== ws?.nonce) {
        console.log(
          "Invalid nonce in command, someone's up to no good",
          string
        );
        return string;
      }

      // Replace argument placeholder.
      var action = cmd.replace(/\$1/, see);

      // The link will only surround the message itself, spaces are not underlined.
      return see.replace(
        /^( *)(.*[^ ])( *)$/,
        function (match, spaceBegin, msg, spaceEnd, string) {
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
        }
      );
    }
  );

  span.html(html);

  // Replace "<hc>command</hc>" tags surrounding commands to send as is.
  // With a cmd attribute -- "<hc cmd='path 3001'>Market Square</hc>" -- the
  // label and the command it sends are allowed to differ.
  //
  // That split is only safe behind an allowlist. Player-typed text reaches other
  // players with its {h tags intact (the server strips them in exactly one
  // place, title.cpp, because titles are player-controlled), so an arbitrary cmd
  // attribute would be a phishing tool: an innocent-looking room name hiding
  // "give all.coins Vasya", sent from the reader's own character on one click,
  // with the echo revealing it only afterwards. A rejected cmd falls back to the
  // label, which is the pre-existing behaviour and merely answers "Huh?".
  //
  // Adding a use of the cmd attribute on the server means adding its shape here.
  span.find('hc').each(function (index) {
    var cmd = $(this).contents();
    var explicitAction = safeExplicitAction($(this).attr('cmd'));

    $(this).replaceWith(function () {
      var action = explicitAction || cmd.text();
      var result = $('<span/>')
        .addClass('manip-cmd')
        .attr('data-action', action)
        .attr('data-echo', action)
        .append(cmd);
      return result;
    });
  });

  // Replace "<hl>hyper link</hl>" tags surrounding hyper links.
  // Basic sanitization of the links.
  span.find('hl').each(function (index) {
    var content = $(this).contents();
    var href = content.text();
    if (!href.startsWith('http')) return;

    $(this).replaceWith(function () {
      var result = $('<a target=_blank />')
        .addClass('manip-link')
        .attr('href', href)
        .append(content);
      return result;
    });
  });

  // Replace "<hh>article name</hh>" or "<hh id='333'>" tags surrounding help articles.
  span.find('hh').each(function (index) {
    var article = $(this).contents().text();
    var id = $(this).attr('id') || article;

    // Split the string into <initial spaces><label ending with non-space><ending spaces>
    var matches = article.match(/^( *)([\0-\uFFFF]*[^ ])( *)$/m);
    if (!matches || matches.length < 4) {
      // Do nothing for invalid help links.
      return;
    }

    var spaceBegin = matches[1].length;
    var spaceEnd = matches[3].length;
    var label = matches[2];

    $(this).replaceWith(function () {
      // Recreate initial and ending spaces as nbsp, so that the underlining link only surrounds the label.
      var result =
        '&nbsp;'.repeat(spaceBegin) +
        $('<span/>')
          .addClass('manip-cmd')
          .addClass('manip-link')
          .attr('data-action', 'help ' + id)
          .attr('data-echo', t('echo.help') + ' ' + id)
          .append(label)
          .get(0).outerHTML +
        '&nbsp;'.repeat(spaceEnd);
      return result;
    });
  });

  // Replace "<hg>skill group</hg>" tags surrounding group names.
  span.find('hg').each(function (index) {
    var article = $(this).contents();

    $(this).replaceWith(function () {
      var result = $('<span/>')
        .addClass('manip-cmd')
        .attr('data-action', 'glist ' + article.text())
        .attr('data-echo', t('echo.glist') + ' ' + article.text())
        .append(article);
      return result;
    });
  });

  // Replace "<hs>speedwalk</hs>" tags with 'run speedwalk' command.
  span.find('hs').each(function (index) {
    var article = $(this).contents();

    $(this).replaceWith(function () {
      var result = $('<span/>')
        .addClass('manip-cmd')
        .addClass('manip-speedwalk')
        .attr('data-action', 'run ' + article.text())
        .attr('data-echo', t('echo.run') + ' ' + article.text())
        .append(article);
      return result;
    });
  });

  // Replace item manipulation "<m i='234234' c='take $,put $ 12348'/>" tags surrounding every item.
  span.find('m').each(function (index) {
    // Populate menu node for each item based on the 'c' and 'l' attributes containing command lists.
    // Mark menu nodes so that they can be removed and not mess up the triggers.
    var id = $(this).attr('i');
    var menu = $('<span class="dropdown-menu no-triggers" />');

    function addToMenu(cmd) {
      if (cmd.trim().length === 0) return;
      var action = cmd.replace(/\$/, id);
      // Menu entry visible to the user will only contain a meaningful word, without IDs or $ placeholders.
      var label = cmd.replace(/( *\$ *| *[0-9]{5,}|\.'.*')/g, '');
      menu.append(
        $('<a/>')
          .addClass('dropdown-item')
          .addClass('manip-item')
          .attr('data-action', action)
          .attr('href', '#')
          .append(label)
      );
    }

    // Main commands above the divider.
    if (this.hasAttribute('c'))
      $(this)
        .attr('c')
        .split(',')
        .map(function (cmd) {
          addToMenu(cmd);
          return cmd;
        });

    // Commands only available in this room, below the divider.
    if (this.hasAttribute('l')) {
      var divider = $('<div/>').addClass('dropdown-divider');
      menu.append(divider);
      $(this)
        .attr('l')
        .split(',')
        .map(function (cmd) {
          addToMenu(cmd);
          return cmd;
        });
    }

    // Create drop-down toggle from item description text.
    var toggle = $(
      '<span class="dropdown-toggle" data-toggle="dropdown"/>'
    ).append($(this).contents());

    // Replace '<m>' pseudo-tag with Popper dropdown markup.
    $(this).replaceWith(function () {
      var result = $('<span class="dropdown-norelative"/>')
        .append(toggle)
        .append(menu);
      return result;
    });
  });
}

export default {
  manipParseAndReplace,
  colorParseAndReplace,
};
