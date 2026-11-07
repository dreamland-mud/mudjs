import React from 'react';
import $ from 'jquery';
import { t } from '../../i18n.js';
import { listTools, keyLabel } from '../../port/tools';
import { KeyCaps } from './MacrosPage.jsx';

// Tools: the client's own windows and actions, the one home for them
// (Settings, Accessibility). Alt+Shift+T and #tools open Settings here. One
// row per tool, as on the Macros page: its name, its keys, and Open. A
// tool's window opens once Settings has closed.
export default function ToolsPage({ lang }) {
  const tools = listTools();
  const label = t('tools.menu', lang);
  return (
    <div className="ab trig">
      <div className="cfg-row-desc ab-intro">{t('tools.intro', lang)}</div>
      <ol className="ab-list" role="list" aria-label={label}>
        {tools.map(tool => {
          const keys = tool.keys || [];
          return (
            <li key={tool.id} className="ab-item">
              <span className="ab-name">
                <span>{tool.label()}</span>
                {keys.length ? (
                  <span className="ab-keys">
                    {keys.map(k => (
                      <KeyCaps key={k} value={k} />
                    ))}
                  </span>
                ) : null}
              </span>
              <button
                type="button"
                className="cfg-button"
                aria-label={t('tools.open', lang) + ': ' + tool.label()}
                aria-keyshortcuts={keys.length ? keyLabel(keys) : undefined}
                onClick={() => {
                  $(document).trigger('settings:close');
                  setTimeout(() => tool.run(''), 200);
                }}
              >
                {t('tools.open', lang)}
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
