import React, { useState, useEffect, useRef } from 'react';
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

// Mock roster for the master-login path -- the entry-token backend is not built
// yet, so path B (account login) is still a visual prototype.
const MOCK_ROSTER = [
  { name: 'Taiphoen', title: 'Scarred Mantis of the Broken Oath' },
  { name: 'Dementia', title: 'Wandering Ember of Moehewa' },
];

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
  const [phase, setPhase] = useState(prompt ? 'hidden' : 'login'); // login | revealing | hidden
  const [lang, setLangState] = useState(getLang());
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');        // centered status line, '' = show the form
  const [bstep, setBstep] = useState('idle');  // path B: idle | email | roster
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');

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
      setBusy('');
      setPhase('revealing');
      later(() => setPhase('hidden'), REVEAL_MS);
    } else if (!prompt && phaseRef.current === 'hidden') {
      setPhase('login');           // quit / disconnect brings the door back
      setBusy('');
      setBstep('idle');
    }
  }, [prompt]);

  useEffect(() => {
    if (phase === 'login') {
      const id = setTimeout(() => nameRef.current && nameRef.current.focus(), 40);
      return () => clearTimeout(id);
    }
  }, [phase]);

  useEffect(() => () => clearTimers(), []);

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

  // ---- path B: master login (mock until entry-token backend lands) ---------
  const authViaEmail = e => {
    e.preventDefault();
    if (!code.trim()) return;
    setBusy(at('authenticating', lang));
    later(() => { setBusy(''); setBstep('roster'); }, 750);
  };
  const authViaBot = () => {
    setBusy(at('authenticating', lang));
    later(() => { setBusy(''); setBstep('roster'); }, 750);
  };
  const enterAs = char => {
    rpccmd('account_enter', 'proto-' + char); // backend ignores this today
    setBusy(at('entering', lang));
    later(openCurtain, 450);
  };

  if (phase === 'hidden') return null;

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

        {busy ? (
          <div className="acc-busy">{busy}</div>
        ) : (
          <>
            {/* Mobile: real primary button (terminal is hidden under the full overlay).
                Desktop: a hint pointing left at the live terminal, where creation happens.
                Both dismiss the panel to the terminal via openCurtain. CSS swaps them. */}
            <button type="button" className="btn btn-primary acc-create acc-create-btn" onClick={openCurtain}>
              {at('create_char', lang)}
            </button>
            <button type="button" className="acc-create-hint" onClick={openCurtain}>
              {at('create_char', lang)}
            </button>
            <div className="acc-cols">
            {/* path A -- character login; hidden once the account roster shows */}
            {bstep !== 'roster' && (
            <div className="acc-col">
              <div className="acc-col-head">{at('pathA', lang)}</div>
              <form onSubmit={submitChar}>
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
                <button type="submit" className="btn acc-cta">{at('enter', lang)}</button>
                <div className="acc-error" role="alert">{error}</div>
              </form>
            </div>
            )}

            {/* path B -- master login (prototype) */}
            <div className="acc-col">
              <div className="acc-col-head">{at('pathB', lang)}</div>

              {bstep === 'idle' && (
                <div className="acc-methods">
                  <button className="btn btn-secondary acc-method" onClick={() => setBstep('email')}>
                    <span className="acc-ico"><i className="fa fa-envelope" /></span>
                    {at('via_email', lang)}
                  </button>
                  <button className="btn btn-secondary acc-method" onClick={authViaBot}>
                    <span className="acc-ico"><DiscordIcon /></span>
                    {at('via_discord', lang)}
                  </button>
                  <button className="btn btn-secondary acc-method" onClick={authViaBot}>
                    <span className="acc-ico"><TelegramIcon /></span>
                    {at('via_telegram', lang)}
                  </button>
                </div>
              )}

              {bstep === 'email' && (
                <form onSubmit={authViaEmail}>
                  <div className="acc-field">
                    <label htmlFor="acc-email">{at('via_email', lang)}</label>
                    <input
                      id="acc-email"
                      className="acc-input"
                      type="email"
                      placeholder={at('email_ph', lang)}
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                    />
                  </div>
                  <div className="acc-field">
                    <input
                      className="acc-input"
                      type="text"
                      inputMode="numeric"
                      placeholder={at('code_ph', lang)}
                      value={code}
                      onChange={e => setCode(e.target.value)}
                    />
                  </div>
                  <button type="submit" className="btn btn-primary acc-cta">{at('verify', lang)}</button>
                  <button type="button" className="acc-newhero" style={{ marginTop: 10 }}
                    onClick={() => setBstep('idle')}>{at('back', lang)}</button>
                </form>
              )}

              {bstep === 'roster' && (
                <>
                  <div className="acc-col-head" style={{ fontSize: 14 }}>{at('roster', lang)}</div>
                  <div className="acc-roster">
                    {MOCK_ROSTER.map(c => (
                      <button key={c.name} className="acc-card" onClick={() => enterAs(c.name)}>
                        <span className="acc-card-sigil">{c.name[0]}</span>
                        <span>
                          <span className="acc-card-name">{c.name}</span><br />
                          <span className="acc-card-title">{c.title}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
