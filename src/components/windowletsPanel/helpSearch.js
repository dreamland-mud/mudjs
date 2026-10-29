// Help search over the website's help dump (/data/help-*.json, same origin).
//
// Ranking, facet words, kinds and excerpts come from helpSearchCore.js, a
// verbatim copy of dreamland_web static/site/js/helpsearch.js (shared with the
// dreamland.rocks/help search box and the MCP server). Edit it there and copy
// it here; `dl_tool help-search-sync` flags a drifted copy.

import './helpSearchCore.js';

const S = globalThis.DLHelpSearch;

const LANGS = ['ru', 'en', 'ua'];
const normLang = lang => (LANGS.includes(lang) ? lang : 'en');

/* Fetch a data file, preferring the gzipped copy: nginx serves these JSONs
   uncompressed, ~0.5 MB for the index and ~2.5 MB per body file. Anything
   without DecompressionStream, or a missing .gz, falls back to the plain file. */
function fetchData(name) {
  const plain = () =>
    fetch('/data/' + name).then(r => {
      if (!r.ok) throw new Error(name);
      return r.json();
    });
  if (typeof DecompressionStream !== 'function') return plain();

  return fetch('/data/' + name + '.gz')
    .then(r => {
      if (!r.ok || !r.body) throw new Error('no gz');
      return new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).json();
    })
    .catch(plain);
}

let indexPromise = null;
export function loadIndex() {
  if (!indexPromise)
    indexPromise = fetchData('help-index.json').catch(e => {
      indexPromise = null; // let the next focus retry
      throw e;
    });
  return indexPromise;
}

// Russian bodies are the base; EN/UA files overlay them and may be sparse.
// A failed fetch drops its cached promise so the next focus tries again.
const bodyFiles = {};
function loadBodyFile(lang) {
  if (!bodyFiles[lang])
    bodyFiles[lang] = fetchData('help-body-' + lang + '.json').catch(e => {
      delete bodyFiles[lang];
      throw e;
    });
  return bodyFiles[lang];
}

// One object per language, so a repeat call hands back the same reference and
// the text cache built over it survives.
const bodySets = {};
export function loadBodies(lang) {
  lang = normLang(lang);
  if (!bodySets[lang]) {
    const files = [loadBodyFile('ru')];
    if (lang !== 'ru') files.push(loadBodyFile(lang));
    bodySets[lang] = Promise.all(files)
      .then(([ru, overlay]) => ({ lang, ru, overlay: overlay || {} }))
      .catch(e => {
        delete bodySets[lang];
        throw e;
      });
  }
  return bodySets[lang];
}

export const label = (a, lang) => S.label(a, normLang(lang));

// the article's kind in the reader's language, or null
export function kind(a, lang) {
  const k = S.kind(a);
  return k ? k[normLang(lang)] : null;
}

// bodies from loadBodies; the overlay wins where it has text
export const makeTextCache = bodies =>
  S.textCache(id => {
    const o = bodies.overlay[id];
    return o != null && o !== '' ? o : bodies.ru[id] || '';
  });

/* Returns [before, match, after] -- match is '' when the query only hit a
   keyword and the excerpt is just the article's lead. */
export const excerpt = S.excerpt;

export const normQuery = S.normQuery;

// q from normQuery; returns { q, test } with the facet word cut off
export const parseQuery = S.parseQuery;

/* Exact keyword, then title substring or keyword prefix, then article text.
   textFor is null until the bodies are in; test, when given, keeps only the
   articles it accepts. */
export const search = (index, q, lang, textFor, limit = 24, test = null) =>
  S.search(index, q, normLang(lang), textFor, limit, test);

/* What `help` suggests in game when nothing matched: up to five
   { article, hint } for the full query (facet word included); hint is ''
   when the title already says it. A port of plug-ins/comm/help.cpp FuzzySearch. */
export const fuzzy = (index, full, lang) =>
  S.fuzzy(index, full, normLang(lang)).map(h => ({ article: h.article, hint: S.fuzzyHint(h, normLang(lang)) }));
