/* The areas of the world from maps-index.json, and their help articles.
 * Plain functions over the data, no window or game state. Ported from the
 * desktop client's areamap.py (fetch_areas, split_route, split_parts). */

const COLOUR = /\{./g;
const ROUTE = /^[0-9neswud]+$/i;
// A route at the start, then a comma, or a word like "or" or "and" (any language).
// No \b: in JavaScript it only knows Latin letters.
const ROUTE_HEAD = /^([0-9neswud]+)(?:$|\s*[,;]|\s+(?:or|and|или|або|и|і|та|й)(?![\p{L}\p{N}_]))/iu;
// "Jungle: 21e5sd, Flying: 3w4sd": labelled routes, one row each.
const PARTS = /(?:^|,\s*)([^,:]{1,30}?):\s*([0-9neswud]+)(?=\s*(?:,|$))/gi;

export const DANGER = ['safe', 'easy', 'hard', 'deadly'];

export const clean = v => String(v == null ? '' : v).replace(COLOUR, '').trim();

export function areaKey(file) {
  return String(file || '')
    .replace(/\.are$/, '')
    .toLowerCase();
}

export function routeSteps(route) {
  let n = 0;
  String(route || '').replace(/(\d*)([neswud])/gi, (m, k) => {
    n += k ? parseInt(k, 10) : 1;
    return m;
  });
  return n;
}

/* "3n2e, then the portal" -> ['3n2e', 'then the portal']; no route -> [null, text]. */
export function splitRoute(text) {
  text = String(text || '').trim();
  if (ROUTE.test(text)) return [text, ''];
  const m = ROUTE_HEAD.exec(text);
  if (m) return [m[1], text.slice(m[1].length).replace(/^[\s,;]+|[\s,;]+$/g, '')];
  return [null, text];
}

/* Labelled routes: [[label, route, note]], the note (text after the last one)
 * on the last part only. Fewer than two labels: none. */
export function splitParts(text) {
  text = String(text || '');
  const found = Array.from(text.matchAll(PARTS));
  if (found.length < 2) return [];
  const last = found[found.length - 1];
  const tail = text
    .slice(last.index + last[0].length)
    .replace(/^[\s,;]+|[\s,;]+$/g, '');
  return found.map(m => [m[1].trim(), m[2], m === last ? tail : '']);
}

const SUFFIX = { en: 'En', ua: 'Ua', ru: '' };

/* The rows of the area list in one language: hidden and system areas dropped,
 * an area with labelled routes split into one row per entrance. */
export function parseAreas(data, lang) {
  const suffix = SUFFIX[lang] || '';
  const out = [];
  (Array.isArray(data) ? data : []).forEach(e => {
    if (!e || typeof e !== 'object' || !e.file) return;
    const flags = new Set(e.flags || []);
    if (flags.has('hidden') || flags.has('system')) return;
    const en = clean(e.nameEn);
    const ru = clean(e.name);
    const ua = clean(e.nameUa);
    const sw = clean(e.speedwalk);
    const local = clean(e['speedwalk' + suffix]) || sw;
    const base = {
      file: areaKey(e.file),
      en,
      ru,
      ua,
      names: [en, ru, ua].filter(Boolean),
      min: parseInt(e.levelLow, 10) || 0,
      max: parseInt(e.levelHigh, 10) || 0,
      danger: DANGER.find(d => flags.has(d)) || '',
    };
    const name = clean(e['name' + suffix]) || en || ru;
    const parts = splitParts(sw);
    if (parts.length) {
      const localParts = splitParts(local);
      parts.forEach(([label, route, note], i) => {
        const lp = localParts[i];
        out.push({
          ...base,
          key: base.file + '#' + i,
          name: name + ', ' + (lp ? lp[0] : label),
          route,
          steps: routeSteps(route),
          note: lp ? lp[2] : note,
        });
      });
      return;
    }
    const [route] = splitRoute(sw);
    out.push({
      ...base,
      key: base.file,
      name,
      route,
      steps: route ? routeSteps(route) : null,
      // With a route: the words after it. Without: the whole text is the way.
      note: route ? splitRoute(local)[1] : local,
    });
  });
  out.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
  return out;
}

const lower = s =>
  String(s || '')
    .replace(/^['"]+|['"]+$/g, '')
    .trim()
    .toLowerCase();

/* name (any language, lower case) -> help article id, from the help index
 * entries labelled "area": their titles in every language and their keywords. */
export function areaHelpMap(index) {
  const map = new Map();
  const add = (e, names) =>
    names.forEach(n => {
      const k = lower(n);
      if (k && !map.has(k)) map.set(k, e.id);
    });
  const areas = (index || []).filter(e => (e.labels || []).includes('area'));
  // Titles first: a keyword of one article must not take another area's name.
  areas.forEach(e => {
    const toc = e.toc || {};
    const title = e.title || {};
    add(e, [toc.ru, toc.en, toc.ua, title.ru, title.en, title.ua]);
  });
  areas.forEach(e => add(e, e.kwList || []));
  return map;
}

export function helpFor(map, names) {
  for (const n of names || []) {
    const id = map.get(lower(n));
    if (id != null) return id;
  }
  return null;
}

/* name (any language, lower case) -> the first area row with that name. */
export function areaByName(areas) {
  const map = new Map();
  areas.forEach(a =>
    a.names.forEach(n => {
      const k = n.toLowerCase();
      if (!map.has(k)) map.set(k, a);
    })
  );
  return map;
}
