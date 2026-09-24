import React, { useState, useEffect, useRef } from 'react';
import $ from 'jquery';
import { useSelector } from 'react-redux';
import useMediaQuery from '@mui/material/useMediaQuery';
import { send, rpccmd, reconnect, ensureOpen, isOpen, rpcWhenOpen, cancelFirstFrame } from '../websock';
import { at, LANGS } from '../accountStrings';
import { getLang, setLang } from '../i18n';
import { classIconFor } from '../classIcons';
import PropertiesStorage from '../properties';
import LoginDragon from './LoginDragon';
import '../account-login.css';

// The front-door account panel for /newui. Two obsidian slabs meet at a gold seam;
// the login controls float over it. On a successful login (the web prompt arrives,
// so redux `prompt` flips from null to a value) the controls fade and the slabs
// slide apart, revealing the game behind. See account-login.css for the motion.

const REVEAL_MS = 950;      // slab curtain + settle before we unmount
const LOGIN_TIMEOUT_MS = 4500;
// The same wait when the socket had died first: reconnect + nanny greeting + the entry.
const RECONNECT_WAIT_MS = 12000;
const DRIVE_TIMEOUT_MS = 4000;   // no nanny_step after submit -> server is not in v2 mode

// How deep each path-B step sits, so a step change can slide the new panel in from
// the right when going deeper (idle -> email -> code) and from the left on the way
// back. Steps at the same depth (telegram/roster) just cross-fade. `create` is the
// web character-creation form, one level in from the idle door like a subflow.
const STEP_DEPTH = { idle: 0, email: 1, telegram: 1, roster: 1, code: 2, create: 1 };

// Web character creation (nanny V2 web front). Live since the 2026-09-17 go-live
// (dreamland_fenia/newbie/nanny this.v2 = true), so it defaults ON: the Create button
// opens the web form. A stray ?nannyv2=0 or the localStorage key mudjs.nannyv2='0'
// forces the old drop-to-terminal path for debugging.
const NANNY_V2 = (() => {
  try {
    if (/[?&]nannyv2=0(&|$)/.test(window.location.search)) return false;
    return window.localStorage.getItem('mudjs.nannyv2') !== '0';
  } catch (e) { return true; }
})();

// A basic login name: letters only (either alphabet -- never mixed, the server
// enforces that), no spaces or digits. A lenient client pre-flight; the engine's
// name step is the authority and re-asks over the drive if this misses an edge.
const NAME_RE = /^[A-Za-zА-Яа-яЁёІіЇїЄєҐґ]{2,15}$/;

// The plain-front steps the server signals (nanny_step), in order, and the answer
// the form sends for each. name/password come from form state at submit; the two
// confirms and the screenreader toggle are fixed yes/no tokens the engine accepts
// in every language (patternYes/patternNo). `account` (the mid-creation link offer) is
// auto-declined on the web; `handoff` reveals the terminal.
const CREATE_STEPS = ['name', 'name_confirm', 'password', 'password_confirm', 'screenreader', 'account'];

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



