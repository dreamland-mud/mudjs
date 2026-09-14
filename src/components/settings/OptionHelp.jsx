import React, { useState } from 'react';
import { t } from '../../i18n.js';

// The question mark beside an option, and what it opens: the longer
// explanation and -- where the option changes how something looks -- a sample
// of the very output it changes, painted the way the terminal paints it.
//
// The badge belongs beside the name, the explanation belongs under the hint, so
// this is a hook rather than a component: it hands back the two pieces and the
// row puts each where it goes. An option the server sent no help for gets no
// badge at all, which is the normal state of a setting just added to the world.

// Colour markup from the server is "<c c='fgby'>text</c>", the same as in the
// terminal. Everything else is escaped: this is game text, not markup we wrote.
function paint(text) {
  const escaped = String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  return escaped
    .replace(/&lt;c c=['"]([a-z0-9_-]+)['"]&gt;/g, '<span class="$1">')
    .replace(/&lt;\/c&gt;/g, '</span>');
}

function pick(multi, lang) {
  if (!multi) return '';
  return multi[lang] || multi.en || multi.ru || '';
}

export default function useOptionHelp(option, lang) {
  const [open, setOpen] = useState(false);

  const help = pick(option.help, lang);
  const examples = option.examples || [];

  if (!help && !examples.length) return { badge: null, body: null };

  const badge = (
    <button
      type="button"
      className="cfg-help-badge"
      aria-label={t('cfg.help', lang)}
      aria-expanded={open}
      onClick={() => setOpen(was => !was)}
    >
      ?
    </button>
  );

  const body = open ? (
    <div className="cfg-help-body">
      {help ? <p className="cfg-help-text">{help}</p> : null}

      {examples.map((example, index) => (
        <div className="cfg-help-example" key={index}>
          <div className="cfg-help-example-label">
            {pick(example.label, lang)}
          </div>
          <div
            className="cfg-help-example-text"
            dangerouslySetInnerHTML={{ __html: paint(pick(example.text, lang)) }}
          />
        </div>
      ))}
    </div>
  ) : null;

  return { badge, body };
}

export { pick };
