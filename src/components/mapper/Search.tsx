import { useEffect, useMemo, useState } from 'react';
import Fuse from 'fuse.js';
import type { AreaLayout } from './types.js';
import { t, nameFor, type Locale } from './i18n.js';

interface Props {
  layout: AreaLayout;
  /** Active display locale — search matches + result labels use the localized room name. */
  locale: Locale;
  onPick: (vnum: number) => void;
}

export function Search({ layout, locale, onPick }: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const fuse = useMemo(() => {
    const items = Object.values(layout.rooms).map((r) => ({
      vnum: r.vnum,
      name: nameFor(r, locale),
    }));
    return new Fuse(items, {
      keys: ['name'],
      threshold: 0.3,
      minMatchCharLength: 2,
      ignoreLocation: true,
    });
  }, [layout, locale]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    // Substring-first: an exact case-insensitive contains is what players expect
    // ("спа" -> "Небольшая Спальня"), ranked by match position then shorter name.
    // Plain fuzzy (Fuse) wrongly surfaced unrelated rooms like "Край Леса" for "спа".
    // Names resolve through nameFor() so search follows the player's config language.
    const subs = Object.values(layout.rooms)
      .map((r) => ({ vnum: r.vnum, name: nameFor(r, locale) }))
      .filter((r) => r.name.toLowerCase().includes(q))
      .sort((a, b) => {
        const ia = a.name.toLowerCase().indexOf(q);
        const ib = b.name.toLowerCase().indexOf(q);
        return ia - ib || a.name.length - b.name.length;
      })
      .map((r) => ({ item: { vnum: r.vnum, name: r.name } }));
    if (subs.length > 0) return subs.slice(0, 8);
    // Fall back to fuzzy only when nothing contains the query (typo tolerance).
    return fuse.search(query).slice(0, 8);
  }, [query, fuse, layout, locale]);

  useEffect(() => { setOpen(query.length >= 2 && results.length > 0); }, [query, results]);

  return (
    <div className="search">
      <div className="search-input-wrap">
        <span className="fa fa-search dl-mapper-search-icon" aria-hidden="true" />
        <input
          type="search"
          className="search-input"
          placeholder={t.searchRooms}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(query.length >= 2)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          aria-label={t.searchAria}
        />
      </div>
      {open && (
        <ul role="listbox" aria-label={t.resultsAria} className="search-results">
          {results.map((r) => (
            <li key={r.item.vnum}>
              <button
                className="search-result"
                onClick={() => { onPick(r.item.vnum); setQuery(''); setOpen(false); }}
              >
                <span className="search-result-name">{r.item.name || t.unnamed}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
