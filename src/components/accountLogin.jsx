import React, { useState, useEffect, useRef } from 'react';
import $ from 'jquery';
import { useSelector } from 'react-redux';
import useMediaQuery from '@mui/material/useMediaQuery';
import { send, rpccmd } from '../websock';
import { at, LANGS } from '../accountStrings';
import { getLang, setLang } from '../i18n';
import PropertiesStorage from '../properties';
import '../account-login.css';

// The front-door account panel for /newui. Two obsidian slabs meet at a gold seam;
// the login controls float over it. On a successful login (the web prompt arrives,
// so redux `prompt` flips from null to a value) the controls fade and the slabs
// slide apart, revealing the game behind. See account-login.css for the motion.

const REVEAL_MS = 950;      // slab curtain + settle before we unmount
const LOGIN_TIMEOUT_MS = 4500;

// How deep each path-B step sits, so a step change can slide the new panel in from
// the right when going deeper (idle -> email -> code) and from the left on the way
// back. Steps at the same depth (telegram/roster) just cross-fade.
const STEP_DEPTH = { idle: 0, email: 1, telegram: 1, roster: 1, code: 2 };

// Path B (account login) talks to the dreamland_web account broker, same origin.
// The broker holds the web token; the browser only ever sees the one-use entry
// token, which it hands straight to the game over the WebSocket.
const ACCOUNT_API = '/account-api';

// Public bot username for the Telegram Login Widget. The widget renders only once the
// bot's domain is set to dreamland.rocks in BotFather (/setdomain); until then it shows
// "Bot domain invalid". Not a secret -- the engine ships the same value as TELEGRAM_BOT.
const TELEGRAM_BOT = 'dreamland_mud_bot';

async function postJson(path, body) {
  let resp;
  try {
    resp = await fetch(ACCOUNT_API + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(body || {}),
    });
  } catch (e) {
    return { status: 0, json: null };   // broker unreachable (e.g. dev, or down)
  }
  let json = null;
  try { json = await resp.json(); } catch (e) { /* empty / non-JSON body */ }
  return { status: resp.status, json };
}

// Real brand marks (simple-icons glyphs) so the account buttons carry the actual
// Discord / Telegram logos -- FA 4.7 (the app's icon set) has Telegram but no
// Discord, so both go inline as SVG for a consistent set. Fill inherits currentColor.
const DiscordIcon = () => (
  <svg className="acc-brand" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M20.317 4.3698a19.7913 19.7913 0 0 0-4.8851-1.5152.0741.0741 0 0 0-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 0 0-.0785-.037 19.7363 19.7363 0 0 0-4.8852 1.515.0699.0699 0 0 0-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 0 0 .0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 0 0 .0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 0 0-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 0 1-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 0 1 .0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 0 1 .0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 0 1-.0066.1276 12.2986 12.2986 0 0 1-1.873.8914.0766.0766 0 0 0-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 0 0 .0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 0 0 .0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 0 0-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z" />
  </svg>
);
const TelegramIcon = () => (
  <svg className="acc-brand" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
  </svg>
);

