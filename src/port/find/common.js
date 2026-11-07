/* Shared bits of the find windows: filled-in strings, opening a window from
 * its tool, and acting once the window has closed. */
import { useCallback, useEffect, useState } from 'react';
import $ from 'jquery';
import { t } from '../../i18n';

/* t(key) with each %s or %d filled in turn (shared with every tool and the
 * guide). */
import { tf } from '../speak';
export const tr = tf;

/* The highest level a player or an item can have. */
export const MAX_LEVEL = 110;

/* A database word (sword, torso, potion) in the user's language, or as is. */
export function word(prefix, value) {
  if (!value) return '';
  const key = prefix + String(value).replace(/ /g, '_');
  const text = t(key);
  return text === key ? String(value) : text;
}

const OPEN = 'port-find:open';

export function openFind(id, arg) {
  $(document).trigger(OPEN, [id, arg || '']);
}

/* The window's open state. gen changes on every open, so the list inside can
 * start fresh with the typed argument as its search. */
export function useOpener(id) {
  const [state, setState] = useState({ open: false, arg: '', gen: 0 });
  useEffect(() => {
    const onOpen = (e, which, arg) => {
      if (which === id) setState(s => ({ open: true, arg: arg || '', gen: s.gen + 1 }));
    };
    $(document).on(OPEN, onOpen);
    return () => $(document).off(OPEN, onOpen);
  }, [id]);
  const close = useCallback(() => setState(s => ({ ...s, open: false })), []);
  return { ...state, close };
}

/* After the window has closed and given the focus back. */
export function later(fn) {
  setTimeout(fn, 50);
}
