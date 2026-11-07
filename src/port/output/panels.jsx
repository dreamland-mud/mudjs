/* The status panels read aloud: Alt+1 effects, Alt+2 quests, Alt+3 group,
 * Alt+4 stats, Alt+5 time and weather, Alt+6 location, Alt+7 online. Alt+8
 * lists the fight commands of the prompt to send one, Ctrl+I shows every
 * panel as text, Alt+S reads health, mana and moves. */
import { APP_ROLE } from '../../review';
import React, { useEffect, useRef, useState } from 'react';
import Sheet from '../Sheet';
import { keyName, registerTool } from '../tools';
import { registerView } from '../views';
import { prompt, lang, command } from '../game';
import { t } from '../../i18n';
import { PANELS, everything, fightCommands, statusLine } from './status';
import { say } from './speak';

let openText = null;
let openFight = null;

/* A text to read in a sheet: a read-only text box, read line by line in the
 * screen reader's focus mode, as in the desktop client's text window. */
function TextSheet() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const box = useRef(null);
  useEffect(() => {
    openText = value => {
      setText(value);
      setOpen(true);
    };
    return () => {
      openText = null;
    };
  }, []);
  return (
    <Sheet id="out-panels" open={open} onClose={() => setOpen(false)} title={t('out.panels')} initialFocus={box} wide>
      {/* An application to NVDA: Escape closes the window at once instead of first switching to browse mode. */}
      <div role={APP_ROLE} aria-label={t('out.panels')}>
        <textarea ref={box} className="port-text" readOnly value={text} aria-label={t('out.panels')} />
      </div>
    </Sheet>
  );
}

function FightSheet() {
  const [open, setOpen] = useState(false);
  const [cmds, setCmds] = useState([]);
  const first = useRef(null);
  useEffect(() => {
    openFight = list => {
      setCmds(list);
      setOpen(true);
    };
    return () => {
      openFight = null;
    };
  }, []);
  return (
    <Sheet id="out-fight" open={open} onClose={() => setOpen(false)} title={t('out.fight')} initialFocus={first}>
      <div className="port-menu">
        {cmds.map((cmd, i) => (
          <button
            key={cmd + i}
            ref={i === 0 ? first : undefined}
            type="button"
            className="port-btn"
            onClick={() => {
              setOpen(false);
              setTimeout(() => command(cmd), 50);
            }}
          >
            {cmd}
          </button>
        ))}
      </div>
    </Sheet>
  );
}

registerView('out-panels', TextSheet);
registerView('out-fight', FightSheet);

/* Which panel a key reads: its place among the tool's keys, so a key changed
 * on the System actions page reads the panel of the key it replaced. With
 * fewer keys than panels, the later panels are reached by #panel N. */
function panelOf(e, tool) {
  const i = tool && e ? tool.keys.indexOf(keyName(e)) : -1;
  return i >= 0 && i < PANELS.length ? i + 1 : 0;
}

export function readPanel(n) {
  const entry = PANELS[n - 1];
  if (entry) say(entry[1](prompt(), lang()));
}

const panelTool = {
  id: 'out-panel',
  label: () => t('out.panel'),
  keys: PANELS.map((_, i) => 'alt+' + (i + 1)),
  hash: 'panel',
  menu: false,
  run: (arg, e) => readPanel(arg ? parseInt(arg) : panelOf(e, panelTool)),
};
registerTool(panelTool);

registerTool({
  id: 'out-fight',
  label: () => t('out.fight'),
  keys: ['alt+8'],
  hash: 'fight',
  run: () => {
    const cmds = fightCommands(prompt());
    if (!cmds.length) return say(t('out.fight.none'));
    if (openFight) openFight(cmds);
  },
});

registerTool({
  id: 'out-panels',
  menu: false, // spoken only, or Settings itself: not on the Tools page
  label: () => t('out.panels'),
  keys: ['ctrl+i'],
  hash: 'panels',
  run: () => openText && openText(everything(prompt(), lang())),
});

registerTool({
  id: 'out-status',
  menu: false, // spoken only, or Settings itself: not on the Tools page
  label: () => t('out.status'),
  keys: ['alt+s'],
  hash: 'status',
  run: () => say(statusLine(prompt())),
});

