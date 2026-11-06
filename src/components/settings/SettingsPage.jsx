import React from 'react';
import OptionRow from './OptionRow.jsx';
import { t } from '../../i18n.js';

// One page of the dialog: the settings themselves, plus optional content the
// dialog hands in -- children (the account/script bodies) before the rows, a
// tail (the Download log on the terminal page) after them.
//
// A real page opens straight on its first control: the page's name is already
// lit in the left menu, so a repeated title above the rows only pushed the UI
// down. The one heading left is the server stand-in's ("nobody is in the world
// yet"), whose whole message lives in that block.
export default function SettingsPage({
  page,
  values,
  lang,
  query,
  onChange,
  pending,
  refused,
  tail,
  children,
}) {
  if (!page) return null;

  // A refusal is drawn in place of the option's description, which a screen
  // reader does not notice change: this line says it out loud.
  const said = (page.options || [])
    .filter(option => (refused || {})[option.key])
    .map(option => {
      const why = refused[option.key];
      return option.label + ': ' + (typeof why === 'string' ? why : t('cfg.refused', lang));
    })
    .join('. ');

  return (
    <div className={page.kind === 'script' ? 'cfg-page cfg-page-script' : 'cfg-page'}>
      {page.kind === 'missing' ? (
        <div className="cfg-page-head">
          <div className="cfg-page-title">{page.label}</div>
          {page.subtitle ? (
            <div className="cfg-page-subtitle">{page.subtitle}</div>
          ) : null}
        </div>
      ) : null}

      {children}

      {(page.options || []).map(option => (
        <OptionRow
          key={option.key}
          option={option}
          value={values[option.key]}
          lang={lang}
          query={query}
          onChange={onChange}
          pending={!!(pending || {})[option.key]}
          refused={(refused || {})[option.key]}
        />
      ))}

      {tail}

      <div className="ab-sr" aria-live="polite">{said}</div>
    </div>
  );
}