// The simplified Celtic crest woven into the bottom-center of the login frame's
// gold rail (styled by .acc-crest). Purely decorative -- aria-hidden, recoloured
// to gold through currentColor. Traced from the Figma reference (DL_desktop 1071:2698).
const CelticCrest = () => (
  <span className="acc-crest" aria-hidden="true">
    <svg viewBox="0 0 12 10">
      <defs>
        <linearGradient id="acccrest" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c6a24e" />
          <stop offset="0.55" stopColor="#8a6a2b" />
          <stop offset="1" stopColor="#402f10" />
        </linearGradient>
      </defs>
      <path fillRule="evenodd" clipRule="evenodd" fill="url(#acccrest)" d="M0.546586 4.87597C0.234789 4.64956 0.0597663 4.34243 0.0597463 4.02226L-4.55717e-05 0.000120176L0.767487 -7.68331e-06L0.827102 4.02226C0.827122 4.19465 0.92155 4.35992 1.08942 4.48182L1.53952 4.80888C1.75831 4.96774 2.05523 5.05706 2.36464 5.05707L2.56054 5.0572C2.56032 5.03997 2.55966 5.02275 2.55966 5.00551L2.55948 4.73013C2.55948 4.69765 2.54274 4.66958 2.51938 4.65151L1.58174 3.92735C1.42566 3.8068 1.33869 3.64748 1.33867 3.48203L1.27906 -7.72803e-06L2.04641 -7.79511e-06L2.1062 1.69113L2.63332 1.3084C2.84916 1.15169 3.1419 1.06359 3.44713 1.06355L7.67218 1.06355C7.97741 1.06359 8.27016 1.15169 8.486 1.3084L9.01311 1.69113L8.95367 -8.39897e-06L9.72103 -8.46605e-06L9.78064 3.48203C9.78063 3.64748 9.69366 3.8068 9.53758 3.92735L8.59993 4.65151C8.57658 4.66958 8.55984 4.69765 8.55984 4.73013L8.55966 5.00551C8.55966 5.0227 8.55881 5.03989 8.5586 5.05707L8.7545 5.05694C9.06394 5.05694 9.36099 4.96776 9.5798 4.80888L10.0299 4.48182C10.1977 4.35992 10.2922 4.19463 10.2922 4.02226L10.2326 -8.51077e-06L11 -8.57786e-06L11.0596 4.02226C11.0595 4.34242 10.8845 4.64957 10.5727 4.87596L10.1223 5.20277C9.75959 5.46612 9.2676 5.6142 8.75468 5.61423L7.16379 5.61423C6.95865 6.42425 6.52931 7.1966 5.89882 7.88329L5.87886 7.90471L5.55984 8.25229L5.22209 7.88495C4.59066 7.19789 4.16039 6.42494 3.95517 5.61423L2.36464 5.61423C1.85169 5.61422 1.35957 5.46626 0.99686 5.2029L0.546586 4.87597ZM7.53546 3.01388C7.77598 3.01388 8.00158 3.08777 8.16397 3.2132L8.78665 3.69404L8.97831 3.54565C9.00061 3.52842 9.01311 3.50554 9.01311 3.4819L9.01311 2.47916L7.94334 1.70242C7.87142 1.65021 7.77388 1.62075 7.67218 1.62072L5.94334 1.62084L5.94334 3.01401L7.53546 3.01388ZM2.95535 3.2132C3.11774 3.08777 3.34333 3.01388 3.58386 3.01388L5.17598 3.01401L5.17598 1.62084L3.44713 1.62072C3.34544 1.62075 3.2479 1.65021 3.17598 1.70242L2.1062 2.47916L2.1062 3.4819C2.1062 3.50554 2.11871 3.52843 2.141 3.54565L2.33302 3.69404L2.95535 3.2132ZM5.55966 7.2189C6.01983 6.62496 6.32558 5.97327 6.45879 5.29627L6.50596 5.05707L7.79107 5.0572C7.79133 5.03997 7.7923 5.02275 7.7923 5.00551L7.7923 4.73C7.79234 4.56046 7.87924 4.39449 8.04085 4.26968L8.25989 4.10063L7.60488 3.59477C7.58224 3.5773 7.5566 3.57104 7.53546 3.57104L3.58386 3.57104C3.56272 3.57104 3.53707 3.5773 3.51444 3.59477L2.85961 4.10076L3.07847 4.26968C3.24007 4.39449 3.32698 4.56046 3.32701 4.73L3.32701 5.00551C3.32701 5.02275 3.32799 5.03997 3.32825 5.0572L4.61336 5.05707L4.66052 5.29627C4.79363 5.97331 5.09942 6.62497 5.55966 7.2189Z" />
      <path fill="url(#acccrest)" d="M3.81951 8.03989C3.25421 7.42863 2.86966 6.73476 2.68525 6.00684L3.4671 6.00684C3.64175 6.62419 3.97698 7.21073 4.4565 7.72925L5.55966 8.92245L6.66282 7.72925C7.14233 7.21073 7.47756 6.62419 7.65222 6.00684L8.43406 6.00684C8.24966 6.73476 7.86511 7.42863 7.29981 8.03989L5.55966 9.9216L3.81951 8.03989Z" />
    </svg>
  </span>
);