export default function AccountLogin() {
  const prompt = useSelector(s => s.prompt);
  const connected = useSelector(s => s.connection.connected);
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
  // Web character-creation form (bstep === 'create').
  const [password2, setPassword2] = useState('');      // repeat password
  const [screenreader, setScreenreader] = useState(false);
  const [nameStatus, setNameStatus] = useState('');    // '' | checking | ok | taken | reserved | online | bad
  const [crError, setCrError] = useState('');          // create-form error line
  // The idle front door has two faces so the card stays short under the dragon: a
  // short welcome (create + a button into the login controls), or the existing-login
  // controls (path A + the account methods). It persists across the path-B subflows,
  // so a Back out of email/telegram returns here, not to the welcome face.
  const [idleView, setIdleView] = useState('welcome'); // welcome | existing

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
  const dragonRef = useRef(null);       // the login dragon; .shake() on a wrong password
  const segRef = useRef(null);          // language segmented-control track
  const segIndRef = useRef(null);       // its sliding gold-gem indicator
  const timers = useRef([]);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const enterPending = useRef(false);   // path B: a char click is awaiting the engine's reply
  const tgAuthRef = useRef(null);       // latest telegram-auth handler for the widget's global callback
  const prevDepthRef = useRef(0);       // depth of the last shown step, for slide direction
  const discordRef = useRef(false);     // a Discord OAuth popup is in flight
  // Character-creation drive: the form collects and validates the mechanical front,
  // then feeds the plain nanny one answer per nanny_step signal (reliable where a
  // timed type-ahead burst would desync -- the password step takes its value twice).
  const nannyStepRef = useRef(null);    // latest plain-front step the server signalled
  const driving = useRef(false);        // a creation drive is in flight
  const driveAnswers = useRef(null);    // {name, password, sr} captured at submit
  const stepsSent = useRef({});         // steps already answered this drive (re-ask guard)
  const checkTimer = useRef(null);      // debounce timer for check_name
  const latestName = useRef('');        // echo-guard: drop a check_name reply for an old value
  const driveTimer = useRef(null);      // watchdog: no nanny_step -> server not in v2 mode
  // Both ride the nanny's `name` step signal, which the V2 plain front emits
  // (.tmp.nanny.v2). With V2 off they wait out the backstop instead.
  const pendingLogin = useRef(null);    // path A typed over a dead socket: {name, password} for the fresh nanny
  const pendingCheck = useRef(null);    // a check_name still waiting for its answer

  const later = (fn, ms) => {
    const id = setTimeout(fn, ms);
    timers.current.push(id);
    return id;
  };
  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  // Arm (or re-arm) the creation-drive watchdog. Re-armed on every step so a stall
  // anywhere in the drive backs out, not just before the first signal. A name we
  // kicked that then drew no signal was taken mid-fill (the nanny took it down its
  // existing-character path, which emits nothing) -- reconnect for a fresh nanny so
  // the next name is not typed at a stale password prompt. No kick at all means the
  // server is still on the old nanny (client flag on, server .tmp.nanny.v2 off).
  const armWatchdog = (l, ms) => {
    if (driveTimer.current) clearTimeout(driveTimer.current);
    driveTimer.current = setTimeout(() => {
      if (!driving.current) return;
      driving.current = false;
      driveAnswers.current = null;
      setBusy('');
      if (stepsSent.current.name) {
        setNameStatus('taken');
        setCrError(at('cr_taken_race', l));
        // NEW-3: drop the dead nanny's last step before reconnecting, so a
        // sub-second resubmit onto the fresh nanny can't read a stale step and
        // false-"taken" once.
        nannyStepRef.current = null;
        reconnect();
      } else {
        setCrError(at(isOpen() ? 'cr_unavailable' : 'offline', l));
      }
    }, ms || DRIVE_TIMEOUT_MS);
  };

  // A step signalled by a socket that has since died belongs to a nanny that is
  // gone. The fresh socket's nanny signals its own.
  useEffect(() => {
    if (!connected) nannyStepRef.current = null;
  }, [connected]);

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

  // Focus the name field wherever one is mounted (existing login or the create form),
  // so a face switch lands focus on the first input instead of dropping it to <body>.
  // bstep + idleView are in the deps so it re-runs on every face switch. The welcome
  // face has no input and we do NOT focus the Create button -- a programmatic focus lit
  // its :focus gem and read as "already tabbed into" (Kit). No target -> no-op.
  useEffect(() => {
    if (phase !== 'login' || checking) return;
    const id = setTimeout(() => { if (nameRef.current) nameRef.current.focus(); }, 40);
    return () => clearTimeout(id);
  }, [phase, checking, bstep, idleView]);

  // Slide the language segmented-control indicator under the active language. Positioned
  // from layout (offsetLeft/width) on lang change, on mount once the panel is up, after
  // fonts settle, and on resize -- the same technique as the DS segmented control.
  useEffect(() => {
    const place = () => {
      const seg = segRef.current, ind = segIndRef.current;
      if (!seg || !ind) return;
      const act = seg.querySelector('[aria-selected="true"]');
      if (!act) return;
      ind.style.transform = 'translateX(' + act.offsetLeft + 'px)';
      ind.style.width = act.offsetWidth + 'px';
    };
    place();
    let cancelled = false;
    const fonts = document.fonts;
    if (fonts && fonts.ready) fonts.ready.then(() => { if (!cancelled) place(); });
    // Re-place when a webfont finishes loading -- on a cold cache the first placement
    // can measure the fallback font before the theme + Alegreya land (fonts.ready is
    // already resolved by then, so it alone would miss the later load).
    if (fonts && fonts.addEventListener) fonts.addEventListener('loadingdone', place);
    window.addEventListener('resize', place);
    return () => {
      cancelled = true;
      window.removeEventListener('resize', place);
      if (fonts && fonts.removeEventListener) fonts.removeEventListener('loadingdone', place);
    };
  }, [lang, phase, checking]);

  useEffect(() => () => {
    clearTimers();
    if (checkTimer.current) clearTimeout(checkTimer.current);
    if (driveTimer.current) clearTimeout(driveTimer.current);
  }, []);

  // Remember the depth of the step now on screen so the NEXT change knows which
  // way to slide. Kept in an effect (not computed during render) so React's
  // double-invoked renders can't corrupt the comparison. Busy is a passing
  // status over the same step, so it never moves the mark.
  useEffect(() => {
    if (!busy && !checking) prevDepthRef.current = STEP_DEPTH[bstep] != null ? STEP_DEPTH[bstep] : 0;
  }, [bstep, busy, checking]);

  // The engine answers account_enter with account_enter_ok / account_enter_failed over
  // the WS (descriptor.cpp). On success the socket is already in the world, so reveal
  // now rather than wait for a prompt: a take-over or a held pager can leave the prompt
  // late or absent, and the backstop in enterAs would then report a failed entry over a
  // live session -- and offer a roster tap that this socket can never redeem. The
  // prompt, when it lands, finds the door already open and changes nothing. On failure
  // (a same-account conflict, an expired token, a cold-load refusal) react at once
  // instead of waiting out the backstop.
  useEffect(() => {
    // Not gated on enterPending: an ok that lands after the backstop gave up still
    // means this socket is in the world, and the door must not stay shut over it.
    const onEnterOk = () => {
      if (phaseRef.current !== 'login') return;
      enterPending.current = false;
      openCurtain();
    };
    const onEnterFailed = () => {
      // A refused second tap must not stop a reveal the first one started.
      if (!enterPending.current || phaseRef.current !== 'login') return;
      enterPending.current = false;
      clearTimers();
      setBusy('');
      setBerror(at('enterfail', lang));
      if (dragonRef.current) dragonRef.current.shake();   // entry refused -> the dragon says no
    };
    $('#rpc-events').on('rpc-account_enter_ok', onEnterOk);
    $('#rpc-events').on('rpc-account_enter_failed', onEnterFailed);
    return () => {
      $('#rpc-events').off('rpc-account_enter_ok', onEnterOk);
      $('#rpc-events').off('rpc-account_enter_failed', onEnterFailed);
    };
  }, [lang]);

  // Web character creation: the server's plain nanny signals which mechanical step
  // it is waiting on (nanny_step) and answers name availability (check_name_result).
  // Both are character-less WS commands live in the nanny window. We track the current
  // step always, and while a create is in flight we feed the collected answer for the
  // step the nanny just reached -- one per signal, so nothing desyncs.
  useEffect(() => {
    const onStep = (e, step) => {
      nannyStepRef.current = step;

      // A fresh socket's nanny has reached the name: finish what the dead one
      // could not carry.
      if (step === 'name' && pendingLogin.current) {
        const p = pendingLogin.current;
        pendingLogin.current = null;
        send(p.name);
        later(() => send(p.password), 180);
        return;
      }
      if (step === 'name' && pendingCheck.current) {
        const v = pendingCheck.current;
        if (v === latestName.current) rpccmd('check_name', v);
        else pendingCheck.current = null;
      }

      if (!driving.current) return;
      const a = driveAnswers.current;
      if (!a) return;

      if (step === 'handoff') {
        // Mechanical front done: reveal the terminal for Archivarius (same motion as
        // a login reveal, inlined so this effect needs no forward reference). The
        // password is now in the game -- drop the client copy.
        driving.current = false;
        driveAnswers.current = null;
        if (driveTimer.current) { clearTimeout(driveTimer.current); driveTimer.current = null; }
        clearTimers();
        setBusy('');
        setPhase('revealing');
        later(() => setPhase('hidden'), REVEAL_MS);
        return;
      }

      if (step === 'name' && stepsSent.current.name) {
        // The nanny re-asked the name after we sent it: taken in the race between the
        // inline check and the drive. Stop and send the player back to the field.
        driving.current = false;
        driveAnswers.current = null;
        if (driveTimer.current) { clearTimeout(driveTimer.current); driveTimer.current = null; }
        setBusy('');
        setNameStatus('taken');
        setCrError(at('cr_taken_race', lang));
        return;
      }

      stepsSent.current[step] = true;
      if (step === 'name') send(a.name);
      else if (step === 'name_confirm') send('yes');
      else if (step === 'password') send(a.password);
      else if (step === 'password_confirm') send(a.password);
      else if (step === 'screenreader') send(a.sr);
      // The engine offers a mid-creation account link (taskAccount). The web form has
      // no account field yet, so decline it -- the player links later from the account
      // login or the in-world `account` command. Without this the drive would stall on
      // the engine's waitConfirm and the watchdog would false-fail as "name taken".
      else if (step === 'account') send('no');
      armWatchdog(lang);   // progress made -- re-arm for the next step
    };

    const onCheck = (e, data) => {
      if (data && data.name === pendingCheck.current) pendingCheck.current = null;
      // Echo-guard: a reply for a value the field has since moved past is stale.
      if (!data || data.name !== latestName.current) return;
      if (data.ok) { setNameStatus('ok'); return; }
      // Map the engine's reasons onto the form's status set. 'exists' (a saved
      // character owns it) and anything unforeseen read as plain "taken".
      const r = data.reason;
      setNameStatus(r === 'reserved' ? 'reserved' : r === 'online' ? 'online' : 'taken');
    };

    // A new socket (version comes first on every one) has a nanny that has not
    // asked anything yet; a step from the previous socket must not be trusted.
    const onVersion = () => { nannyStepRef.current = null; };

    $('#rpc-events').on('rpc-nanny_step', onStep);
    $('#rpc-events').on('rpc-check_name_result', onCheck);
    $('#rpc-events').on('rpc-version', onVersion);
    return () => {
      $('#rpc-events').off('rpc-nanny_step', onStep);
      $('#rpc-events').off('rpc-check_name_result', onCheck);
      $('#rpc-events').off('rpc-version', onVersion);
    };
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
        setIdleView('existing');   // the error line lives on the existing face; show it there
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
        setBstep('idle'); setIdleView('existing'); setBerror(at('d_nolink', lang));
      } else if (d.error === 'discord_off') {
        setBstep('idle'); setIdleView('existing'); setBerror(at('soon', lang));
      } else {
        setBstep('idle'); setIdleView('existing'); setBerror(at('berror', lang));
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
    if (l === lang) return;
    setLang(l);
    try { localStorage.setItem('mudjs.lang', l); } catch (e) { /* private mode */ }
    setLangState(l);
    // Show that the language is the game's, not just the chrome's: cycle the socket
    // so the nanny replays from its greeting in the new language (langsync answers
    // the "Choose your language" menu from the value we just saved). Only pre-login
    // -- once a prompt is in hand the player is in the world and keeps their session.
    if (!prompt) reconnect();
  };

  // ---- path A: real character login (drives the server nanny) --------------
  const submitChar = e => {
    e.preventDefault();
    if (!name.trim() || !password) return;
    setError('');
    setBusy(at('entering', lang));
    const open = isOpen();
    if (open) {
      send(name.trim());
      later(() => send(password), 180);
    } else {
      // Typed at a dead line: bring it back and answer the fresh nanny's name step.
      pendingLogin.current = { name: name.trim(), password };
      ensureOpen();
    }
    // If the prompt never arrives, the credentials were wrong -- re-show the form.
    later(() => {
      // Still waiting on a line that never came back: say so, not "wrong password".
      const lineDown = pendingLogin.current !== null;
      pendingLogin.current = null;
      if (phaseRef.current === 'login') {
        setBusy('');
        setError(at(lineDown ? 'offline' : 'fail', lang));
        if (!lineDown && dragonRef.current) dragonRef.current.shake();   // wrong password -> the dragon says no
      }
    }, open ? LOGIN_TIMEOUT_MS : RECONNECT_WAIT_MS);
  };

  // ---- character creation (nanny V2 web front) -----------------------------
  // Open the form, or -- when the flag is off / the server is still on the old nanny
  // -- drop straight to the raw terminal exactly as before.
  const startCreate = () => {
    if (!NANNY_V2) { openCurtain(); return; }
    setError(''); setCrError('');
    setName(''); setPassword(''); setPassword2(''); setScreenreader(false);
    setNameStatus(''); latestName.current = '';
    setBstep('create');
  };

  // Name availability, debounced. Bad format is caught locally (no round-trip); a
  // well-formed name is asked of the engine (check_name), and rpc-check_name_result
  // sets the inline status. latestName guards a reply for a value already typed past.
  const onCreateName = v => {
    setName(v);
    latestName.current = v;
    setCrError('');
    if (checkTimer.current) { clearTimeout(checkTimer.current); checkTimer.current = null; }
    if (v === '') { setNameStatus(''); return; }
    if (!NAME_RE.test(v)) { setNameStatus('bad'); return; }
    setNameStatus('checking');
    checkTimer.current = setTimeout(() => {
      // Kept until the answer lands: if this socket turns out dead (closed now,
      // or a zombie a probe later replaces), the fresh nanny's name step asks again.
      pendingCheck.current = v;
      if (!rpccmd('check_name', v)) ensureOpen();
    }, 350);
  };

  const submitCreate = e => {
    e.preventDefault();
    setCrError('');
    if (nameStatus !== 'ok') { setCrError(at('cr_fix_name', lang)); return; }
    if (password.length < 5) { setCrError(at('cr_pw_short', lang)); return; }
    if (password !== password2) { setCrError(at('cr_pw_mismatch', lang)); return; }

    driveAnswers.current = { name: name.trim(), password, sr: screenreader ? 'yes' : 'no' };
    stepsSent.current = {};
    driving.current = true;
    setBusy(at('cr_creating', lang));

    // The nanny is parked at the name step (it signalled `name` while the form was
    // filled). Send the name to advance it; each following step rides its own signal.
    // Over a dead line, reconnect instead: the fresh nanny's own `name` signal starts
    // the drive.
    const open = isOpen();
    if (!open) {
      nannyStepRef.current = null;
      ensureOpen();
    } else if (nannyStepRef.current === 'name') {
      stepsSent.current.name = true;
      send(driveAnswers.current.name);
    }

    // Watchdog: if no nanny_step follows (server not in v2), or the name turns out
    // taken and the drive stalls, back out cleanly instead of hanging (armWatchdog
    // distinguishes the two and re-arms on each step).
    armWatchdog(lang, open ? DRIVE_TIMEOUT_MS : RECONNECT_WAIT_MS);
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
  // WS. The engine enters and answers account_enter_ok (handled above), which opens
  // the door.
  const enterAs = async char => {
    setBerror('');
    enterPending.current = false;
    setBusy(at('entering', lang));
    const { status, json } = await postJson('/enter', { char });
    if (status === 200 && json && json.token) {
      enterPending.current = true;
      // A dead socket (a reboot, a laptop lid) is reconnected and the token leads
      // the fresh one; otherwise it goes out now.
      const sentNow = rpcWhenOpen('account_enter', json.token);
      // account_enter_ok / _failed (handled above) clear this the instant the engine
      // answers; the timeout is only a backstop for a silent no-reply.
      later(() => {
        if (enterPending.current && phaseRef.current === 'login') {
          enterPending.current = false;
          cancelFirstFrame();
          setBusy('');
          setBerror(at(isOpen() ? 'enterfail' : 'offline', lang));
        }
      }, sentNow ? LOGIN_TIMEOUT_MS : RECONNECT_WAIT_MS);
    } else if (status === 401) {
      // Session expired between the roster and the click -- send back to the start.
      // Land on the existing face so the expired-session line is visible (a player
      // who arrived on the roster via the /session probe never toggled idleView).
      setBusy('');
      setBerror(at('expired', lang));
      setBstep('idle');
      setIdleView('existing');
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
  // Fold idleView into the key so the welcome<->existing toggle remounts the stage and
  // replays the enter animation, like every other step change (both faces are depth 0,
  // so it cross-fades rather than sliding).
  const stageKey = statusLine ? 'busy' : (bstep === 'idle' ? 'idle-' + idleView : bstep);
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

      {/* The living arcane glow behind the card -- a wormhole that pulses unevenly
          and lights the gold rim from behind. Sits below .acc-controls (z 2 vs 3).
          See .acc-portal in account-login.css. */}
      <div className="acc-portal" aria-hidden="true" />

      <div className="acc-stack">
      {/* The dragon guards the gate: it perches while you are still getting in,
          and is gone once you are (the roster is the character-select screen --
          you are already authenticated, nothing left to halt). Dropping it lets
          the stack re-centre the card on its own. */}
      {bstep !== 'roster' ? <LoginDragon ref={dragonRef} /> : null}
      <div className="acc-controls">
        {/* the DS "big inset" modular inner frame (ds-frame): corners + double-stroke
            sides + keystones, a fine engraved rule a step inside the gold rail */}
        <div className="acc-inner-frame ds-frame" aria-hidden="true">
          <span className="ds-frame__c tl" /><span className="ds-frame__c tr" />
          <span className="ds-frame__c bl" /><span className="ds-frame__c br" />
          <span className="ds-frame__s top" /><span className="ds-frame__s bottom" />
          <span className="ds-frame__s left" /><span className="ds-frame__s right" />
          <span className="ds-frame__k" /><span className="ds-frame__k bottom" />
        </div>
        <div className="acc-seam" aria-hidden="true" />
        <h1 className="acc-logo" role="img" aria-label="Dreamland" />

        <div className="acc-langs">
          <div className="acc-seg" role="tablist" aria-label={at('lang', lang)} ref={segRef}>
            <span className="acc-seg__ind" aria-hidden="true" ref={segIndRef} />
            {LANGS.map(l => (
              <button
                key={l.code}
                type="button"
                role="tab"
                aria-selected={lang === l.code}
                className="acc-seg__btn"
                onClick={() => pickLang(l.code)}
              >
                {l.code.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="acc-stage" key={stageKey} data-dir={stageDir}>
        {statusLine ? (
          <div className="acc-busy">{statusLine}</div>
        ) : bstep === 'create' ? (
          <form className="acc-create-form" onSubmit={submitCreate}>
            <div className="acc-col-head">{at('cr_title', lang)}</div>

            <div className="acc-field">
              <label htmlFor="cr-name">{at('name', lang)}</label>
              <input
                id="cr-name"
                ref={nameRef}
                className="acc-input"
                type="text"
                autoComplete="off"
                spellCheck="false"
                value={name}
                onChange={e => onCreateName(e.target.value)}
              />
              {nameStatus && (
                <div className={'acc-namestatus is-' + nameStatus} role="status">
                  {at('nm_' + nameStatus, lang)}
                </div>
              )}
            </div>

            <div className="acc-field-row">
              <div className="acc-field">
                <label htmlFor="cr-pass">{at('password', lang)}</label>
                <input
                  id="cr-pass"
                  className="acc-input"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
              </div>
              <div className="acc-field">
                <label htmlFor="cr-pass2">{at('cr_pass2', lang)}</label>
                <input
                  id="cr-pass2"
                  className="acc-input"
                  type="password"
                  autoComplete="new-password"
                  value={password2}
                  onChange={e => setPassword2(e.target.value)}
                />
              </div>
            </div>
            <div className="acc-fieldhint acc-fieldhint-row">{at('cr_pw_hint', lang)}</div>

            {/* screen-reader support -- the DS toggle switch (aria-pressed drives its skin) */}
            <div className="acc-switch-row">
              <button
                type="button"
                className="ds-switch"
                aria-pressed={screenreader}
                aria-label={at('cr_sr', lang)}
                onClick={() => setScreenreader(v => !v)}
              >
                <span className="ds-switch__knob" />
              </button>
              <span className="acc-switch-label">{at('cr_sr', lang)}</span>
            </div>

            <button type="submit" className="btn btn-primary acc-cta acc-cta-lg">{at('cr_create', lang)}</button>
            <div className="acc-error" role="alert">{crError}</div>
            <button type="button" className="acc-newhero"
              onClick={() => { setBstep('idle'); setCrError(''); }}>{at('back', lang)}</button>
          </form>
        ) : (
          <>
            {/* The idle front door, welcome face: a short new-player explainer, the
                Create button, and one button through to the existing-login controls.
                Kept short so the card stays compact under the dragon. */}
            {bstep === 'idle' && idleView === 'welcome' && (
              <>
                <p className="acc-newhero-hint">
                  <strong>{at('new_hero_lead', lang)}</strong> {at('new_hero_body', lang)}
                </p>
                <button type="button" className="btn btn-primary acc-create" onClick={startCreate}>
                  {at('create_char', lang)}
                </button>
                <button type="button" className="btn btn-secondary acc-existing"
                  onClick={() => { setBerror(''); setError(''); setIdleView('existing'); }}>
                  {at('existing_login', lang)}
                </button>
              </>
            )}
            {/* The login controls (path A + the account methods), and every path-B
                subflow. Shown on the idle 'existing' face, and always for a subflow /
                the roster (which arrive by their own bstep, welcome face or not). */}
            {(bstep !== 'idle' || idleView === 'existing') && (
            <div className="acc-cols">
            {/* path A -- character login; only on the idle door, hidden inside any
                account subflow (email/code/telegram) and the roster. Its fields carry
                their own labels, so no section head. */}
            {bstep === 'idle' && (
            <div className="acc-col">
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

            {/* path B -- master login via the account broker (email real; bots soon).
                No section head: the buttons name themselves. */}
            <div className="acc-col">
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
                  <button type="button" className="acc-newhero"
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
                  <button type="button" className="acc-newhero"
                    onClick={() => { setBerror(''); setBstep('email'); }}>{at('back', lang)}</button>
                </form>
              )}

              {bstep === 'telegram' && (
                <div className="acc-tg">
                  <div className="acc-col-head" style={{ fontSize: 14 }}>{at('tg_head', lang)}</div>
                  <div style={{ fontSize: 13, opacity: 0.8, margin: '4px 0 10px' }}>{at('tg_hint', lang)}</div>
                  <div id="acc-tg-widget" className="acc-tg-widget" aria-label={at('tg_head', lang)} />
                  <button type="button" className="acc-newhero"
                    onClick={() => { setBerror(''); setBstep('idle'); }}>{at('back', lang)}</button>
                </div>
              )}

              {bstep === 'roster' && (
                <>
                  {acctTitle && (
                    <div className="acc-roster-lead">
                      {at('roster_lead', lang).replace('{title}', acctTitle)}
                    </div>
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
                      // The badge is picked off class.en (the engine key), not the
                      // localized label; unmapped or class-less rows keep the letter.
                      const icon = obj && obj.class ? classIconFor(obj.class.en) : null;
                      const label = nm + (cls ? ', ' + cls : '') + (lvl != null ? ' ' + lvl : '');
                      return (
                        <button key={nm} className="acc-card" onClick={() => enterAs(nm)} aria-label={label}>
                          {icon
                            ? <span className="acc-card-sigil acc-card-sigil-icon">
                                <img src={icon} alt="" aria-hidden="true" />
                              </span>
                            : <span className="acc-card-sigil">{nm[0]}</span>}
                          <span className="acc-card-id">
                            <span className="acc-card-name">{nm}</span>
                            {cls && <span className="acc-card-cls" aria-hidden="true">{cls}</span>}
                          </span>
                          {lvl != null && <span className="acc-card-lvl" aria-hidden="true">{lvl}</span>}
                        </button>
                      );
                    })}
                  </div>
                  <button type="button" className="acc-newhero"
                    onClick={logout}>{at('logout', lang)}</button>
                </>
              )}

              <div className="acc-error" role="alert">{berror}</div>
            </div>

            {/* Back to the welcome face -- only on the idle existing door */}
            {bstep === 'idle' && (
              <button type="button" className="acc-newhero"
                onClick={() => { setBerror(''); setError(''); setIdleView('welcome'); }}>
                {at('back', lang)}
              </button>
            )}
            </div>
            )}
          </>
        )}
        </div>
      </div>
      </div>
    </div>
  );
}
