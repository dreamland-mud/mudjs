import React from 'react';
import OptionRow from './OptionRow.jsx';

// One page of the dialog: a heading, a line saying what the page is about, and
// the settings themselves. The heading is shared with the script page, which is
// why it takes children.
export default function SettingsPage({ page, values, lang, query, onChange, children }) {
  if (!page) return null;

  return (
    <div className={page.kind === 'script' ? 'cfg-page cfg-page-script' : 'cfg-page'}>
      <div className="cfg-page-head">
        <div className="cfg-page-title">{page.label}</div>
        {page.subtitle ? (
          <div className="cfg-page-subtitle">{page.subtitle}</div>
        ) : null}
      </div>

      {children}

      {(page.options || []).map(option => (
        <OptionRow
          key={option.key}
          option={option}
          value={values[option.key]}
          lang={lang}
          query={query}
          onChange={onChange}
        />
      ))}
    </div>
  );
}
