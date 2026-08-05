import { store, onConnected, onDisconnected } from './store.js';
import $ from 'jquery';
import Telnet from './telnet';

const PROTO_VERSION = 'DreamLand Web Client/2.1';

// Decode incoming UTF-8 frames. Must NOT use String.fromCharCode.apply(null,
// bytes): apply spreads every byte as a separate argument, which overflows the
// engine's argument limit on large messages and crashes the tab (a big webedit
// payload -- e.g. `fedit` on a config file -- was doing exactly this).
const utf8Decoder = new TextDecoder('utf-8');

let wsUrl = 'wss://dreamland.rocks/dreamland';
let ws;

if (globalThis.location.hash === '#build') {
  wsUrl = 'wss://dreamland.rocks/buildplot';
} else if (
  globalThis.location.hash === '#local' ||
  globalThis.location.hash === '#bd'
) {
  // local dev: auto-login bridge (Ukrainization/localdev/bridge.js) that logs
  // into the backdoor as Kadm, bypassing the not-locally-available nanny.
  // (The native local websocket on :1234 runs the nanny and stalls locally,
  // so #local points here too.)
  wsUrl = 'ws://localhost:1237';
}

function rpccmd(cmd, ...args) {
  if (ws) {
    ws.send(
      JSON.stringify({
        command: cmd,
        args: args,
      })
    );
  }
}

function send(text) {
  /* Between "this socket is suspect" and "the resume landed" there is a second
   * or two in which ws.send() reports success into a connection that is
   * already gone. That window swallowed the player's first command after every
   * switch back to the tab, silently. Hold the line instead and replay it once
   * the session is verifiably back. */
  if (resumeToken() && !socketProven()) {
    // Bounded: if the reconnect never lands, this is a player typing into a
    // void, and only the last few lines could still be worth replaying.
    if (pending.length >= PENDING_MAX) pending.shift();
    pending.push({ text: text, at: Date.now() });
    return;
  }

  rpccmd('console_in', text + '\n');
}

function process(s) {
  $('.terminal').trigger('output', [s]);
}

// attach default RPC handlers
$(document).ready(function () {
  const telnet = new Telnet();

  telnet.handleRaw = function (s) {
    process(s);
  };

  $('#rpc-events')
    .on('rpc-console_out', function (e, b) {
      
      telnet.process(b);
    })
    .on('rpc-alert', function (e, b) {
      alert(b);
    })
    .on('rpc-version', function (e, version, nonce) {
      console.log('rpc-version', version, nonce);

      if (version !== PROTO_VERSION) {
        process(
          '\n\u001b[1;31mВерсия клиента (' +
            PROTO_VERSION +
            ') не совпадает с версией сервера (' +
            version +
            ').\n' +
            'Обнови страницу, если не поможет - почисти кеши.\u001b[0;37m\n'
        );
        // Drop the token first: retrying would just meet the same mismatch,
        // silently, forever. The player needs to see the message and reload.
        setResumeToken(null);
        ws.close();
      }

      ws.nonce = nonce;
    });
});

/* Session resume.
 *
 * A phone suspends this tab a second or two after the player switches apps,
 * and the socket dies with it -- nothing here or on the server can stop that.
 * What it can do is come straight back: the server puts a short-lived resume
 * token in every prompt, and presenting it on the next connection drops us
 * back into the same character with no login at all.
 *
 * sessionStorage, not localStorage: the token stands in for a password while
 * it lives, so it dies with the tab instead of sitting on disk.
 */
const RESUME_KEY = 'mudjs.resume';
const RECONNECT_MAX = 15000;
let reconnectTimer = null;
let reconnectDelay = 0;

function resumeToken() {
  try {
    return sessionStorage.getItem(RESUME_KEY);
  } catch (e) {
    return null; // private mode / storage disabled: fall back to logging in
  }
}

function setResumeToken(token) {
  try {
    if (token) sessionStorage.setItem(RESUME_KEY, token);
    else sessionStorage.removeItem(RESUME_KEY);
  } catch (e) {
    /* ignore: nothing to do if storage is unavailable */
  }
}

function wsAlive() {
  return (
    ws &&
    (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)
  );
}

/* readyState is not evidence.
 *
 * A phone tears the connection down while the tab is suspended, and the tab
 * comes back with readyState still OPEN over a socket that is already gone --
 * the browser only finds out when its own TCP timeout expires, a minute or
 * more later. For that whole minute the client looks connected and every
 * command the player types goes nowhere.
 *
 * So on the way back in, ask the server to say something. Anything arriving
 * clears the probe; silence means the socket is dead whatever it claims, and
 * closing it ourselves starts the silent resume that much sooner.
 */
const PONG_WAIT = 2000;
/* Past this much time away, a phone has almost certainly had its connection
 * torn down, and waiting out a probe only to conclude that is time the player
 * spends watching a dead prompt. Replace the socket at once instead -- resume
 * makes the difference invisible either way. */
const STALE_AFTER = 10000;
/* Replaying something typed much longer ago would act on a situation the
 * player has since left. */
const PENDING_TTL = 15000;
const PENDING_MAX = 20;

let probeTimer = null;
let hiddenAt = 0;
let pending = [];

/** True when the socket is not merely open but known to be carrying traffic. */
function socketProven() {
  return !probeTimer && ws && ws.readyState === WebSocket.OPEN;
}

