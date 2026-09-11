import { t } from '../../i18n.js';
import { SUPPORT } from './useConfig.js';

// Turning what the server sent into what the dialog draws: a tree of sections
// and pages, and the rows of one page.
//
// The client adds a section of its own for what is not the server's business --
// the player's script -- and, when the server cannot hand out settings at all,
// a single page that says so. Either way the tree has the same shape, so the
// dialog never has a special case for a missing server.

export const SCRIPT_PAGE = 'script';
export const MISSING_PAGE = 'server-unavailable';
export const OFFLINE_PAGE = 'server-offline';
export const ASKING_PAGE = 'server-asking';

function scriptSection(lang) {
  return {
    key: 'ext',
    label: t('cfg.section.ext', lang),
    pages: [
      {
        key: SCRIPT_PAGE,
        kind: 'script',
        label: t('cfg.page.script', lang),
        // No line of explanation under the heading: the editor wants every
        // pixel, and the footer already says when the script takes effect.
        options: [],
      },
    ],
  };
}

/** The stand-in for the game's own settings: nobody is in the world yet, the
 *  question is still on its way, or this server cannot answer it at all. Same
 *  shape as a real section, so the dialog never learns about the difference. */
function standInSection(support, lang) {
  const page =
    support === SUPPORT.MISSING
      ? { key: MISSING_PAGE, label: 'cfg.missing.page', text: 'cfg.missing.text' }
      : support === SUPPORT.UNKNOWN
        ? { key: ASKING_PAGE, label: 'cfg.asking.page', text: 'cfg.asking' }
        : { key: OFFLINE_PAGE, label: 'cfg.offline.page', text: 'cfg.offline.text' };

  return {
    key: 'server',
    label: t('cfg.missing.title', lang),
    pages: [
      {
        key: page.key,
        kind: 'missing',
        label: t(page.label, lang),
        subtitle: t(page.text, lang),
        options: [],
      },
    ],
  };
}

/** The whole tree: what the server offers, then what the client adds. */
export function buildTree(schema, support, lang) {
  const sections = (schema && schema.sections ? schema.sections : []).map(
    section => ({
      key: section.key,
      label: section.label,
      pages: (section.pages || []).map(page => ({
        key: page.key,
        label: page.label,
        search: page.search,
        subtitle: page.subtitle,
        options: page.options || [],
      })),
    })
  );

  // An answer with nothing in it is an answer: the server has no settings to
  // show, which is not the same as not being in the game yet.
  if (!sections.length) {
    const state = support === SUPPORT.READY ? SUPPORT.MISSING : support;
    sections.push(standInSection(state, lang));
  }

  sections.push(scriptSection(lang));
  return sections;
}

/** Does this option answer the search? Its names in all three languages (the
 *  server sends them together for exactly this) and its one-line hint in the
 *  language on screen -- a player who knows the setting as 'кратко' finds it
 *  with an English interface, and the other way round. */
export function matches(option, query) {
  if (!query) return true;

  const parts = [option.search || option.key, option.label, option.hint];

  return parts.some(one => String(one || '').toLowerCase().indexOf(query) > -1);
}

/** Does the page's own name answer the search? Its name in any language, again
 *  regardless of which one the dialog is speaking. */
function named(page, query) {
  const words = page.search || page.label || '';
  return String(words).toLowerCase().indexOf(query) > -1;
}

/** The tree with everything that does not answer the search taken out. */
export function filterTree(sections, query) {
  if (!query) return sections;

  return sections
    .map(section => ({
      ...section,
      pages: section.pages
        // A page whose own name answers the search keeps everything on it: the
        // player asked for the page, not for a setting inside it. That is also
        // how a page with no settings of its own -- the script, the stand-in
        // for a server that has none -- is found at all.
        .map(page =>
          named(page, query)
            ? page
            : { ...page, options: page.options.filter(o => matches(o, query)) }
        )
        .filter(page => page.options.length || named(page, query)),
    }))
    .filter(section => section.pages.length);
}

export function findPage(sections, key) {
  for (const section of sections) {
    for (const page of section.pages) {
      if (page.key === key) return page;
    }
  }
  return null;
}

export function firstPage(sections) {
  for (const section of sections) {
    if (section.pages.length) return section.pages[0];
  }
  return null;
}

/** The command that would have made the same change at the keyboard. */
export function spell(schema, option, valueLabel) {
  const command = (schema && schema.command) || 'config';
  return command + ' ' + option.label + ' ' + valueLabel;
}
