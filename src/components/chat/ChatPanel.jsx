import React, { useCallback, useEffect, useRef, useState } from 'react';
import $ from 'jquery';

import ansi2html from '../../ansi2html.js';
import manip from '../../manip.js';
import chatDb from '../../chatdb.js';
import { rpccmd, send } from '../../websock.js';
import { getLang, t } from '../../i18n.js';
import './chat.css';

// The conversation panel: every channel line, tell, yell and mob reply the
// server mirrors as a `chat` frame (dreamland_code: chat frames), kept per
// character and shown as one thread you can answer from.
//
// It slides in from the right like the settings sheet, and unlike it can be
// PINNED: pinned, it stops floating over the game and takes width of its own,
// which the map gives up (chat.css moves .mosaic-root's right edge).
//
// History lives in IndexedDB (chatdb.js), one shelf per character. The panel
// holds a WINDOW of the newest lines and reaches into the archive when the
// player scrolls up -- the same arrangement the terminal has, and for the same
// reason: an evening of gossip is thousands of lines, and painting them all
// would cost the page a freeze on every new one.
const WINDOW = 300;
const PAGE = 100;

// Wide enough for a name, a verb and a sentence without wrapping every line.
const MIN_WIDTH = 320;
const DEFAULT_WIDTH = 420;
const WIDTH_KEY = 'mudjs.chat.width';
const PIN_KEY = 'mudjs.chat.pinned';
// Open or closed is remembered too: a panel pinned beside the map is part of
// how the player has arranged the window, and a reload that silently drops it
// looks like a fault.
const OPEN_KEY = 'mudjs.chat.open';

// Near enough to the bottom to count as reading the newest: a line that arrives
// now should scroll into view instead of raising the unread count.
const GLUE = 40;
// Far enough up to start fetching the previous page before the player hits the
// top and sees the scrollbar stop.
const REACH = 160;

function readNumber(key, fallback) {
  try {
    const saved = parseInt(localStorage.getItem(key), 10);
    return Number.isFinite(saved) ? saved : fallback;
  } catch (e) {
    return fallback;
  }
}

function readFlag(key) {
  try {
    return localStorage.getItem(key) === '1';
  } catch (e) {
    return false;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    /* storage disabled: the choice lives for this session only */
  }
}

function clock(at) {
  const d = new Date((at || 0) * 1000);
  return (
    String(d.getHours()).padStart(2, '0') +
    ':' +
    String(d.getMinutes()).padStart(2, '0')
  );
}

