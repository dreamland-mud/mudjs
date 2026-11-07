/* The window every tool opens in: a modal side sheet on the dark ground with
 * the gold modular frame (SheetFrame), drawn in port.css; its controls come
 * from the Nirvana design system classes only (port.css says which).
 *
 * role=dialog with aria-modal and a heading for its name; out of the
 * accessibility tree while closed; Escape and the close button close it; Tab
 * stays inside; the focus goes in on open and back to where it came from on
 * close. While open, body.port-sheet-open tells the command line and the chat
 * keys that typing belongs here. One sheet at a time, shared with the help
 * sheet and settings through sheets.js. */
import React, { useEffect, useRef } from 'react';
import $ from 'jquery';
import { announceSheet, onOtherSheet } from '../sheets';
import { IS_PHONE } from '../device';
import { inertAround } from '../modal';
import { t } from '../i18n';
import SheetFrame from '../components/helpSheet/SheetFrame';
import '../components/dsControls.css';
import './port.css';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

let openCount = 0;

/* $(document).trigger(REFOCUS, [id]) puts the focus back into sheet id if it
 * is open; without an id, into whichever sheet is open. */
export const REFOCUS = 'port:sheet-refocus';

/* The controls Tab can reach in el, in page order. */
function tabbable(el) {
  return Array.from(el.querySelectorAll(FOCUSABLE)).filter(x => x.getClientRects().length > 0);
}

/* Into the sheet: the element the tool asked for (its search box), else the
 * first control, else the sheet itself, which reads its name. */
function focusInto(sheetEl, initialFocus) {
  const el = initialFocus && initialFocus.current;
  if (el && typeof el.focus === 'function' && sheetEl && sheetEl.contains(el)) return el.focus();
  // The title, not the sheet: VoiceOver on an iPhone takes a focused
  // container for one single element and never goes inside it.
  const title = sheetEl && sheetEl.querySelector('.port-title');
  if (title) title.focus();
  else if (sheetEl) sheetEl.focus();
}

export default function Sheet({ id, open, onClose, title, children, wide, initialFocus }) {
  const sheet = useRef(null);
  const returnTo = useRef(null);
  const titleId = 'port-title-' + id;

  // Subscribed once: the latest open and onClose are read when another sheet
  // opens, so an inline onClose does not subscribe again on every render.
  const openRef = useRef(open);
  const closeRef = useRef(onClose);
  openRef.current = open;
  closeRef.current = onClose;
  useEffect(() => onOtherSheet('port-' + id, () => openRef.current && closeRef.current()), [id]);

  useEffect(() => {
    if (!open) return undefined;
    returnTo.current = document.activeElement;
    announceSheet('port-' + id);
    openCount++;
    document.body.classList.add('port-sheet-open');
    const timer = setTimeout(() => focusInto(sheet.current, initialFocus), 0);
    // A modal window: the focus does not leave it while it is open, whatever
    // moved it (a Tab the trap missed, a click on the page, a script). Another
    // dialog shown over it keeps the focus it took.
    const keepIn = e => {
      const s = sheet.current;
      const to = e.target;
      if (!s || !to || s.contains(to)) return;
      if (to.closest && to.closest('[role="dialog"]:not([aria-hidden="true"])')) return;
      focusInto(s, initialFocus);
    };
    document.addEventListener('focusin', keepIn);
    // And out of a screen reader's reach: the page behind is inert.
    const undoInert = sheet.current ? inertAround(sheet.current) : () => {};
    // The tool's key again, or its #command: the focus goes back in.
    const refocus = (e, which) => {
      if ((which == null || which === id) && sheet.current && !sheet.current.contains(document.activeElement)) focusInto(sheet.current, initialFocus);
    };
    $(document).on(REFOCUS, refocus);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('focusin', keepIn);
      undoInert();
      $(document).off(REFOCUS, refocus);
      openCount--;
      if (openCount <= 0) {
        openCount = 0;
        document.body.classList.remove('port-sheet-open');
      }
      const back = returnTo.current;
      setTimeout(() => {
        // Closed because another sheet opened: that sheet keeps the focus.
        if (openCount > 0) return;
        const now = document.activeElement;
        if (now && now !== document.body && now.closest && now.closest('[role="dialog"]:not([aria-hidden="true"])')) return;
        if (back && typeof back.focus === 'function' && document.contains(back) && back !== document.body) back.focus();
        else {
          const input = document.getElementById('inputBox');
          if (input) input.focus();
        }
      }, 0);
    };
    // initialFocus is a ref: reading it inside is enough.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, id]);

  const onKeyDown = e => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== 'Tab' || e.ctrlKey || e.altKey || !sheet.current) return;
    // Every Tab is moved here, so the focus can never step out: from any
    // place in the sheet, also one Tab does not stop on (the details text),
    // to the next or previous control in page order, round the ends.
    const items = tabbable(sheet.current);
    e.preventDefault();
    if (!items.length) return sheet.current.focus();
    const now = document.activeElement;
    let i = items.indexOf(now);
    if (i < 0) {
      // Not a control: the first one after it (or before it, with Shift).
      const after = items.findIndex(x => now && now.compareDocumentPosition(x) & Node.DOCUMENT_POSITION_FOLLOWING);
      if (e.shiftKey) i = after < 0 ? items.length : after;
      else i = after < 0 ? -1 : after - 1;
    }
    const n = e.shiftKey ? (i - 1 + items.length) % items.length : (i + 1) % items.length;
    items[n].focus();
  };

  return (
    <>
      <div className={open ? 'port-scrim port-scrim-open' : 'port-scrim'} onClick={onClose} />
      <section
        ref={sheet}
        className={'port-sheet' + (open ? ' port-sheet-open' : '') + (wide ? ' port-sheet-wide' : '')}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-hidden={!open}
        tabIndex={IS_PHONE ? undefined : -1}
        onKeyDown={onKeyDown}
      >
        {open ? (
          <div className="port-surface">
            <SheetFrame />
            <div className="port-head">
              <h2 id={titleId} className="port-title" tabIndex={-1}>{title}</h2>
              <button type="button" className="ds-mapctrl port-close" aria-label={t('tools.close')} onClick={onClose}>
                ✕
              </button>
            </div>
            <div className="port-body">{children}</div>
          </div>
        ) : null}
      </section>
    </>
  );
}
