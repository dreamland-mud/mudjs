import React from 'react';
import OptionRow from './OptionRow.jsx';

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
    </div>
  );
}