function cancelProbe() {
  if (probeTimer) {
    clearTimeout(probeTimer);
    probeTimer = null;
  }
}

function flushPending() {
  const lines = pending;
  const now = Date.now();

  pending = [];

  lines.forEach(function (line) {
    if (now - line.at <= PENDING_TTL) rpccmd('console_in', line.text + '\n');
  });
}

function probeSocket() {
  if (probeTimer) return;

  // OPEN, not merely wsAlive(): sending on a CONNECTING socket throws, and a
  // connection still being set up needs no probe -- it resolves on its own.
  if (!ws || ws.readyState !== WebSocket.OPEN) return;

  const probed = ws;

  try {
    rpccmd('ping');
  } catch (e) {
    // It died between the check and the send. That is an answer too.
    ws.close();
    return;
  }

  probeTimer = setTimeout(function () {
    probeTimer = null;

    // Someone already replaced the socket we were asking about.
    if (ws !== probed || !wsAlive()) return;

    /* Give the server a moment to notice the close and let go of the
     * character before we ask for it back: resume is refused while the old
     * descriptor is still attached, and on a server without the matching fix
     * that refusal also spends the token. */
    reconnectDelay = 500;
    ws.close();
  }, PONG_WAIT);
}

/* Either the socket is alive and worth probing, or it is already gone and
 * worth replacing. Shared by the two events that mean "the player is back". */
function verifyConnection() {
  const away = hiddenAt ? Date.now() - hiddenAt : 0;

  hiddenAt = 0;

  if (!resumeToken()) return;

  if (wsAlive()) {
    // A long absence needs no asking; a short one might still be fine.
    if (away > STALE_AFTER && ws.readyState === WebSocket.OPEN) {
      reconnectDelay = 500;
      ws.close();
      return;
    }

    probeSocket();
    return;
  }

  reconnectDelay = 0;
  scheduleReconnect();
}

function scheduleReconnect() {
  if (reconnectTimer) return;

  // The first retry is immediate: the common case is a tab waking up, where
  // the network is already back and the only thing missing is the socket.
  const delay = reconnectDelay;
  reconnectDelay = Math.min(delay ? delay * 2 : 500, RECONNECT_MAX);
  reconnectTimer = setTimeout(function () {
    reconnectTimer = null;
    connect();
  }, delay);
}

function connect() {
  ws = new WebSocket(wsUrl, ['binary']);

  ws.binaryType = 'arraybuffer';

  ws.onmessage = function (e) {
    // Traffic in this direction is the proof a probe was after; the reply need
    // not be the pong itself, and on an older server it will not be. The
    // socket was fine all along, so anything held back can go now.
    if (probeTimer) {
      cancelProbe();
      flushPending();
    }

    const b = JSON.parse(utf8Decoder.decode(e.data));

    $('#rpc-events').trigger('rpc-' + b.command, b.args);
  };

  ws.onopen = function () {
    reconnectDelay = 0;

    /* Holding a token, say nothing else until the server has ruled on it: if
     * the resume takes, the codepage answer below would land in the game as a
     * typed command. resume_ok / resume_failed decides which path we are on. */
    if (resumeToken()) {
      rpccmd('resume', resumeToken());
      return;
    }

    // Answer the server's very first prompt -- the codepage menu -- with '1' =
    // koi8-r, which is the encoding this client decodes (see telnet.js koi2utf).
    // REQUIRED: without it the session stays on the wrong codepage and text is
    // garbled. This is NOT the language menu (that comes next and is handled by
    // src/langsync.js).
    send('1');
  };

  ws.onclose = function () {
    cancelProbe();
    ws = null;
    store.dispatch(onDisconnected());

    /* Only say DISCONNECTED when there is nothing left to try. A token means a
     * silent retry instead, which is the whole point for a backgrounded phone:
     * the player comes back to their game, not to a red banner. */
    if (!resumeToken()) {
      process(
        '\u001b[1;31m#################### DISCONNECTED ####################\u001b[0;37m\n'
      );
      return;
    }

    scheduleReconnect();
  };

  // Silent while resuming: a backgrounded phone can go through several
  // attempts, and each one announcing itself is exactly the noise this feature
  // exists to remove.
  if (!resumeToken()) process('Connecting....\n');
  store.dispatch(onConnected());
}

$(document).ready(function () {
  $('#rpc-events')
    .on('rpc-prompt', function (e, b) {
      if (b && b.resume) setResumeToken(b.resume);
    })
    .on('rpc-resume_ok', function () {
      // Straight back into the character: no banner, no login, and the
      // scrollback in this tab is still the one the player left.
      reconnectDelay = 0;
      flushPending();
    })
    .on('rpc-resume_failed', function () {
      // Spent, expired, or the character has left the world. Ordinary session.
      // Held lines are dropped rather than replayed: what the server asks for
      // next is a login, and a queued command would be typed into it.
      pending = [];
      setResumeToken(null);
      send('1');
    });

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') hiddenAt = Date.now();
  });

  /* A suspended tab often learns its socket is dead only once it wakes, so do
   * not wait for onclose to fire -- check on the way back in. */
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState !== 'visible') return;
    verifyConnection();
  });

  window.addEventListener('online', verifyConnection);
});

export { send, rpccmd, connect, ws };
