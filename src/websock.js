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

/** Send one frame. False when the socket cannot take it: a socket that is
 *  closing, still connecting or already gone throws on send(), and the throw
 *  lands in whatever called this -- a click handler, say, which then leaves the
 *  interface looking frozen. */
function rpccmd(cmd, ...args) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return false;

  ws.send(
    JSON.stringify({
      command: cmd,
      args: args,
    })
  );

  return true;
}

function send(text) {
  /* Between "this socket is suspect" and "the resume landed" there is a second
   * or two in which ws.send() reports success into a connection that is
   * already gone. That window swallowed the player's first command after every
   * switch back to the tab, silently. Hold the line instead and replay it once
   * the session is verifiably back. */
  if (resumeToken() && !socketProven()) {
    holdLine(text);
    return;
  }

  // The socket may also be down without a resume in hand -- mid-reconnect, or
  // the moment the server restarted. What the player typed waits for the line
  // to come back rather than disappearing without a word.
  if (!rpccmd('console_in', text + '\n')) holdLine(text);
}

/** Keep a typed line for the replay. Bounded: if the reconnect never lands,
 *  this is a player typing into a void, and only the last few lines could still
 *  be worth replaying. */
function holdLine(text) {
  if (pending.length >= PENDING_MAX) pending.shift();
  pending.push({ text: text, at: Date.now() });
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
        loginRetries = LOGIN_RETRY_MAX;
        firstFrame = null;
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
// A deliberate, silent socket cycle (the login language switch): tear down and
// re-open without the DISCONNECTED banner so onclose reconnects instead of giving
// up. See reconnect().
let deliberateReconnect = false;

/* resume_failed is two answers sharing one name: "the token is finished, log in"
 * and "your own previous socket has not gone linkdead yet -- ask again in a
 * moment" (the server keeps the token for that case, see resume.cpp). The server
 * now labels which one (the reason arg, 'final' vs 'retry'); only the retry kind
 * spends this budget, with a short backoff, so a phone that reconnects faster
 * than the server notices its dead socket is not thrown to login on every drop.
 * A server that predates the label sends neither, and we retry as before. */
const RESUME_RETRY_MAX = 5;
let resumeRetries = 0;

/* The login screen sits over a socket like everything else, and without a
 * resume token nothing used to bring that socket back: a server reboot or a
 * laptop lid left the roster clickable over a dead line, and a click sent its
 * entry token nowhere. Before a character is in the world a dropped socket is
 * now replaced silently, bounded so a server that keeps refusing us is not
 * hammered for ever. The count resets whenever a nanny or a prompt proves the
 * line good, and on any deliberate attempt (ensureOpen). */
const LOGIN_RETRY_MAX = 40;
let loginRetries = 0;
let silentRetry = false;
// A prompt arrived on the current socket: a character is in the world on it.
let inWorld = false;

/* One frame to lead a fresh socket with instead of the codepage answer -- the
 * roster's account_enter, which redeems on a bare descriptor just as resume
 * does (the server sets the codepage itself). Leading with '1' instead would
 * leave that line in the input queue to be read as a command by the character
 * the token just brought in. If the server refuses the token, the codepage
 * answer follows then and the socket carries on as an ordinary login. */
let firstFrame = null;
let skippedCodepage = false;

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
/* Past this much time away a phone has almost certainly had its connection torn
 * down -- but a desktop tab left in the background has not, and discarding a
 * working socket there costs a visible reconnect for nothing. Length of absence
 * is evidence, not proof, so it buys a shorter wait rather than skipping the
 * question: on a live socket the answer comes back in milliseconds anyway. */
const STALE_AFTER = 10000;
const PONG_WAIT_STALE = 750;
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

function probeSocket(wait) {
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
  }, wait || PONG_WAIT);
}

/* Either the socket is alive and worth probing, or it is already gone and
 * worth replacing. Shared by the two events that mean "the player is back". */
