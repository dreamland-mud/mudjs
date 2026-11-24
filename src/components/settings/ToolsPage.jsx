import React, { useState } from 'react';
import $ from 'jquery';
import { t } from '../../i18n.js';
import { listTools, keyLabel, runTool } from '../../port/tools';
import { KeyCaps } from './MacrosPage.jsx';
import SwitchButton from './SwitchButton.jsx';

// Tools: the client's own windows and actions, the one home for them
// (Settings, Accessibility). Alt+Shift+T and #tools open Settings here. One
// row per tool, as on the Macros page: its name, its keys, and Open. A
// tool's window opens once Settings has closed.
//
// A switch tool (isOn) gets a switch and its state instead of Open, and flips
// right here, so a setting never changes unseen. What the tool said shows
// under its name for the eye; aria-hidden, as the tool already spoke it.
export default function ToolsPage({ lang }) {
  const tools = listTools();
  const label = t('tools.menu', lang);
  const [said, setSaid] = useState(null);
  return (
    <div className="ab trig">
      <div className="cfg-row-desc ab-intro">{t('tools.intro', lang)}</div>
      <ol className="ab-list" role="list" aria-label={label}>
        {tools.map(tool => {
          const keys = tool.keys || [];
          const shortcuts = keys.length ? keyLabel(keys) : undefined;
          const nameId = 'tools-' + tool.id;
          const on = tool.isOn ? tool.isOn() : null;
          return (
            <li key={tool.id} className="ab-item">
              <span className="ab-name">
                <span id={nameId}>{tool.label()}</span>
                {keys.length ? (
                  <span className="ab-keys">
                    {keys.map(k => (
                      <KeyCaps key={k} value={k} />
                    ))}
                  </span>
                ) : null}
                {said && said.id === tool.id ? (
                  <span className="cfg-row-desc" aria-hidden="true">
                    {said.text}
                  </span>
                ) : null}
              </span>
              {tool.isOn ? (
                <>
                  <span className="tools-state" aria-hidden="true">
                    {t(on ? 'tools.on' : 'tools.off', lang)}
                  </span>
                  <SwitchButton
                    on={on}
                    labelledBy={nameId}
                    aria-keyshortcuts={shortcuts}
                    onToggle={() => setSaid({ id: tool.id, text: runTool(tool.id, on ? 'off' : 'on') || '' })}
                  />
                </>
              ) : (
                <button
                  type="button"
                  className="cfg-button"
                  aria-label={t('tools.open', lang) + ': ' + tool.label()}
                  aria-keyshortcuts={shortcuts}
                  onClick={() => {
                    $(document).trigger('settings:close');
                    setTimeout(() => tool.run(''), 200);
                  }}
                >
                  {t('tools.open', lang)}
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
