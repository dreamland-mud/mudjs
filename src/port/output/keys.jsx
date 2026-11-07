/* #keys: every key of the tools, also those not in the Tools menu, and the
 * keys of the command line, as a text to read. */
import { APP_ROLE } from '../../review';
import React, { useEffect, useRef, useState } from 'react';
import Sheet from '../Sheet';
import { registerTool, allTools, keyLabel } from '../tools';
import { registerView } from '../views';
import { t } from '../../i18n';
import { PANELS } from './status';

/* "Ctrl+Shift+1 to Ctrl+Shift+0" rather than ten keys in a row. */
function keysText(keys) {
  if (keys.length > 3) return keyLabel([keys[0]]) + ' .. ' + keyLabel([keys[keys.length - 1]]);
  return keyLabel(keys);
}

export function keysList() {
  const tools = allTools().filter(x => (x.keys && x.keys.length) || x.hash);
  const rows = [];
  tools.forEach(x => {
    // One line per panel: Alt+5 is time and weather, and so on.
    if (x.id === 'out-panel') {
      PANELS.forEach(([key], i) =>
        rows.push((x.keys[i] ? keyLabel([x.keys[i]]) : '#panel ' + (i + 1)) + ': ' + t('out.st.title.' + key))
      );
      return;
    }
    if (x.id === 'out-recent') {
      rows.push(keysText(x.keys) + ', #recent: ' + t('out.keys.recent'));
      return;
    }
    rows.push(row(x));
  });
  return [t('out.keys.tools'), ...rows, '', t('out.keys.fixed'), t('out.keys.complete'), t('out.keys.hints')].join('\n');
}

function row(x) {
  const keys = x.keys && x.keys.length ? keysText(x.keys) : '';
  const hash = x.hash ? '#' + x.hash : '';
  return [keys, hash].filter(Boolean).join(', ') + ': ' + x.label();
}

let openSheet = null;

function KeysSheet() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const box = useRef(null);
  useEffect(() => {
    openSheet = () => {
      setText(keysList());
      setOpen(true);
    };
    return () => {
      openSheet = null;
    };
  }, []);
  return (
    <Sheet id="out-keys" open={open} onClose={() => setOpen(false)} title={t('out.keys')} initialFocus={box} wide>
      {/* An application to NVDA: Escape closes the window at once instead of first switching to browse mode. */}
      <div role={APP_ROLE} aria-label={t('out.keys')}>
        <textarea ref={box} className="port-text" readOnly value={text} aria-label={t('out.keys')} />
      </div>
    </Sheet>
  );
}

registerView('out-keys', KeysSheet);

registerTool({
  id: 'out-keys',
  label: () => t('out.keys'),
  hash: 'keys',
  run: () => openSheet && openSheet(),
});