export default function AccountLogin() {
  const prompt = useSelector(s => s.prompt);
  const [phase, setPhase] = useState(prompt ? 'hidden' : 'login'); // login | revealing | hidden
  const [lang, setLangState] = useState(getLang());
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');        // centered status line, '' = show the form
  const [bstep, setBstep] = useState('idle');  // path B: idle | email | code | telegram | roster
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [roster, setRoster] = useState([]);    // real character names from the broker
  const [acctTitle, setAcctTitle] = useState('');
  const [berror, setBerror] = useState('');    // path B error line
  // True while the mount/return /session probe is in flight. Starts on when the panel
  // is the front door, so a returning player with a live cookie session never sees the
  // name/password form flash before the roster loads -- they just land on their chars.
  const [checking, setChecking] = useState(!prompt);

  // The panel is laid over the widgets + map (the mosaic's non-terminal region), so its
  // left edge meets the terminal split -- same maths as App.getResponsiveLayout. Clamped
  // so the form never shrinks below a usable width on mid-size screens. Full-screen on mobile.
  const bigScreen = useMediaQuery('(min-width:600px)');
  const hugeScreen = useMediaQuery('(min-width:1280px)');
  let accLeft = '0';
  if (bigScreen) {
    const tW = PropertiesStorage['terminalLayoutWidth'];
    const pW = PropertiesStorage['panelLayoutWidth'];
    const mW = PropertiesStorage['mapLayoutWidth'];
    const frac = hugeScreen ? (tW / (tW + pW + mW)) * 100 : 70;
    accLeft = `min(${frac}%, calc(100% - 480px))`;
  }

  const nameRef = useRef(null);
  const timers = useRef([]);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const enterPending = useRef(false);   // path B: a char click is awaiting the engine's reply
  const tgAuthRef = useRef(null);       // latest telegram-auth handler for the widget's global callback
  const prevDepthRef = useRef(0);       // depth of the last shown step, for slide direction
  const discordRef = useRef(false);     // a Discord OAuth popup is in flight

  const later = (fn, ms) => {
    const id = setTimeout(fn, ms);
    timers.current.push(id);
    return id;
  };
  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  // Drive the reveal off the login-state signal: prompt null -> in world.
  useEffect(() => {
    if (prompt && phaseRef.current === 'login') {
      clearTimers();
      enterPending.current = false;
      setBusy('');
      setPhase('revealing');
      later(() => setPhase('hidden'), REVEAL_MS);
    } else if (!prompt && phaseRef.current === 'hidden') {
      setPhase('login');           // quit / disconnect brings the door back
      setBusy('');
      setBstep('idle');
      setChecking(true);           // re-probe: a live cookie session lands back on the roster
    }
  }, [prompt]);

  // Focus the name field once the idle form is actually on screen -- after the session
  // check clears, not while "Checking…" covers it. On the roster there is no name input,
  // so the guard no-ops.
  useEffect(() => {
    if (phase === 'login' && !checking) {
      const id = setTimeout(() => nameRef.current && nameRef.current.focus(), 40);
      return () => clearTimeout(id);
    }
  }, [phase, checking]);

  useEffect(() => () => clearTimers(), []);

  // Remember the depth of the step now on screen so the NEXT change knows which
  // way to slide. Kept in an effect (not computed during render) so React's
  // double-invoked renders can't corrupt the comparison. Busy is a passing
  // status over the same step, so it never moves the mark.
  useEffect(() => {
    if (!busy && !checking) prevDepthRef.current = STEP_DEPTH[bstep] != null ? STEP_DEPTH[bstep] : 0;
  }, [bstep, busy, checking]);

  // The engine answers account_enter with account_enter_ok / account_enter_failed over
  // the WS (descriptor.cpp). Success needs no handler here -- the cold-load sends a
  // prompt and the reveal effect above rides it. On failure (a same-account conflict,
  // an expired token, a cold-load refusal) react at once instead of waiting out the
  // backstop timeout in enterAs.
  useEffect(() => {
    const onEnterFailed = () => {
      if (!enterPending.current) return;
      enterPending.current = false;
      clearTimers();
      setBusy('');
      setBerror(at('enterfail', lang));
    };
    $('#rpc-events').on('rpc-account_enter_failed', onEnterFailed);
    return () => $('#rpc-events').off('rpc-account_enter_failed', onEnterFailed);
  }, [lang]);

  // Mount the Telegram Login Widget when its step opens. The widget is Telegram's own
  // iframe button; on success it calls the global set here with the signed user payload,
  // which we route to the current verifyTelegram closure. Torn down on leaving the step
  // so a stale global can't fire into an unmounted panel.
  useEffect(() => {
    if (bstep !== 'telegram')
      return;
    window.__dlTelegramAuth = user => { if (tgAuthRef.current) tgAuthRef.current(user); };
    const holder = document.getElementById('acc-tg-widget');
    if (holder) {
      holder.innerHTML = '';
      const s = document.createElement('script');
      s.async = true;
      s.src = 'https://telegram.org/js/telegram-widget.js?22';
      s.setAttribute('data-telegram-login', TELEGRAM_BOT);
      s.setAttribute('data-size', 'large');
      s.setAttribute('data-radius', '8');
      s.setAttribute('data-onauth', '__dlTelegramAuth(user)');
      holder.appendChild(s);
    }
    return () => { try { delete window.__dlTelegramAuth; } catch (e) { window.__dlTelegramAuth = undefined; } };
  }, [bstep]);

  // Once, on mount: surface any ?acct_error the Discord full-page callback bounced back
  // with, and scrub it from the URL. The session probe below is what turns a live cookie
  // into the roster; this only handles the redirect's error flag.
  useEffect(() => {
    if (prompt)
      return;   // already in-world; the panel is hidden
    try {
      const u = new URL(window.location.href);
      const err = u.searchParams.get('acct_error');
      if (err) {
        setBstep('idle');
        if (err === 'discord_nolink') setBerror(at('d_nolink', lang));
        else if (err === 'discord_off') setBerror(at('soon', lang));
        else setBerror(at('berror', lang));
        u.searchParams.delete('acct_error');
        window.history.replaceState({}, '', u.pathname + u.search + u.hash);
      }
    } catch (e) { /* older browser: leave the URL as is */ }
  }, []);   // once, on mount

  // Whenever the panel is the front door -- on mount, and on every return from the
  // world (quit/disconnect) -- probe the broker session. A live cookie sends the player
  // straight to the roster, so they never re-authenticate or even see the login form.
  // No cookie (or broker down) clears `checking` and the idle door shows path A + the
  // account methods. `checking` starts on so the form never flashes before this lands.
  useEffect(() => {
    if (phase !== 'login' || prompt) {
      setChecking(false);
      return;
    }
    const run = { cancelled: false };
    setChecking(true);
    // Backstop: if the broker accepts the socket but never answers (not a fast 502),
    // don't strand the player on "Checking…" -- drop to the idle door. A late reply
    // can still open the roster over it.
    const backstop = setTimeout(() => { if (!run.cancelled) setChecking(false); }, LOGIN_TIMEOUT_MS);
    (async () => {
      try {
        const resp = await fetch(ACCOUNT_API + '/session', { credentials: 'same-origin' });
        const json = await resp.json();
        if (!run.cancelled && json && json.account) {
          setRoster(Array.isArray(json.chars) ? json.chars : []);
          setAcctTitle(json.title || '');
          setBstep('roster');
        }
      } catch (e) { /* broker down/offline: stay on the form */ }
      finally { if (!run.cancelled) { clearTimeout(backstop); setChecking(false); } }
    })();
    return () => { run.cancelled = true; clearTimeout(backstop); };
  }, [phase]);

  // Hear back from the Discord popup. On success it posts { dl:'discord', ok:true }
  // and we re-read the session; on failure it posts the same acct_error reason the
  // full-page path would have put in the URL. A window refocus is the fallback for
  // a popup that finished but whose message never arrived (closed by hand, blocked
  // opener). Origin-checked: only our own broker page may drive this.
  useEffect(() => {
    const onMsg = e => {
      if (e.origin !== window.location.origin) return;
      const d = e.data;
      if (!d || d.dl !== 'discord') return;
      discordRef.current = false;
      if (d.ok) {
        refreshSession();
      } else if (d.error === 'discord_nolink') {
        setBstep('idle'); setBerror(at('d_nolink', lang));
      } else if (d.error === 'discord_off') {
        setBstep('idle'); setBerror(at('soon', lang));
      } else {
        setBstep('idle'); setBerror(at('berror', lang));
      }
    };
    const onFocus = () => { if (discordRef.current) refreshSession(); };
    window.addEventListener('message', onMsg);
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('message', onMsg);
      window.removeEventListener('focus', onFocus);
    };
  }, [lang]);

  const openCurtain = () => {
    clearTimers();
    setBusy('');
    setPhase('revealing');
    later(() => setPhase('hidden'), REVEAL_MS);
  };

  const pickLang = l => {
    setLang(l);
    try { localStorage.setItem('mudjs.lang', l); } catch (e) { /* private mode */ }
    setLangState(l);
  };

  // ---- path A: real character login (drives the server nanny) --------------
  const submitChar = e => {
    e.preventDefault();
    if (!name.trim() || !password) return;
    setError('');
    setBusy(at('entering', lang));
    send(name.trim());
    later(() => send(password), 180);
    // If the prompt never arrives, the credentials were wrong -- re-show the form.
    later(() => {
      if (phaseRef.current === 'login') {
        setBusy('');
        setError(at('fail', lang));
      }
    }, LOGIN_TIMEOUT_MS);
  };

  // ---- path B: master login via the account broker -------------------------
  // Step 1: mail a code to the address. No session is created yet.
  const sendEmailCode = async e => {
    e.preventDefault();
    if (!email.trim()) return;
    setBerror('');
    setBusy(at('sending', lang));
    const { status, json } = await postJson('/emailcode', { email: email.trim() });
    setBusy('');
    if (status === 200 && json && json.sent) {
      setCode('');
      setBstep('code');
    } else if (status === 429) {
      setBerror(at('rate', lang));
    } else {
      setBerror(at('berror', lang));
    }
  };

  // Step 2: verify the code. A known address opens the roster; an unlinked one is
  // proven but has no account (linking happens in-game, where a character owns it).
  const verifyEmailCode = async e => {
    e.preventDefault();
    if (!code.trim()) return;
    setBerror('');
    setBusy(at('authenticating', lang));
    const { status, json } = await postJson('/emailverify', {
      email: email.trim(), code: code.trim(),
    });
    setBusy('');
    if (status === 200 && json && json.account) {
      setRoster(Array.isArray(json.chars) ? json.chars : []);
      setAcctTitle(json.title || '');
      setBstep('roster');
    } else if (status === 200 && json && json.account === null) {
      setBerror(at('nolink', lang));
    } else {
      setBerror(at('badcode', lang));
    }
  };

  // Path B (telegram): the Login Widget proved a Telegram id; hand the signed payload
  // to the broker, which verifies it server-side and opens the roster if that id owns
  // an account. Same roster/enter path as email from here on.
  const verifyTelegram = async user => {
    setBerror('');
    setBusy(at('authenticating', lang));
    const { status, json } = await postJson('/telegramverify', { tg: user });
    setBusy('');
    if (status === 200 && json && json.account) {
      setRoster(Array.isArray(json.chars) ? json.chars : []);
      setAcctTitle(json.title || '');
      setBstep('roster');
    } else if (status === 200 && json && json.account === null) {
      setBerror(at('tg_nolink', lang));
    } else if (status === 501) {
      setBerror(at('soon', lang));   // broker has no telegram token yet -> stays dark
    } else {
      setBerror(at('berror', lang));
    }
  };
  tgAuthRef.current = verifyTelegram;

  // Re-read the broker session and open the roster if it now holds an account.
  // Used after a Discord popup completes (its postMessage, or a window refocus as
  // a fallback), the same shape as the mount-time /session probe.
  const refreshSession = async () => {
    try {
      const resp = await fetch(ACCOUNT_API + '/session', { credentials: 'same-origin' });
      const json = await resp.json();
      if (json && json.account) {
        discordRef.current = false;
        setRoster(Array.isArray(json.chars) ? json.chars : []);
        setAcctTitle(json.title || '');
        setBerror('');
        setBstep('roster');
      }
    } catch (e) { /* broker offline: stay on the form */ }
  };

  // Discord login opens in a popup so the client is never navigated away. The
  // broker's callback (given ?popup=1) posts a message back and closes the popup
  // instead of redirecting the whole page. If the browser blocks the popup, fall
  // back to the same-tab round-trip -- exactly the old behaviour, so a hard block
  // never leaves Discord unreachable.
  const startDiscord = () => {
    setBerror('');
    const w = window.open(ACCOUNT_API + '/discord/start?popup=1', 'dl_discord',
      'width=520,height=760,noopener=no');
    if (!w) {
      window.location.href = ACCOUNT_API + '/discord/start';
      return;
    }
    discordRef.current = true;
    try { w.focus(); } catch (e) { /* some browsers refuse focus() */ }
  };

  // Click a character: mint a one-use entry token and hand it to the game over the
  // WS. The engine cold-loads and sends a prompt, which flips redux `prompt` and
  // fires the reveal effect -- the same signal path A relies on.
  const enterAs = async char => {
    setBerror('');
    enterPending.current = false;
    setBusy(at('entering', lang));
    const { status, json } = await postJson('/enter', { char });
    if (status === 200 && json && json.token) {
      enterPending.current = true;
      rpccmd('account_enter', json.token);
      // account_enter_failed (handled above) clears this the instant the engine
      // refuses; the timeout is only a backstop for a silent no-reply.
      later(() => {
        if (enterPending.current && phaseRef.current === 'login') {
          enterPending.current = false;
          setBusy('');
          setBerror(at('enterfail', lang));
        }
      }, LOGIN_TIMEOUT_MS);
    } else if (status === 401) {
      // Session expired between the roster and the click -- send back to the start.
      setBusy('');
      setBerror(at('expired', lang));
      setBstep('idle');
    } else if (status === 400) {
      setBusy('');
      setBerror(at('notowned', lang));
    } else {
      setBusy('');
      setBerror(at('berror', lang));   // 0 / 502: broker or MUD unreachable
    }
  };

  // Drop the broker session: clear the cookie server-side, then wipe the roster and
  // fall back to the idle door. The busy line masks the roster while the POST is in
  // flight so a character can't be clicked mid-logout. Only leave the roster once the
  // cookie is actually gone (200) -- if the broker is down the cookie survives, so
  // dropping to idle would be a lie the next visit's probe exposes by reopening it.
  const logout = async () => {
    setBerror('');
    setBusy(at('loggingout', lang));
    const { status } = await postJson('/logout', {});
    setBusy('');
    if (status !== 200) {
      setBerror(at('berror', lang));   // broker down: cookie untouched, stay on the roster
      return;
    }
    setRoster([]);
    setAcctTitle('');
    setBstep('idle');
  };

  if (phase === 'hidden') return null;

  // The changing part of the panel (busy line / method chooser / a subflow /
  // the roster) is remounted on every step so its enter-animation replays. Busy
  // gets its own key so the status line fades in over whatever step it interrupts.
  // The centered status line covers either a transient action (busy) or the mount/return
  // session check (checking). Either one hides the step behind it and shares the 'busy' key.
  const statusLine = busy || (checking ? at('loading', lang) : '');
  const stageKey = statusLine ? 'busy' : bstep;
  const curDepth = STEP_DEPTH[bstep] != null ? STEP_DEPTH[bstep] : 0;
  let stageDir = 'fade';
  if (!statusLine) {
    if (curDepth > prevDepthRef.current) stageDir = 'fwd';
    else if (curDepth < prevDepthRef.current) stageDir = 'back';
  }

  return (
    <div
      className={'acc-overlay' + (phase === 'revealing' ? ' is-opening' : '')}
      role="dialog"
      aria-label="Dreamland login"
      style={{ left: accLeft }}
    >
      <div className="acc-slab acc-slab-top" aria-hidden="true" />
      <div className="acc-slab acc-slab-bottom" aria-hidden="true" />

      <div className="acc-controls">
        <div className="acc-seam" aria-hidden="true" />
        <h1 className="acc-logo" role="img" aria-label="Dreamland" />

        <div className="acc-langs" role="group" aria-label={at('lang', lang)}>
          {LANGS.map(l => (
            <button
              key={l.code}
              type="button"
              className={'acc-lang' + (lang === l.code ? ' is-on' : '')}
              onClick={() => pickLang(l.code)}
            >
              {l.code.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="acc-stage" key={stageKey} data-dir={stageDir}>
        {statusLine ? (
          <div className="acc-busy">{statusLine}</div>
        ) : (
          <>
            {/* New-player explainer + create button, and the whole two-path chooser,
                only on the idle front door. Once you step into an account subflow
                (email/code/telegram) or the roster, everything but that one flow is
                hidden and a Back link returns here -- one thing on screen at a time. */}
            {bstep === 'idle' && (
              <>
                <p className="acc-newhero-hint">
                  <strong>{at('new_hero_lead', lang)}</strong> {at('new_hero_body', lang)}
                </p>
                <button type="button" className="btn btn-primary acc-create acc-create-btn" onClick={openCurtain}>
                  {at('create_char', lang)}
                </button>
              </>
            )}
            <div className="acc-cols">
            {/* path A -- character login; only on the idle front door, hidden inside
                any account subflow (email/code/telegram) and the roster */}
            {bstep === 'idle' && (
            <div className="acc-col">
              <div className="acc-col-head">{at('pathA', lang)}</div>
              <form onSubmit={submitChar}>
                <div className="acc-field-row">
                  <div className="acc-field">
                    <label htmlFor="acc-name">{at('name', lang)}</label>
                    <input
                      id="acc-name"
                      ref={nameRef}
                      className="acc-input"
                      type="text"
                      autoComplete="username"
                      value={name}
                      onChange={e => setName(e.target.value)}
                    />
                  </div>
                  <div className="acc-field">
                    <label htmlFor="acc-pass">{at('password', lang)}</label>
                    <input
                      id="acc-pass"
                      className="acc-input"
                      type="password"
                      autoComplete="current-password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                    />
                  </div>
                </div>
                <button type="submit" className="btn acc-cta">{at('enter', lang)}</button>
                <div className="acc-error" role="alert">{error}</div>
              </form>
            </div>
            )}

            {/* path B -- master login via the account broker (email real; bots soon) */}
            <div className="acc-col">
              {/* the "Log in with your account" head labels the three method buttons;
                  inside a subflow each step carries its own head, so drop this one */}
              {bstep === 'idle' && <div className="acc-col-head">{at('pathB', lang)}</div>}

              {bstep === 'idle' && (
                <div className="acc-methods">
                  <button className="btn btn-secondary acc-method"
                    onClick={() => { setBerror(''); setBstep('email'); }}>
                    <span className="acc-ico"><i className="fa fa-envelope" /></span>
                    {at('via_email', lang)}
                  </button>
                  <button className="btn btn-secondary acc-method"
                    onClick={startDiscord}>
                    <span className="acc-ico"><DiscordIcon /></span>
                    {at('via_discord', lang)}
                  </button>
                  <button className="btn btn-secondary acc-method"
                    onClick={() => { setBerror(''); setBstep('telegram'); }}>
                    <span className="acc-ico"><TelegramIcon /></span>
                    {at('via_telegram', lang)}
                  </button>
                </div>
              )}

              {bstep === 'email' && (
                <form onSubmit={sendEmailCode}>
                  <div className="acc-field">
                    <label htmlFor="acc-email">{at('via_email', lang)}</label>
                    <input
                      id="acc-email"
                      className="acc-input"
                      type="email"
                      autoComplete="email"
                      placeholder={at('email_ph', lang)}
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                    />
                  </div>
                  <button type="submit" className="btn acc-cta">{at('send_code', lang)}</button>
                  <button type="button" className="acc-newhero" style={{ marginTop: 10 }}
                    onClick={() => { setBerror(''); setBstep('idle'); }}>{at('back', lang)}</button>
                </form>
              )}

              {bstep === 'code' && (
                <form onSubmit={verifyEmailCode}>
                  <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 8 }}>{at('sent_hint', lang)}</div>
                  <div className="acc-field">
                    <label htmlFor="acc-code">{at('code_ph', lang)}</label>
                    <input
                      id="acc-code"
                      className="acc-input"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      placeholder={at('code_ph', lang)}
                      value={code}
                      onChange={e => setCode(e.target.value)}
                    />
                  </div>
                  <button type="submit" className="btn acc-cta">{at('verify', lang)}</button>
                  <button type="button" className="acc-newhero" style={{ marginTop: 10 }}
                    onClick={() => { setBerror(''); setBstep('email'); }}>{at('back', lang)}</button>
                </form>
              )}

              {bstep === 'telegram' && (
                <div className="acc-tg">
                  <div className="acc-col-head" style={{ fontSize: 14 }}>{at('tg_head', lang)}</div>
                  <div style={{ fontSize: 13, opacity: 0.8, margin: '4px 0 10px' }}>{at('tg_hint', lang)}</div>
                  <div id="acc-tg-widget" className="acc-tg-widget" aria-label={at('tg_head', lang)} />
                  <button type="button" className="acc-newhero" style={{ marginTop: 10 }}
                    onClick={() => { setBerror(''); setBstep('idle'); }}>{at('back', lang)}</button>
                </div>
              )}

              {bstep === 'roster' && (
                <>
                  <div className="acc-col-head" style={{ fontSize: 14 }}>{at('roster', lang)}</div>
                  {acctTitle && (
                    <div className="acc-card-title" style={{ marginBottom: 8 }}>{acctTitle}</div>
                  )}
                  <div className="acc-roster">
                    {roster.map(ch => {
                      // The broker sends {name, level, class:{en,ru,ua}} since the
                      // engine roster carries it; older engines send a bare name.
                      const nm = typeof ch === 'string' ? ch : ch.name;
                      const obj = ch && typeof ch === 'object' ? ch : null;
                      const lvl = obj && obj.level != null ? obj.level : null;
                      const cls = obj && obj.class
                        ? (obj.class[lang] || obj.class.en || '') : '';
                      const label = nm + (cls ? ', ' + cls : '') + (lvl != null ? ' ' + lvl : '');
                      return (
                        <button key={nm} className="acc-card" onClick={() => enterAs(nm)} aria-label={label}>
                          <span className="acc-card-sigil">{nm[0]}</span>
                          <span className="acc-card-id">
                            <span className="acc-card-name">{nm}</span>
                          </span>
                          {(lvl != null || cls) && (
                            <span className="acc-card-meta" aria-hidden="true">
                              {lvl != null && <span className="acc-card-lvl">{lvl}</span>}
                              {cls && <span className="acc-card-cls">{cls}</span>}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <button type="button" className="acc-newhero" style={{ marginTop: 10 }}
                    onClick={logout}>{at('logout', lang)}</button>
                </>
              )}

              <div className="acc-error" role="alert">{berror}</div>
            </div>
            </div>
          </>
        )}
        </div>
        <CelticCrest />
      </div>
    </div>
  );
}
