/* Find in output: Ctrl+F asks for the text and finds the newest line with it;
 * Ctrl+G goes on to older matches, Ctrl+Shift+G back to newer ones, also after
 * the window has closed. The line is spoken, and when it is still on screen
 * the terminal scrolls to it and marks the match. The echoed commands are not
 * searched. */
import React, { useEffect, useRef, useState } from 'react';
import Sheet from '../Sheet';
import { registerTool } from '../tools';
import { registerView } from '../views';
import { t } from '../../i18n';
import { lines, firstSeq, bySeq } from './ring';
import { say, tf, AFTER_SHEET_MS } from './speak';
import './output.css';

let findText = '';
let findSeq = null; // seq of the line found last; null: start from the newest
let openSheet = null;
let clearTimer = null;

const HIGHLIGHT = 'port-find';

function unmark() {
  clearTimeout(clearTimer);
  if (window.CSS && CSS.highlights) CSS.highlights.delete(HIGHLIGHT);
  document.querySelectorAll('.port-find-hit').forEach(el => el.classList.remove('port-find-hit'));
}

/* The match in the terminal, if its chunk is still in the page: scrolled to
 * and marked for a few seconds. */
function showInTerminal(line, needle) {
  unmark();
  const chunk = document.querySelector(`.terminal > div[data-chunk-id="${line.chunk}"]`);
  if (!chunk) return;
  const nodes = [];
  const walker = document.createTreeWalker(chunk, NodeFilter.SHOW_TEXT, {
    acceptNode: n => (n.parentElement && n.parentElement.closest('.dropdown-menu') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  let full = '';
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    nodes.push({ n, at: full.length });
    full += n.nodeValue;
  }
  const low = full.replace(/\xa0/g, ' ').toLowerCase();
  const lineAt = low.indexOf(line.text.toLowerCase());
  const at = low.indexOf(needle, lineAt > 0 ? lineAt : 0);
  let target = chunk;
  if (at >= 0) {
    const locate = pos => {
      for (let i = nodes.length - 1; i >= 0; i--) if (pos >= nodes[i].at) return { node: nodes[i].n, off: pos - nodes[i].at };
      return null;
    };
    const a = locate(at);
    const b = locate(at + needle.length);
    if (a && b) {
      target = a.node.parentElement || chunk;
      if (window.CSS && CSS.highlights && typeof window.Highlight === 'function') {
        const range = document.createRange();
        range.setStart(a.node, a.off);
        range.setEnd(b.node, Math.min(b.off, b.node.nodeValue.length));
        CSS.highlights.set(HIGHLIGHT, new window.Highlight(range));
      } else target.classList.add('port-find-hit');
    }
  } else chunk.classList.add('port-find-hit');
  if (target.scrollIntoView) target.scrollIntoView({ block: 'center' });
  clearTimer = setTimeout(unmark, 8000);
}

/* direction -1: older, +1: newer. */
export function findStep(direction, delay) {
  if (!findText) return say(t('out.find.first'), delay);
  const needle = findText.toLowerCase();
  const ring = lines();
  const first = firstSeq();
  let i = findSeq === null || !bySeq(findSeq) ? ring.length : findSeq - first;
  for (i += direction; i >= 0 && i < ring.length; i += direction) {
    const line = ring[i];
    if (line.echo || line.text.toLowerCase().indexOf(needle) < 0) continue;
    findSeq = line.seq;
    showInTerminal(line, needle);
    return say(line.text.trim(), delay);
  }
  say(tf('out.find.none', findText), delay);
}

export function runFind(text, delay) {
  findText = text;
  findSeq = null;
  findStep(-1, delay);
}

function FindSheet() {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const box = useRef(null);

  useEffect(() => {
    openSheet = () => {
      setValue(findText);
      setOpen(true);
    };
    return () => {
      openSheet = null;
    };
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => box.current && box.current.select(), 10);
  }, [open]);

  const close = () => setOpen(false);
  const submit = e => {
    e.preventDefault();
    const text = value.trim();
    setOpen(false);
    if (text) runFind(text, AFTER_SHEET_MS);
  };

  return (
    <Sheet id="out-find" open={open} onClose={close} title={t('out.find')} initialFocus={box}>
      <form onSubmit={submit} className="port-form">
        <label className="port-search">
          <span>{t('out.find.label')}</span>
          <input
            ref={box}
            className="form-control"
            type="search"
            value={value}
            autoComplete="off"
            spellCheck={false}
            onChange={e => setValue(e.target.value)}
          />
        </label>
        <div className="port-actions">
          <button type="submit" className="btn btn-sm">
            {t('out.find.go')}
          </button>
          <button type="button" className="btn btn-sm btn-secondary" onClick={close}>
            {t('out.find.cancel')}
          </button>
        </div>
      </form>
    </Sheet>
  );
}

registerView('out-find', FindSheet);

registerTool({
  id: 'out-find',
  label: () => t('out.find'),
  keys: ['ctrl+f'],
  hash: 'find',
  run: arg => {
    if (arg) return runFind(arg);
    if (openSheet) openSheet();
  },
});

registerTool({
  id: 'out-find-next',
  label: () => t('out.find.next'),
  keys: ['ctrl+g'],
  menu: false,
  run: () => findStep(-1),
});

registerTool({
  id: 'out-find-prev',
  label: () => t('out.find.prev'),
  keys: ['ctrl+shift+g'],
  menu: false,
  run: () => findStep(1),
});
