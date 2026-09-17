import React, { useEffect, useState, useRef } from 'react';
import $ from 'jquery';
import { send, rpccmd } from '../../websock.js';
import { t } from '../../i18n.js';
import { classIconFor } from '../../classIcons.js';
import './AccountPage.css';

// The account page inside the settings window. The client has no account data of
// its own, so it asks the server: rpccmd('account_chars') -> the server replies
// with an 'account_chars' rpc carrying
//   { current, account, title,
//     identities: [ { type, display }, ... ],
//     chars:      [ { name }, ... ] }
// account is false (and the arrays empty) for a character not on an account, or
// before the rpc ships (pre-reboot) -- in which case the manual switch field
// below, which works today, is the way through. Clicking a character sends the
// real `account switch <name>` (the same command that works at the keyboard) and
// closes the window; the server swaps the session.

const NAME_RE = /^[A-Za-z]{1,20}$/;
const LOAD_TIMEOUT_MS = 2000;

// Same broker as the login panel: the account web session lives in a cookie
// here, separate from the in-game character session on the socket.
const ACCOUNT_API = '/account-api';

const METHOD_ICON = {
  email: 'fa-envelope',
  discord: 'fa-comments',
  telegram: 'fa-telegram',
};

export default function AccountPage({ lang, visible }) {
  const [data, setData] = useState(null);       // { current, account, title, identities, chars }
  const [loading, setLoading] = useState(false);
  const [manual, setManual] = useState('');
  const timer = useRef(null);

  // The server's answer arrives as an rpc event, whenever it comes.
  useEffect(() => {
    const onChars = (e, b) => {
      clearTimeout(timer.current);
      setLoading(false);
      setData(b && typeof b === 'object' ? b : { current: null, account: false, chars: [] });
    };
    $('#rpc-events').on('rpc-account_chars', onChars);
    return () => {
      $('#rpc-events').off('rpc-account_chars', onChars);
      clearTimeout(timer.current);
    };
  }, []);

  const fetchChars = () => {
    setLoading(true);
    rpccmd('account_chars');
    // If the server has no such rpc yet (pre-reboot), stop waiting and let the
    // manual field carry the page.
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setLoading(false), LOAD_TIMEOUT_MS);
  };

  // Ask when the page comes into view, and refresh each time it does.
  useEffect(() => {
    if (visible) fetchChars();
  }, [visible]);

  const close = () => $(document).trigger('settings:close');

  const switchTo = name => {
    const clean = String(name || '').trim();
    if (!NAME_RE.test(clean)) return;
    send('account switch ' + clean);
    close();
  };

  const submitManual = e => {
    e.preventDefault();
    switchTo(manual);
  };

  const listChars = () => {
    send('account');
    close();
  };

  // Full logout: drop the browser account session (the broker cookie), then
  // quit the character to the world's front door. The fetch is best-effort --
  // if the broker is down the cookie may survive, but quitting still returns
  // the player to the login panel. Clear the cookie before the socket closes.
  const logout = async () => {
    try {
      await fetch(ACCOUNT_API + '/logout', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
    } catch (e) { /* broker unreachable: quit still returns to the login door */ }
    send('quit');
    close();
  };

  const chars = (data && data.chars) || [];
  const identities = (data && data.identities) || [];
  const current = data && data.current;
  const isCurrent = c => current && c.name.toLowerCase() === String(current).toLowerCase();

  return (
    <div className="acct">
      {loading && !data ? <div className="acct-loading">{t('acct.loading', lang)}</div> : null}

      {data && data.account && data.title ? (
        <div className="acct-title">{data.title}</div>
      ) : null}

      {identities.length ? (
        <div className="acct-block">
          <div className="acct-h">{t('acct.methods', lang)}</div>
          <div className="acct-methods">
            {identities.map((m, i) => (
              <div key={m.type + i} className="acct-method">
                <span className="acct-method-ico">
                  <i className={'fa ' + (METHOD_ICON[m.type] || 'fa-key')} aria-hidden="true" />
                </span>
                <span className="acct-method-type">{m.type}</span>
                <span className="acct-method-val">{m.display}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {chars.length ? (
        <div className="acct-block">
          <div className="acct-h">{t('acct.heroes', lang)}</div>
          <div className="acct-roster">
            {chars.map(c => {
              // Same badge as the login roster, off class.en; class-less rows
              // (an older engine that sends bare names) keep the letter sigil.
              const icon = c.class ? classIconFor(c.class.en) : null;
              return (
              <div
                key={c.name}
                className={'acct-card' + (isCurrent(c) ? ' acct-card-current' : '')}
              >
                {icon
                  ? <span className="acct-sigil acct-sigil-icon" aria-hidden="true">
                      <img src={icon} alt="" aria-hidden="true" />
                    </span>
                  : <span className="acct-sigil" aria-hidden="true">{c.name[0]}</span>}
                <span className="acct-card-main">
                  <span className="acct-card-name">{c.name}</span>
                </span>
                {isCurrent(c) ? (
                  <span className="acct-badge acct-badge-here">{t('acct.current', lang)}</span>
                ) : (
                  <button
                    type="button"
                    className="acct-mini"
                    onClick={() => switchTo(c.name)}
                  >
                    {t('acct.switch', lang)}
                  </button>
                )}
              </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {data && !data.account ? (
        <div className="acct-none">
          <div>{t('acct.no_account', lang)}</div>
          <div className="acct-hint">{t('acct.link_hint', lang)}</div>
        </div>
      ) : null}

      <form className="acct-block acct-manual" onSubmit={submitManual}>
        <label htmlFor="acct-manual-in" className="acct-label">{t('acct.manual', lang)}</label>
        <div className="acct-manual-row">
          <input
            id="acct-manual-in"
            className="acct-input"
            type="text"
            autoComplete="off"
            placeholder={t('acct.manual_ph', lang)}
            value={manual}
            onChange={e => setManual(e.target.value)}
          />
          <button type="submit" className="acct-mini" disabled={!NAME_RE.test(manual.trim())}>
            {t('acct.switch', lang)}
          </button>
        </div>
      </form>

      <div className="acct-actions">
        <button type="button" className="acct-link" onClick={listChars}>
          {t('acct.list', lang)}
        </button>
        <button type="button" className="acct-link" onClick={fetchChars}>
          {t('acct.refresh', lang)}
        </button>
        <button type="button" className="acct-link acct-logout" onClick={logout}>
          <i className="fa fa-sign-out" aria-hidden="true" /> {t('acct.logout', lang)}
        </button>
      </div>
    </div>
  );
}