function verifyConnection() {
  const away = hiddenAt ? Date.now() - hiddenAt : 0;

  hiddenAt = 0;

  if (!resumeToken()) {
    // A token-less session already in the world (storage disabled) keeps its
    // old behaviour. At the login screen, check the line the same way: a
    // laptop that slept kept an OPEN socket the server has long forgotten.
    if (inWorld) return;
    if (wsAlive()) probeSocket(away > STALE_AFTER ? PONG_WAIT_STALE : PONG_WAIT);
    else ensureOpen();
    return;
  }

  if (wsAlive()) {
    probeSocket(away > STALE_AFTER ? PONG_WAIT_STALE : PONG_WAIT);
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

/* Deliberately cycle the socket. Used by the login language switch: a fresh
 * connection replays the nanny from its greeting, and langsync re-answers the
 * "Choose your language" menu from localStorage -- so the whole pre-login screen
 * comes back in the newly picked language. Only meaningful at the nanny (no
 * resume token in hand); an in-world session keeps its socket. */
function reconnect() {
  if (ws) {
    deliberateReconnect = true;
    try {
      ws.close();
    } catch (e) {
      /* already closing -- onclose still fires and consumes the flag */
    }
  } else {
    // No socket, maybe mid-backoff: go now rather than wait out the timer.
    reconnectDelay = 0;
    connect();
  }
}

function isOpen() {
  return !!ws && ws.readyState === WebSocket.OPEN;
}

/** Make sure a socket is open or on its way. For a login action the player just
 *  took. */
function ensureOpen() {
  loginRetries = 0;
  if (wsAlive()) return;
  reconnectDelay = 0;
  // A CLOSING socket is not waited for: over a dropped NAT mapping its close
  // can take a minute. The replacement goes now and the old one's onclose,
  // arriving late, is ignored (see the guard there).
  connect();
}

/** Send now if the socket is open, else lead a fresh socket with this frame
 *  (see firstFrame). True when it went out now; false means it waits for a
 *  socket still to come, which cancelFirstFrame() can call off. */
function rpcWhenOpen(cmd, ...args) {
  if (isOpen() && !probeTimer) return rpccmd(cmd, ...args);
  firstFrame = { cmd: cmd, args: args };
  // Mid-probe the socket is in doubt: an answer sends the frame over it (see
  // onmessage), silence closes it and the frame leads the replacement.
  if (!probeTimer) ensureOpen();
  return false;
}

function cancelFirstFrame() {
  firstFrame = null;
}

/** A new socket's opening words when there is no resume to ask for. */
function answerFreshSocket() {
  const f = firstFrame;
  firstFrame = null;
  if (f && rpccmd(f.cmd, ...f.args)) {
    skippedCodepage = true;
    return;
  }
  // Answer the server's very first prompt -- the codepage menu -- with '1' =
  // koi8-r, which is the encoding this client decodes (see telnet.js koi2utf).
  // REQUIRED: without it the session stays on the wrong codepage and text is
  // garbled. This is NOT the language menu (that comes next and is handled by
  // src/langsync.js).
  send('1');
}

function connect() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  const quiet = silentRetry;
  silentRetry = false;
  // A deliberate cycle is consumed by its own socket's onclose. A connect that
  // supersedes that socket first leaves the flag stale; drop it here.
  deliberateReconnect = false;
  inWorld = false;
  skippedCodepage = false;

  // Replacing a socket that is still closing: its onclose will be ignored, so
  // say what it would have said (prompt gone, line down) and drop its probe.
  if (ws) {
    cancelProbe();
    store.dispatch(onDisconnected());
  }

  const sock = new WebSocket(wsUrl, ['binary']);
  ws = sock;

  ws.binaryType = 'arraybuffer';

  ws.onmessage = function (e) {
    // Traffic in this direction is the proof a probe was after; the reply need
    // not be the pong itself, and on an older server it will not be. The
    // socket was fine all along, so anything held back can go now.
    if (probeTimer) {
      cancelProbe();
      flushPending();
      // This socket is long past its codepage menu: an ordinary send.
      if (firstFrame) {
        const f = firstFrame;
        firstFrame = null;
        rpccmd(f.cmd, ...f.args);
      }
    }

    const b = JSON.parse(utf8Decoder.decode(e.data));

    $('#rpc-events').trigger('rpc-' + b.command, b.args);
  };

  ws.onopen = function () {
    /* A server that accepts and drops at once would otherwise be retried with
     * no pause at all. The resume path keeps its reset here; the login path
     * resets once a nanny proves the line (rpc-nanny_step) or on a player's
     * own action (ensureOpen). */
    if (resumeToken()) reconnectDelay = 0;

    /* Holding a token, say nothing else until the server has ruled on it: if
     * the resume takes, the codepage answer below would land in the game as a
     * typed command. resume_ok / resume_failed decides which path we are on. */
    if (resumeToken()) {
      rpccmd('resume', resumeToken());
      return;
    }

    answerFreshSocket();
  };

  ws.onclose = function () {
    // A socket someone already replaced has nothing left to say about the line.
    if (ws !== sock) return;
    const wasInWorld = inWorld;

    cancelProbe();
    ws = null;
    store.dispatch(onDisconnected());

    /* A deliberate cycle (language switch at the nanny): no banner, reconnect
     * straight away with the fresh language already saved. */
    if (deliberateReconnect) {
      deliberateReconnect = false;
      reconnectDelay = 0;
      scheduleReconnect();
      return;
    }

    /* Only say DISCONNECTED when there is nothing left to try. A token means a
     * silent retry instead, which is the whole point for a backgrounded phone:
     * the player comes back to their game, not to a red banner. */
    if (!resumeToken()) {
      // Still at the login screen, or a roster click waiting for a line: come
      // back quietly instead of leaving the login over a dead socket.
      if (firstFrame || (!wasInWorld && loginRetries < LOGIN_RETRY_MAX)) {
        loginRetries++;
        silentRetry = true;
        scheduleReconnect();
        return;
      }
      process(
        '\u001b[1;31m#################### DISCONNECTED ####################\u001b[0;37m\n'
      );
      return;
    }

    scheduleReconnect();
  };

  // Silent while resuming: a backgrounded phone can go through several
  // attempts, and each one announcing itself is exactly the noise this feature
  // exists to remove. Same for the login screen's own quiet retries.
  if (!resumeToken() && !quiet) process('Connecting....\n');
  store.dispatch(onConnected());
}

$(document).ready(function () {
  $('#rpc-events')
    .on('rpc-prompt', function (e, b) {
      inWorld = true;
      loginRetries = 0;
      // In the world: an entry frame still waiting (a tap during a resume) must
      // never go out later.
      firstFrame = null;
      if (b && b.resume) setResumeToken(b.resume);
    })
    // The nanny reached a real question: the line is good.
    .on('rpc-nanny_step', function () {
      loginRetries = 0;
      reconnectDelay = 0;
    })
    .on('rpc-account_enter_ok', function () {
      skippedCodepage = false;
    })
    .on('rpc-account_enter_failed', function () {
      // The token led a fresh socket and was refused: the descriptor is still
      // at the codepage menu, so answer it now and carry on as a login.
      if (!skippedCodepage) return;
      skippedCodepage = false;
      send('1');
    })
    .on('rpc-resume_ok', function () {
      // Straight back into the character: no banner, no login, and the
      // scrollback in this tab is still the one the player left.
      resumeRetries = 0;
      reconnectDelay = 0;
      firstFrame = null;
      flushPending();
    })
    .on('rpc-resume_failed', function (e, reason) {
      /* Two failures share this name. 'final' -- the token is dead (a deliberate
       * quit, an expiry, or the body already left the world): no retry can bring
       * it back, so drop to the login now. 'retry' (or, from a server that
       * predates the reason, nothing) -- our own old socket may just not be
       * linkdead yet, so ask again a bounded few times before giving up. The
       * reconnect resends the same token; onclose keeps it and reschedules. */
      if (reason !== 'final' && resumeToken() && resumeRetries < RESUME_RETRY_MAX) {
        resumeRetries++;
        reconnectDelay = Math.min(800 * resumeRetries, 3000);
        if (ws) ws.close();
        return;
      }

      // Final, or out of retries: ordinary login. Held lines are dropped rather
      // than replayed -- what the server asks for next is a login, and a queued
      // command would be typed into it.
      resumeRetries = 0;
      pending = [];
      setResumeToken(null);
      answerFreshSocket();
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

export {
  send,
  rpccmd,
  connect,
  reconnect,
  ensureOpen,
  isOpen,
  rpcWhenOpen,
  cancelFirstFrame,
  ws,
};
