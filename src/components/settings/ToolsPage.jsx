import React from 'react';
import $ from 'jquery';
import { t } from '../../i18n.js';
import { listTools, keyLabel } from '../../port/tools';

// Tools: the client's own windows and actions as buttons, the one home for
// them (Settings, Accessibility). Alt+Shift+T and #tools open Settings here.
// A tool's window opens once Settings has closed.
export default function ToolsPage({ lang }) {
  const tools = listTools();
  return (
    <div className="ab trig">
      <div className="cfg-row-desc ab-intro">{t('tools.intro', lang)}</div>
      {tools.map(tool => (
        <div key={tool.id} className="ab-item">
          <button
            type="button"
            className="cfg-button"
            aria-keyshortcuts={tool.keys && tool.keys.length ? keyLabel(tool.keys) : undefined}
            onClick={() => {
              $(document).trigger('settings:close');
              setTimeout(() => tool.run(''), 200);
            }}
          >
            {tool.label()}
            {tool.keys && tool.keys.length ? ' (' + keyLabel(tool.keys) + ')' : ''}
          </button>
        </div>
      ))}
    </div>
  );
}