function dayOf(at) {
  const d = new Date((at || 0) * 1000);
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

function dayLabel(at, lang) {
  const today = dayOf(Date.now() / 1000);
  const day = dayOf(at);
  if (day === today) return t('chat.today', lang);
  if (day === dayOf(Date.now() / 1000 - 86400)) return t('chat.yesterday', lang);
  const d = new Date((at || 0) * 1000);
  return d.toLocaleDateString(lang === 'en' ? 'en-GB' : 'ru-RU');
}

// THE GAME'S MARKUP, TURNED INTO THE GAME'S COLOUR -- the same two steps the
// terminal takes (terminal.jsx). ansi2html alone is not enough: DreamLand does
// not send ANSI to a web client, it sends its own <c c='fgby'> tags, and those
// become real colour only after colorParseAndReplace rewrites them as spans
// with the palette's class names. Skipping it left the panel grey and printed
// raw tags into the quoted line.
function paint(text) {
  const span = $('<span/>');
  span.html(ansi2html(String(text || '')));
  manip.colorParseAndReplace(span);
  return span.html();
}

// PAINTED ONCE, WHEN THE LINE ARRIVES -- not on every render. The feed holds
// three hundred lines and re-renders on every keystroke in the answer box;
// running the markup through jQuery three hundred times a letter is a freeze
// waiting to happen. The html rides on the row in memory and is never written
// to the archive: the archive keeps what the server said, and how it is drawn
// is this version of the panel's business.
function dress(row) {
  return Object.assign({}, row, { html: paint(row.text) });
}

// The same text with every tag taken off: the footer quotes a line as a
// reminder, and a reminder wearing markup is unreadable.
function plain(text) {
  return $('<div/>')
    .html(ansi2html(String(text || '')))
    .text();
}

// THE TEXT KEEPS THE GAME'S OWN COLOUR. The frame carries the line rendered
// exactly as the console rendered it -- the server's markup, this player's
// palette and language -- so the panel paints a bar in the margin instead of
// repainting the words. Repainting would mean the same line reads one way in
// the terminal and another here, and the panel would be lying about what the
// game said.
const MARKS = {
  say: 'say',
  emote: 'say',
  tell: 'tell',
  reply: 'tell',
  page: 'tell',
  gossip: 'gossip',
  music: 'gossip',
  ic: 'gossip',
  ooc: 'gossip',
  rtalk: 'gossip',
  auction: 'auction',
  grats: 'auction',
  cb: 'clan',
  ctalk: 'clan',
  mtalk: 'clan',
  yell: 'yell',
  shout: 'yell',
  immtalk: 'imm',
  godwiz: 'imm',
};

function toneOf(line) {
  if (line.dir === 'out') return 'chat-ch-own';
  if (line.kind === 'mob') return 'chat-ch-mob';
  if (line.kind === 'group') return 'chat-ch-group';
  if (MARKS[line.chan]) return 'chat-ch-' + MARKS[line.chan];
  if (line.kind === 'personal') return 'chat-ch-tell';
  return 'chat-ch-other';
}

// What to send when the player answers this line. A personal channel answers
// the speaker by name; any other channel answers the channel itself. An unseen
// speaker and a mob cannot be answered at all -- the first because the server
// deliberately withheld the name, the second because a quest is played in the
// game, not typed at a panel.
function replyTo(line) {
  if (!line) return null;
  if (line.anon) return { blocked: 'anon', id: line.id };
  if (line.kind === 'mob') return { blocked: 'npc', id: line.id };
  if (line.kind === 'personal' && line.key) {
    return { command: 'tell ' + line.key, name: line.name, quote: plain(line.text), id: line.id };
  }
  if (!line.chan) return null;
  return { command: line.chan, name: null, quote: plain(line.text), id: line.id };
}

export default function ChatPanel() {
  const [open, setOpen] = useState(readFlag(OPEN_KEY));
  const [pinned, setPinned] = useState(readFlag(PIN_KEY));
  const [width, setWidth] = useState(() =>
    Math.max(MIN_WIDTH, readNumber(WIDTH_KEY, DEFAULT_WIDTH))
  );
  const [lang, setLang] = useState(getLang());
  const [who, setWho] = useState(null);
  const [lines, setLines] = useState([]);
  const [target, setTarget] = useState(null);
  const [draft, setDraft] = useState('');
  const [onlyMine, setOnlyMine] = useState(false);
  const [unread, setUnread] = useState(0);
  const [more, setMore] = useState(true);

  const feed = useRef(null);
  const input = useRef(null);
  const sheet = useRef(null);
  // Read by event handlers that are registered once and must not close over a
  // stale render: jQuery keeps the first handler, React keeps handing out new
  // state.
  const live = useRef({ open: false, who: null, glued: true });

  live.current.open = open;
  live.current.who = who;

  const scrollDown = useCallback(() => {
    const node = feed.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, []);

  /* ---- subscription ---------------------------------------------------- */

  // Asked for once per socket, and ONLY over a socket that is already open.
  //
  // NOT rpcWhenOpen: that helper makes a frame the socket's OPENING WORDS
  // (answerFreshSocket), and the opening words are spoken for: they answer the
  // server's codepage menu with '1'. A panel that leads with chat_subscribe
  // takes that turn away -- the menu is never answered, the login sits there
  // waiting, and the player watches a codepage prompt that the client used to
  // clear before they ever saw it.
  //
  // rpc-version is the right hook: the server says it the moment a socket is
  // up, after the codepage answer has gone out, and it says it again on every
  // reconnect -- which is exactly when the subscription has to be renewed.
  useEffect(() => {
    const subscribe = () => rpccmd('chat_subscribe', 1);
    subscribe();
    $('#rpc-events').on('rpc-version.chat-sub', subscribe);
    return () => $('#rpc-events').off('.chat-sub');
  }, []);

  // chat_state says who is playing. A different character means a different
  // shelf: the previous one's conversation must not stay on screen.
  useEffect(() => {
    const onState = (e, b) => {
      const name = (b && b.who) || null;
      setWho(was => (was === name ? was : name));
    };
    $('#rpc-events').on('rpc-chat_state.chat', onState);
    return () => $('#rpc-events').off('rpc-chat_state.chat', onState);
  }, []);

  /* ---- history --------------------------------------------------------- */

  useEffect(() => {
    let alive = true;
    if (!who) {
      setLines([]);
      setMore(false);
      return undefined;
    }
    chatDb.then(db => db.loadLast(who, WINDOW)).then(rows => {
      if (!alive) return;
      setLines(rows.map(dress));
      setMore(rows.length >= WINDOW);
      // After the shelf is painted, not before: scrollHeight is nothing until
      // the rows exist.
      window.requestAnimationFrame(scrollDown);
    });
    return () => {
      alive = false;
    };
  }, [who, scrollDown]);

  // Every frame: to the archive first, to the screen second. The id the archive
  // hands back is what the older-page reads walk backwards from, so a line
  // without one would break the seam.
  useEffect(() => {
    const onChat = (e, b) => {
      const name = live.current.who;
      if (!name || !b) return;

      const row = {
        at: b.at || Math.floor(Date.now() / 1000),
        chan: b.id || '',
        kind: b.kind || 'world',
        dir: b.dir || 'in',
        text: b.text || '',
        name: (b.peer && b.peer.name) || '',
        anon: !!(b.peer && b.peer.anon),
        npc: !!(b.peer && b.peer.npc),
        key: (b.peer && b.peer.key) || '',
        area: b.area || '',
        quest: b.quest || 0,
        step: b.step || 0,
      };

      chatDb
        .then(db => db.append(name, row))
        .then(saved => {
          // The shelf may have changed hands while the write was in flight.
          if (live.current.who !== name) return;
          setLines(was => {
            const next = was.concat(dress(saved));
            return next.length > WINDOW + PAGE ? next.slice(-WINDOW) : next;
          });
          if (live.current.glued && live.current.open) {
            window.requestAnimationFrame(scrollDown);
          } else {
            setUnread(n => n + 1);
          }
        });
    };

    $('#rpc-events').on('rpc-chat.chat', onChat);
    return () => $('#rpc-events').off('rpc-chat.chat', onChat);
  }, [scrollDown]);

  // Reaching up for the previous page. The scroll position is kept by height
  // difference rather than by row: rows are not a fixed height, and anchoring
  // to one of them would jump whenever a long line wrapped.
  const reachBack = useCallback(() => {
    const node = feed.current;
    if (!node || !who || !lines.length) return;
    const oldest = lines[0];
    if (!oldest || !oldest.id) return;

    const before = node.scrollHeight;
    chatDb.then(db => db.loadOlder(who, oldest.id, PAGE)).then(rows => {
      if (!rows.length) {
        setMore(false);
        return;
      }
      setLines(was => rows.map(dress).concat(was));
      window.requestAnimationFrame(() => {
        const after = feed.current;
        if (after) after.scrollTop += after.scrollHeight - before;
      });
    });
  }, [who, lines]);

  const onScroll = useCallback(() => {
    const node = feed.current;
    if (!node) return;
    const bottom = node.scrollHeight - node.scrollTop - node.clientHeight;
    live.current.glued = bottom <= GLUE;
    if (live.current.glued) setUnread(0);
    if (more && node.scrollTop < REACH) reachBack();
  }, [more, reachBack]);

  /* ---- opening, pinning, width ----------------------------------------- */

  useEffect(() => {
    const onOpen = () => {
      setOpen(was => !was);
      setUnread(0);
      live.current.glued = true;
      window.requestAnimationFrame(scrollDown);
    };
    $(document).on('chat:open', onOpen);
    return () => $(document).off('chat:open', onOpen);
  }, [scrollDown]);

  useEffect(() => {
    write(OPEN_KEY, open ? '1' : '0');
  }, [open]);

  // THE PANEL IS AS TALL AS THE GAME AREA, NOT AS THE WINDOW. Below the mosaic
  // live the vital bars, and a sheet that runs to the bottom of the screen
  // covers them. The mosaic measures itself and the sheet follows: the panel
  // ends where the map ends.
  useEffect(() => {
    const fit = () => {
      const node = sheet.current;
      if (!node) return;
      const area = document.querySelector('.mosaic-root');
      if (!area) {
        // No mosaic at all (phone layout): the sheet is the whole height.
        node.style.removeProperty('--chat-top');
        node.style.removeProperty('--chat-height');
        return;
      }
      const box = area.getBoundingClientRect();
      node.style.setProperty('--chat-top', Math.max(0, Math.round(box.top)) + 'px');
      node.style.setProperty('--chat-height', Math.round(box.height) + 'px');
    };

    fit();
    const area = document.querySelector('.mosaic-root');
    const watch =
      area && window.ResizeObserver ? new window.ResizeObserver(fit) : null;
    if (watch && area) watch.observe(area);
    window.addEventListener('resize', fit);
    return () => {
      if (watch) watch.disconnect();
      window.removeEventListener('resize', fit);
    };
  }, [open, pinned, width]);

  // The body carries the pin, because what it changes is outside this
  // component: the map gives up the width the panel takes.
  useEffect(() => {
    document.body.classList.toggle('chat-pinned', pinned && open);
    document.body.style.setProperty('--chat-w', width + 'px');
    return () => document.body.classList.remove('chat-pinned');
  }, [pinned, open, width]);

  // The nav button draws the count; it learns it from here rather than reading
  // chat frames of its own.
  useEffect(() => {
    $(document).trigger('chat:unread', [unread]);
  }, [unread]);

  useEffect(() => {
    const onLang = () => setLang(getLang());
    $('#rpc-events').on('rpc-prompt.chat-lang', onLang);
    return () => $('#rpc-events').off('rpc-prompt.chat-lang', onLang);
  }, []);

  const startDrag = event => {
    event.preventDefault();
    document.body.classList.add('chat-resizing');

    const move = e => {
      const at = e.touches ? e.touches[0].clientX : e.clientX;
      setWidth(Math.max(MIN_WIDTH, Math.round(window.innerWidth - at)));
    };
    const stop = () => {
      document.body.classList.remove('chat-resizing');
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', stop);
      window.removeEventListener('touchmove', move);
      window.removeEventListener('touchend', stop);
      setWidth(was => {
        write(WIDTH_KEY, String(was));
        return was;
      });
    };

    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', stop);
    window.addEventListener('touchmove', move);
    window.addEventListener('touchend', stop);
  };

  const nudge = event => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const step = event.shiftKey ? 64 : 16;
    setWidth(was => {
      const next = Math.max(
        MIN_WIDTH,
        was + (event.key === 'ArrowLeft' ? step : -step)
      );
      write(WIDTH_KEY, String(next));
      return next;
    });
  };

  const togglePin = () => {
    setPinned(was => {
      write(PIN_KEY, was ? '0' : '1');
      return !was;
    });
  };

  /* ---- answering ------------------------------------------------------- */

  const pick = line => {
    const to = replyTo(line);
    setTarget(to);
    if (to && to.command && input.current) input.current.focus();
  };

  const say = () => {
    const text = draft.trim();
    if (!text) return;
    const command = target && target.command ? target.command : 'say';
    send(command + ' ' + text);
    setDraft('');
  };

  const onKey = event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      say();
    }
    if (event.key === 'Escape') {
      setTarget(null);
      setDraft('');
    }
  };

  /* ---- what is painted -------------------------------------------------- */

  // "Only mine" means ADDRESSED TO ME, and the only channel that addresses a
  // person rather than a room or a world is the personal one. Both directions
  // stay: an answer without the question it answers is unreadable. What the
  // player said into a public channel is not addressed to them and does not
  // belong here -- that rule used to be `dir === 'out'`, which filled the
  // filtered feed with the player's own gossip and made the chip look like
  // "things I said".
  const shown = onlyMine ? lines.filter(l => l.kind === 'personal') : lines;

  const rows = [];
  let lastDay = 0;
  for (const line of shown) {
    const day = dayOf(line.at);
    if (day !== lastDay) {
      rows.push({ mark: dayLabel(line.at, lang), key: 'd' + day + '-' + line.id });
      lastDay = day;
    }
    rows.push({ line: line, key: line.id });
  }

  const blocked =
    target && target.blocked === 'anon'
      ? t('chat.noanon', lang)
      : target && target.blocked === 'npc'
        ? t('chat.nonpc', lang)
        : '';

  const command = target && target.command ? target.command : 'say';

  return (
    <div
      ref={sheet}
      className={'chat-sheet' + (open ? ' chat-sheet-open' : '') + (pinned ? ' chat-sheet-pinned' : '')}
      style={{ '--chat-sheet-width': width + 'px' }}
      role="complementary"
      aria-label={t('chat.title', lang)}
      aria-hidden={open ? 'false' : 'true'}
    >
      <div
        className="chat-grip"
        role="separator"
        aria-orientation="vertical"
        aria-label={t('chat.resize', lang)}
        title={t('chat.resize', lang)}
        tabIndex={open ? 0 : -1}
        onMouseDown={startDrag}
        onTouchStart={startDrag}
        onKeyDown={nudge}
      />

      <div className="chat-head">
        <span className="chat-title">{t('chat.title', lang)}</span>
        <span className="chat-count">
          {who ? '' : t('chat.nochar', lang)}
        </span>
        <span className="chat-tools">
          <button
            type="button"
            className={'chat-chip' + (onlyMine ? ' chat-chip-on' : '')}
            onClick={() => setOnlyMine(was => !was)}
            title={t('chat.onlymine.help', lang)}
          >
            {t('chat.onlymine', lang)}
          </button>
          <button
            type="button"
            className={'chat-icon' + (pinned ? ' chat-icon-on' : '')}
            onClick={togglePin}
            title={t(pinned ? 'chat.unpin' : 'chat.pin', lang)}
            aria-pressed={pinned ? 'true' : 'false'}
          >
            {/* Tilted tack for floating, upright for pinned -- the state reads
                as a shape, not only as a lit gem. The rotation was once blamed
                for the row sitting low; it was not: the boxes measured level,
                and the header's one-sided padding was pushing the whole row
                down. */}
            <i className={pinned ? 'fa fa-thumb-tack' : 'fa fa-thumb-tack fa-rotate-90'} />
          </button>
          <button
            type="button"
            className="chat-icon"
            onClick={() => setOpen(false)}
            title={t('chat.close', lang)}
          >
            <i className="fa fa-times" />
          </button>
        </span>
      </div>

      <div className="chat-feed" ref={feed} onScroll={onScroll}>
        {rows.length === 0 ? (
          <div className="chat-empty">{t('chat.empty', lang)}</div>
        ) : null}
        {rows.map(row =>
          row.mark ? (
            <div className="chat-day" key={row.key}>
              <span className="chat-day-rule" />
              <span>{row.mark}</span>
              <span className="chat-day-rule" />
            </div>
          ) : (
            <div
              className={
                'chat-row ' +
                toneOf(row.line) +
                (target && target.id === row.line.id ? ' chat-row-on' : '')
              }
              key={row.key}
              onClick={() => pick(row.line)}
            >
              <span className="chat-time">{clock(row.line.at)}</span>
              <span
                className="chat-text"
                dangerouslySetInnerHTML={{ __html: row.line.html }}
              />
            </div>
          )
        )}
      </div>

      <div className="chat-foot">
        <div className="chat-aim">
          <span className="chat-cmd">{command}</span>
          <span className="chat-quote">
            {target && target.quote
              ? t('chat.inreply', lang) + ' «' + row0(target.quote) + '»'
              : t('chat.toroom', lang)}
          </span>
          {target ? (
            <button
              type="button"
              className="chat-link"
              onClick={() => {
                setTarget(null);
                setDraft('');
              }}
            >
              {t('chat.cancel', lang)}
            </button>
          ) : null}
        </div>
        <div className="chat-send">
          <input
            ref={input}
            className="chat-input"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={onKey}
            placeholder={t('chat.write', lang)}
            aria-label={t('chat.write', lang)}
          />
          <button type="button" className="chat-go" onClick={say}>
            {t('chat.enter', lang)}
          </button>
        </div>
        {blocked ? <div className="chat-blocked">{blocked}</div> : null}
      </div>
    </div>
  );
}

// A quoted line is a reminder, not the message again: one line of it is enough,
// and a long one would push the input off the panel.
function row0(text) {
  const one = String(text || '').split('\n')[0];
  return one.length > 48 ? one.slice(0, 47) + '…' : one;
}
