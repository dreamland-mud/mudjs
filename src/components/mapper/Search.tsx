import { useEffect, useMemo, useState } from 'react';
import Fuse from 'fuse.js';
import type { AreaLayout } from './types.js';
import { t } from './i18n.js';

interface Props {
  layout: AreaLayout;
  onPick: (vnum: number) => void;
}

export function Search({ layout, onPick }: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const fuse = useMemo(() => {
    const items = Object.values(layout.rooms).map((r) => ({
      vnum: r.vnum,
      name: r.name,
    }));
    return new Fuse(items, {
      keys: ['name'],
      threshold: 0.4,
      minMatchCharLength: 2,
      ignoreLocation: true,
    });
  }, [layout]);

  const results = useMemo(() => {
    if (query.trim().length < 2) return [];
    return fuse.search(query).slice(0, 8);
  }, [query, fuse]);

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
