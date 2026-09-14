import React, { useState, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { send, rpccmd } from '../websock';
import { at, LANGS } from '../accountStrings';
import { getLang, setLang } from '../i18n';
import '../account-login.css';

// The front-door account panel for /newui. Two obsidian slabs meet at a gold seam;
// the login controls float over it. On a successful login (the web prompt arrives,
// so redux `prompt` flips from null to a value) the controls fade and the slabs
// slide apart, revealing the game behind. See account-login.css for the motion.

const REVEAL_MS = 950;      // slab curtain + settle before we unmount
const LOGIN_TIMEOUT_MS = 4500;

// Mock roster for the master-login path -- the entry-token backend is not built
// yet, so path B is a visual prototype (labelled as such on the panel).
const MOCK_ROSTER = [
  { name: 'Taiphoen', title: 'Scarred Mantis of the Broken Oath' },
  { name: 'Dementia', title: 'Wandering Ember of Mohiva' },
];

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
      aria-modal="true"
      aria-label="Dreamland login"
    >
      <div className="acc-slab acc-slab-top" aria-hidden="true" />
      <div className="acc-slab acc-slab-bottom" aria-hidden="true" />

      <div className="acc-controls">
        <h1 className="acc-title">DREAMLAND</h1>
        <div className="acc-sub">{at('subtitle', lang)}</div>

        {busy ? (
          <div className="acc-busy">{busy}</div>
        ) : (
          <div className="acc-cols">
            {/* path A -- character login */}
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
                <button type="submit" className="acc-btn">{at('enter', lang)}</button>
                <div className="acc-error" role="alert">{error}</div>
              </form>
            </div>

            {/* path B -- master login (prototype) */}
            <div className="acc-col">
              <div className="acc-col-head">{at('pathB', lang)}</div>

              {bstep === 'idle' && (
                <>
                  <div className="acc-hint">{at('pathB_hint', lang)}</div>
                  <button className="acc-btn acc-btn-ghost" onClick={() => setBstep('email')}>
                    <span className="acc-ico"><i className="fa fa-envelope" /></span>
                    {at('via_email', lang)}
                  </button>
                  <button className="acc-btn acc-btn-ghost" onClick={authViaBot}>
                    <span className="acc-ico"><i className="fa fa-comments" /></span>
                    {at('via_discord', lang)}
                  </button>
                  <button className="acc-btn acc-btn-ghost" onClick={authViaBot}>
                    <span className="acc-ico"><i className="fa fa-telegram" /></span>
                    {at('via_telegram', lang)}
                  </button>
                </>
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
                  <button type="submit" className="acc-btn">{at('verify', lang)}</button>
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
        )}

        <div className="acc-foot">
          <button type="button" className="acc-newhero" onClick={openCurtain}>
            {at('new_hero', lang)}
          </button>
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
        </div>
      </div>

      <div className="acc-proto">{at('prototype', lang)}</div>
    </div>
  );
}
