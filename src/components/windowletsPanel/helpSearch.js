// Help search over the website's help dump (/data/help-*.json, same origin).
//
// The ranking and excerpt logic mirrors dreamland_web static/site/js/help.js
// (the dreamland.rocks/help search box) so both searches return the same hits
// with the same excerpts -- keep the two in step.

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

const tr = (obj, lang) => (obj && (obj[normLang(lang)] || obj.ru)) || '';

export function label(a, lang) {
  return tr(a.toc, lang) || tr(a.title, lang) || (a.kwList && a.kwList[0]) || '#' + a.id;
}

/* The article's kind, from the facet labels the engine ships. Spell before
   skill, or every spell reads as a skill. */
const KINDS = [
  { label: 'spell', en: 'spell', ua: 'закляття', ru: 'заклинание' },
  { label: 'social', en: 'social', ua: 'соціал', ru: 'социал' },
  { label: 'race', en: 'race', ua: 'раса', ru: 'раса' },
  { label: 'raceaptitude', en: 'race', ua: 'раса', ru: 'раса' },
  { label: 'religion', en: 'religion', ua: 'релігія', ru: 'религия' },
  { label: 'class', en: 'class', ua: 'клас', ru: 'класс' },
  { label: 'skillgroup', en: 'group', ua: 'група', ru: 'группа' },
  { label: 'craftskill', en: 'craft', ua: 'ремесло', ru: 'ремесло' },
  { label: 'craft', en: 'craft', ua: 'ремесло', ru: 'ремесло' },
  { label: 'item', en: 'behavior', ua: 'поведінка', ru: 'поведение' },
  { label: 'clanskill', en: 'skill', ua: 'вміння', ru: 'умение' },
  { label: 'cardskill', en: 'skill', ua: 'вміння', ru: 'умение' },
  { label: 'language', en: 'language', ua: 'мова', ru: 'язык' },
  { label: 'skill', en: 'skill', ua: 'вміння', ru: 'умение' },
  { label: 'area', en: 'zone', ua: 'зона', ru: 'зона' },
  { label: 'cmd', en: 'command', ua: 'команда', ru: 'команда' },
];

export function kind(a, lang) {
  const labels = (a && a.labels) || [];
  const k = KINDS.find(k => labels.includes(k.label));
  return k ? k[normLang(lang)] : null;
}

// ---- excerpts ------------------------------------------------------------

const squash = s => s.replace(/\s+/g, ' ').trim();

// usage lines ("Format: c fireball", plus indented continuations) are noise in an excerpt
const USAGE_RE = /(^|\n)[ \t]*(Format|Syntax|Формат|Синтаксис)[ \t]*:[^\n]*(\n[ \t]+\S[^\n]*)*/g;

const plainText = markup =>
  String(markup || '')
    .replace(/<[^>]*>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');

/* Skill and spell articles open with the same boilerplate ("Skill 'x' or
   'y'.", then indented stats and a Format: line), so a hit-less excerpt
   skips to the first paragraph of real prose. */
const HEADER_RE = /'[^'\n]+' (or|или|або) '/;
function leadParagraph(text) {
  // stats and tables are indented by two or more; some prose starts with one space
  const paras = text
    .split(/\n\s*\n/)
    .map(para => squash(para.split('\n').filter(ln => ln.trim() && !/^\s{2,}/.test(ln) && !/^\s*[*\-=]/.test(ln)).join(' ')))
    .filter(p => p && !HEADER_RE.test(p));
  // a real paragraph first; failing that, any short line of prose
  return paras.find(p => p.length >= 40) || paras[0] || ''; // '' = header-only article
}

/* First hit of q at or after `from`, preferring one at the start of a word:
   "sword" should mark the sword, not pas[sword]. */
const WORD_CH = /[\p{L}\p{N}]/u;
function findHit(low, q, from) {
  const first = low.indexOf(q, from);
  for (let at = first; at >= 0; at = low.indexOf(q, at + 1))
    if (at === 0 || !WORD_CH.test(low.charAt(at - 1))) return { at, word: true };
  return { at: first, word: false };
}

/* Stripped body per article: flat (one line), low (flat, lowercased, what the
   query matches against), lead (first prose paragraph) and leadAt (where the
   prose starts -- hits in the boilerplate above it lose). */
export function makeTextCache(bodies) {
  const cache = {};
  return id => {
    if (cache[id] === undefined) {
      const o = bodies.overlay[id];
      const raw = plainText(o != null && o !== '' ? o : bodies.ru[id] || '').replace(USAGE_RE, '$1');
      // bullets and ruler lines read as noise once the lines are joined
      const flat = squash(raw.replace(/(^|\n)[ \t]*\*[ \t]+/g, '$1· ').replace(/[-=]{4,}/g, ' '));
      const lead = leadParagraph(raw) || flat;
      cache[id] = {
        flat,
        low: flat.toLowerCase(),
        lead,
        leadAt: Math.max(0, flat.indexOf(lead.slice(0, 40))),
      };
    }
    return cache[id];
  };
}

const EXCERPT = 160;

/* Returns [before, match, after] -- match is '' when the query only hit a
   keyword and the excerpt is just the article's lead. */
export function excerpt(txt, q) {
  const flat = txt.flat;
  const at = findHit(txt.low, q, txt.leadAt).at;
  if (at < 0) {
    const lead = txt.lead;
    return [lead.length > EXCERPT ? lead.slice(0, EXCERPT).replace(/\s\S*$/, '') + '...' : lead, '', ''];
  }
  let from = Math.max(txt.leadAt, at - 50);
  const cut = from > txt.leadAt;
  if (cut) {
    // start on a word
    const sp0 = flat.indexOf(' ', from);
    if (sp0 >= 0 && sp0 < at) from = sp0 + 1;
  }
  let to = Math.min(flat.length, from + EXCERPT);
  if (to < flat.length) {
    const sp = flat.lastIndexOf(' ', to);
    if (sp > at + q.length) to = sp;
  }
  return [
    (cut ? '...' : '') + flat.slice(from, at).replace(/^[·\s]+/, ''),
    flat.slice(at, at + q.length),
    flat.slice(at + q.length, to) + (to < flat.length ? '...' : ''),
  ];
}

// ---- ranking -------------------------------------------------------------

export const normQuery = q => squash(q).toLowerCase();

/* Exact keyword, then title substring or keyword prefix, then article text
   (word-start hits before mid-word ones)
   -- 3+ characters, prose only. textFor is null until the bodies are in. */
export function search(index, q, lang, textFor, limit = 24) {
  if (!q) return [];
  const exact = [];
  const partial = [];
  const inWord = [];
  const inPart = [];
  for (let i = 0; i < index.length && exact.length + partial.length < limit; i++) {
    const a = index[i];
    const kws = (a.kwList || []).map(k => k.toLowerCase());
    const title = label(a, lang).toLowerCase();
    if (kws.includes(q)) exact.push(a);
    else if (title.includes(q) || kws.some(k => k.startsWith(q))) partial.push(a);
    else if (textFor && inWord.length < limit && q.length >= 3) {
      const txt = textFor(a.id);
      const hit = findHit(txt.low, q, txt.leadAt);
      if (hit.at >= 0) (hit.word ? inWord : inPart).push(a);
    }
  }
  return exact.concat(partial, inWord, inPart).slice(0, limit);
}
