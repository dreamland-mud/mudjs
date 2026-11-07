/* Speaking of new output. Ctrl+Shift+S (#speech) turns it off and on; the
 * output is still shown, only the terminal's announcer keeps quiet. The
 * speech filter (#speechfilter) lists words and phrases, one per line: a line
 * of output with any of them in it, in any case, is shown but not spoken.
 * Both are kept in this browser. */
import { APP_ROLE } from '../../review';
import React, { useEffect, useRef, useState } from 'react';
import Sheet from '../Sheet';
import { registerTool } from '../tools';
import { registerView } from '../views';
import { setAnnounceFilter } from '../../components/terminal';
import { t } from '../../i18n';
import { say, tf } from './speak';

const FILTER_KEY = 'mudjs.speechFilter';
const OFF_KEY = 'mudjs.speechOff';

function load(key) {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    return null;
  }
}

function store(key, value) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch (e) {
    // private mode: kept for this visit only
  }
}

const parseWords = text =>
  String(text || '')
    .split('\n')
    .map(w => w.trim())
    .filter(Boolean);

let speechOff = load(OFF_KEY) === '1';
let words = parseWords(load(FILTER_KEY));
let lowWords = words.map(w => w.toLowerCase());

export function setWords(list) {
  words = list;
  lowWords = list.map(w => w.toLowerCase());
  store(FILTER_KEY, list.length ? list.join('\n') : null);
}

setAnnounceFilter(text => {
  if (speechOff) return '';
  if (!lowWords.length) return text;
  return text
    .split('\n')
    .filter(line => {
      const low = line.toLowerCase();
      return !lowWords.some(w => low.includes(w));
    })
    .join('\n');
});

export function toggleSpeech() {
  speechOff = !speechOff;
  store(OFF_KEY, speechOff ? '1' : null);
  say(t(speechOff ? 'out.speech.off' : 'out.speech.on'));
}

let openSheet = null;

function FilterSheet() {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const box = useRef(null);
  useEffect(() => {
    openSheet = () => {
      setValue(words.join('\n'));
      setOpen(true);
    };
    return () => {
      openSheet = null;
    };
  }, []);
  const close = () => setOpen(false);
  const save = e => {
    e.preventDefault();
    const list = parseWords(value);
    setWords(list);
    setOpen(false);
    say(tf('out.sf.saved', list.length), 200);
  };
  return (
    <Sheet id="out-speechfilter" open={open} onClose={close} title={t('out.sf')} initialFocus={box}>
      <form onSubmit={save} className="port-form">
        {/* An application to NVDA: Escape closes the window at once instead of first switching to browse mode. */}
        <label role={APP_ROLE} aria-label={t('out.sf.label')}>
          <span>{t('out.sf.label')}</span>
          <textarea
            ref={box}
            className="port-text"
            value={value}
            spellCheck={false}
            onChange={e => setValue(e.target.value)}
          />
        </label>
        <div className="port-actions">
          <button type="submit" className="port-btn">
            {t('out.sf.save')}
          </button>
          <button type="button" className="port-btn" onClick={close}>
            {t('out.sf.cancel')}
          </button>
        </div>
      </form>
    </Sheet>
  );
}

registerView('out-speechfilter', FilterSheet);

registerTool({
  id: 'out-speech',
  menu: false, // spoken only, or Settings itself: not on the Tools page
  label: () => tf('out.speech', t(speechOff ? 'out.speech.state.off' : 'out.speech.state.on')),
  keys: ['ctrl+shift+s'],
  hash: 'speech',
  run: () => toggleSpeech(),
});

registerTool({
  id: 'out-speechfilter',
  label: () => t('out.sf'),
  hash: 'speechfilter',
  run: () => openSheet && openSheet(),
});
