/* Ctrl+L: the clickable commands of the last 300 lines, newest first, as a
 * searchable list. Enter runs one; an item name opens its actions as a list
 * of their own, with a button back to all commands. */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import Sheet from '../Sheet';
import FindView from '../FindView';
import { registerTool } from '../tools';
import { registerView } from '../views';
import { t } from '../../i18n';
import { recentLines } from './ring';
import { activate, runMenuItem } from './activate';
import { say, tf, AFTER_SHEET_MS } from './speak';

export const LINK_LINES = 300;

/* Every link of the recent lines, newest first: [{ link, line }]. */
export function recentLinks() {
  const out = [];
  recentLines(LINK_LINES).forEach(line => {
    for (let i = line.links.length - 1; i >= 0; i--) out.push({ link: line.links[i], line: line.text.trim() });
  });
  return out;
}

function title(link) {
  if (link.kind === 'menu') return link.label + ', ' + t('out.links.menu');
  if (link.kind === 'url') return link.label;
  return link.action && link.action !== link.label ? link.action : link.label;
}

let openSheet = null;

function LinksSheet() {
  const [open, setOpen] = useState(false);
  const [found, setFound] = useState([]);
  const [sub, setSub] = useState(null); // the item whose actions are shown
  const search = useRef(null);

  useEffect(() => {
    openSheet = list => {
      setFound(list);
      setSub(null);
      setOpen(true);
    };
    return () => {
      openSheet = null;
    };
  }, []);

  // Into the search box again when the list changes between all and one item's.
  useEffect(() => {
    if (open) setTimeout(() => search.current && search.current.focus(), 0);
  }, [sub, open]);

  const rows = useMemo(() => {
    if (sub)
      return sub.link.menu.map((m, i) => ({ key: 'm' + i, label: m.label, words: m.label + ' ' + m.action, item: m }));
    return found.map((f, i) => {
      const head = title(f.link);
      return {
        key: 'l' + i,
        label: f.line && f.line !== head ? head + ' - ' + f.line : head,
        words: [head, f.link.label, f.line].join(' '),
        found: f,
      };
    });
  }, [found, sub]);

  const close = () => setOpen(false);

  const onActivate = row => {
    if (row.item) {
      setOpen(false);
      return setTimeout(() => runMenuItem(row.item), AFTER_SHEET_MS);
    }
    const link = row.found.link;
    if (link.kind === 'menu') {
      if (link.menu.length) setSub(row.found);
      else say(t('out.links.empty'));
      return;
    }
    setOpen(false);
    setTimeout(() => activate(link, AFTER_SHEET_MS), 50);
  };

  return (
    <Sheet
      id="out-links"
      open={open}
      onClose={close}
      title={sub ? tf('out.links.actions', sub.link.label) : t('out.links')}
      initialFocus={search}
      wide
    >
      {sub ? (
        <div className="port-actions">
          <button type="button" className="port-btn" onClick={() => setSub(null)}>
            {t('out.links.back')}
          </button>
        </div>
      ) : null}
      <FindView
        key={sub ? 'sub' : 'all'}
        rows={rows}
        searchLabel={sub ? tf('out.links.actions', sub.link.label) : t('out.links.label')}
        searchRef={search}
        onActivate={onActivate}
      />
    </Sheet>
  );
}

registerView('out-links', LinksSheet);

registerTool({
  id: 'out-links',
  label: () => t('out.links'),
  keys: ['ctrl+l'],
  hash: 'links',
  run: () => {
    const list = recentLinks();
    if (!list.length) return say(t('out.links.empty'));
    if (openSheet) openSheet(list);
  },
});
