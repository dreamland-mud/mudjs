/* Game knowledge from the website's data: zone quests, class skill trees,
 * religions, races and the item database. A port of the desktop client's
 * sitedata.py.
 *
 * Items come from the item database JSON. Quests, skills, religions and races
 * exist only as help article text, read from the help bodies of the game's
 * language. Every article of one kind is written the same way, "* Label:
 * value" lines in all three languages, so the labels below are all the
 * parsing needs. The item and route helpers are shared with the item search
 * (../find). */
import { num, usableBy, ALIGN_CODES, STATS, statGain, overallScore, hasMinus } from '../find/itemdata';

export { num, usableBy, STATS, statGain, overallScore, hasMinus };

export const LABELS = {
  en: {
    levels: 'Levels', danger: 'Danger', route: 'How to get there', quests: 'Quests',
    qlevels: 'Levels', from: 'from', to: 'to', align: 'Alignment', often: 'How often',
    requires: 'First complete the quest', stats: 'Stats', classes: 'Classes',
    resist: 'Resistant', vuln: 'Vulnerable', size: 'Size', paths: 'Paths',
    patron: 'Patron of', gifts: 'Gifts', restrict: 'Restrictions', level: 'Level',
  },
  ua: {
    levels: 'Рівні', danger: 'Небезпека', route: 'Як дістатися', quests: 'Завдання',
    qlevels: 'Рівні', from: 'з', to: 'по', align: 'Натура', often: 'Як часто',
    requires: 'Спершу виконай завдання', stats: 'Параметри', classes: 'Класи',
    resist: 'Стійкий', vuln: 'Вразливий', size: 'Розмір', paths: 'Шляхи',
    patron: 'Підопічні', gifts: 'Дари', restrict: 'Обмеження', level: 'Рівень',
  },
  ru: {
    levels: 'Уровни', danger: 'Опасность', route: 'Как добраться', quests: 'Задания',
    qlevels: 'Уровни', from: 'с', to: 'по', align: 'Натура', often: 'Как часто',
    requires: 'Сначала выполни задание', stats: 'Параметры', classes: 'Классы',
    resist: 'Устойчивы', vuln: 'Уязвимы', size: 'Размер', paths: 'Пути',
    patron: 'Подопечные', gifts: 'Дары', restrict: 'Ограничения', level: 'Уровень',
  },
};

export const ALIGNS = ['', 'good', 'neutral', 'evil'];
export const HORSE_SLOTS = ['horse', 'hooves', 'feet hooves'];

const esc = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const HH = /<hh id='(\d+)'>/g;
const hhIds = raw => Array.from(String(raw || '').matchAll(HH), m => parseInt(m[1], 10));
const lower = s => String(s || '').toLowerCase();
const byName = (a, b) => (lower(a.name) < lower(b.name) ? -1 : lower(a.name) > lower(b.name) ? 1 : 0);

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

export function unescape(text) {
  return String(text || '').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    const v = ENTITIES[e.toLowerCase()];
    return v == null ? m : v;
  });
}

/* Game markup to plain text. */
export function strip(text) {
  return unescape(String(text || '').replace(/<[^>]+>/g, ''));
}

const lines = text => String(text || '').split(/\r?\n/);

/* The "* Label: value" lines of an article, by label; the first one wins. */
export function header(text) {
  const out = {};
  for (const line of lines(strip(text))) {
    const m = /^\s*\*\s*([^:]{2,40}):\s*(.+?)\s*$/.exec(line);
    if (m) {
      const key = m[1].trim();
      if (!(key in out)) out[key] = m[2].trim();
    }
  }
  return out;
}

// Stat names in the help's "+2 to str" lists, in the three languages, by word start.
export const STAT_STEMS = [
  ['str', ['str', 'сил']],
  ['int', ['int', 'инт', 'інт']],
  ['wis', ['wis', 'мудр']],
  ['dex', ['dex', 'ловк', 'сприт']],
  ['con', ['con', 'слож', 'стат']],
];

/* "+3 to str, -2 to int" -> {str: 3, int: -2}, in any of the three languages. */
export function parseStats(text) {
  const out = {};
  for (const m of String(text || '').matchAll(/([+-]\d+)\s+\S+\s+([\p{L}\p{N}_]+)/gu)) {
    const word = m[2].toLowerCase();
    for (const [key, stems] of STAT_STEMS) if (stems.some(s => word.startsWith(s))) out[key] = parseInt(m[1], 10);
  }
  return out;
}

/* Whether a quest's free-text alignment (any language) allows align. */
export function alignOk(text, align) {
  const t = lower(text);
  if (!t || !align) return true;
  if (!Object.values(ALIGN_CODES).some(codes => codes.slice(1).some(w => t.includes(w)))) return true;
  return (ALIGN_CODES[align] || []).slice(1).some(w => t.includes(w));
}


export class Site {
  /* bodies: {ru, overlay} from loadBodies(lang); the game's language file is
   * read, as the desktop does, and an article missing there is left out. */
  constructor(lang, index, bodies, weapons, armor) {
    this.lang = LABELS[lang] ? lang : 'en';
    this.L = LABELS[this.lang];
    this.index = Array.isArray(index) ? index : [];
    this.bodies = bodies || { ru: {}, overlay: {} };
    this.body = (this.lang === 'ru' ? this.bodies.ru : this.bodies.overlay) || {};
    this.weapons = Array.isArray(weapons) ? weapons : [];
    this.armor = Array.isArray(armor) ? armor : [];
    this.byId = new Map(this.index.map(e => [e.id, e]));
    this._zones = null;
    this._teachers = null;
    this._areaIds = null;
    this._quests = null;
    this._religions = null;
    this._races = null;
    this._skills = new Map();
  }

  ready() {
    return this.index.length > 0 && Object.keys(this.body).length > 0;
  }

  raw(id) {
    return this.body[String(id)];
  }

  title(entry) {
    const toc = entry.toc || {};
    return toc[this.lang] || toc.en || String(entry.id);
  }

  articles(label) {
    return this.index.filter(e => (e.labels || []).includes(label) && this.raw(e.id) != null);
  }

  // Zone quests ----------------------------------------------------------
  zoneQuests() {
    if (!this._quests) this._quests = this.parseZoneQuests();
    return this._quests.slice();
  }

  parseZoneQuests() {
    const L = this.L;
    const out = [];
    for (const e of this.articles('area')) {
      const raw = this.raw(e.id);
      const text = strip(raw);
      const head = header(raw);
      const zone = {
        zone: this.title(e),
        zoneId: e.id,
        levels: head[L.levels] || '',
        danger: head[L.danger] || '',
        route: (head[L.route] || '').replace(/\s*\(.*\)\s*$/, ''),
      };
      const m = new RegExp('^' + esc(L.quests) + ':[ \\t]*$', 'm').exec(text);
      if (!m) continue;
      const items = [];
      let cur = null;
      for (const line of lines(text.slice(m.index + m[0].length))) {
        const s = line.trim();
        if (!s) {
          if (cur !== null) {
            items.push(cur);
            cur = null;
          }
          continue;
        }
        if (s.startsWith('* ')) {
          if (cur !== null) items.push(cur);
          cur = s.slice(2);
        } else if (cur !== null) cur += ' ' + s;
      }
      if (cur !== null) items.push(cur);
      items.forEach((raw2, n) => out.push(Object.assign({ key: e.id + ':' + n }, zone, this.parseQuest(raw2))));
    }
    return out;
  }

  parseQuest(raw) {
    const L = this.L;
    const q = { text: raw, low: 0, high: 0, align: '', often: '', requires: '' };
    const m = new RegExp(
      '\\s' + esc(L.qlevels) + ':\\s*' + esc(L.from) + '\\s*(\\d+)(?:\\s*' + esc(L.to) + '\\s*(\\d+))?\\.?'
    ).exec(raw);
    if (m) {
      q.text = raw.slice(0, m.index).trim();
      q.low = parseInt(m[1], 10);
      q.high = m[2] ? parseInt(m[2], 10) : 0;
    }
    for (const [key, label] of [['align', L.align], ['often', L.often], ['requires', L.requires]]) {
      const m2 = new RegExp(esc(label) + ':\\s*(.+?)(?=\\.\\s+[A-ZА-ЯІЇЄҐ][^.]{1,40}:|$)').exec(raw);
      if (m2) q[key] = m2[1].trim().replace(/\.+$/, '');
    }
    return q;
  }

  // Class skill trees ----------------------------------------------------
  classNames() {
    const names = new Set();
    for (const e of this.index) {
      const en = (e.toc || {}).en || '';
      if (en.endsWith(' skills') && e.cat === 'classes') names.add(en.slice(0, -' skills'.length));
    }
    return Array.from(names).sort();
  }

  /* The class's own article, for its name in the reader's language. */
  classArticle(clsEn) {
    const want = lower(clsEn);
    return this.index.find(e => lower((e.toc || {}).en) === want && (e.labels || []).includes('class')) || null;
  }

  /* [{level, name, id}] for every skill of the class, with its help article id. */
  classSkillList(clsEn) {
    const k = lower(clsEn);
    if (!this._skills.has(k)) this._skills.set(k, this.parseClassSkills(clsEn));
    return this._skills.get(k);
  }

  parseClassSkills(clsEn) {
    const want = lower(clsEn) + ' skills';
    const e = this.index.find(x => lower((x.toc || {}).en) === want);
    if (!e || this.raw(e.id) == null) return [];
    const re = new RegExp('^\\s*' + esc(this.L.level) + '\\s+(\\d+):\\s*(.+)$');
    const out = [];
    for (const raw of this.raw(e.id).split('\n')) {
      const m = re.exec(strip(raw));
      if (!m) continue;
      const names = m[2].split(',').map(x => x.trim()).filter(Boolean);
      const ids = hhIds(raw);
      names.forEach((name, i) =>
        out.push({ level: parseInt(m[1], 10), name, id: ids.length === names.length ? ids[i] : null })
      );
    }
    return out;
  }

  /* Skill help id -> {group, groupId, teacher, zoneId}, from the skill group
   * articles. Each group article has one line naming its teacher (or the
   * guild) in the teacher colour, with a link to the teacher's zone when there
   * is one. */
  skillTeachers() {
    if (this._teachers) return this._teachers;
    const areas = new Set(this.index.filter(e => (e.labels || []).includes('area')).map(e => e.id));
    const out = new Map();
    for (const e of this.articles('skillgroup')) {
      const raw = this.raw(e.id);
      const ls = raw.split('\n');
      let line = ls.find(x => /<c c='fgdg'>[^<\s]/.test(x)) || '';
      // A few teachers' names carry their own colour, leaving the teacher
      // coloured parts empty: take the line that reads "Teacher - name".
      if (!line) line = ls.find(x => x.includes("<c c='fgdg'>") && strip(x).includes(' - ')) || '';
      const zone = hhIds(line).find(i => areas.has(i));
      const info = {
        group: this.title(e),
        groupId: e.id,
        teacher: strip(line).replace(/\s+/g, ' ').replace(/^[ -]+|[ -]+$/g, ''),
        zoneId: zone == null ? null : zone,
      };
      for (const i of hhIds(raw)) if (!out.has(i)) out.set(i, info);
    }
    this._teachers = out;
    return out;
  }

  /* A zone's names in every language, for finding it in the area list. */
  zoneNames(id) {
    const e = this.byId.get(id);
    if (!e) return [];
    const toc = e.toc || {};
    return [this.title(e), toc.en, toc.ru, toc.ua].filter(Boolean);
  }

  /* The class's stat bonuses from its help article, {str: 2, ...}. */
  classStats(clsEn) {
    const want = lower(clsEn).trim();
    if (!want) return {};
    const e = this.index.find(x => lower((x.toc || {}).en) === want && this.raw(x.id) != null);
    if (!e) return {};
    const m = new RegExp(esc(this.L.stats) + '\\s*:\\s*(.+)').exec(strip(this.raw(e.id)));
    return m ? parseStats(m[1]) : {};
  }

  // Religions and races --------------------------------------------------
  religions() {
    if (!this._religions) this._religions = this.parseReligions();
    return this._religions;
  }

  races() {
    if (!this._races) this._races = this.parseRaces();
    return this._races;
  }

  parseReligions() {
    const L = this.L;
    const out = [];
    for (const e of this.articles('religion')) {
      const head = header(this.raw(e.id));
      if (!(L.paths in head) && !(L.gifts in head)) continue;
      out.push({
        name: this.title(e), id: e.id, paths: head[L.paths] || '', patron: head[L.patron] || '',
        gifts: head[L.gifts] || '', restrict: head[L.restrict] || '',
      });
    }
    return out.sort(byName);
  }

  parseRaces() {
    const L = this.L;
    const out = [];
    for (const e of this.articles('race')) {
      const head = header(this.raw(e.id));
      if (!(L.stats in head)) continue;
      out.push({
        name: this.title(e), id: e.id, align: head[L.align] || '', stats: head[L.stats] || '',
        classes: head[L.classes] || '', resist: head[L.resist] || '', vuln: head[L.vuln] || '',
        size: head[L.size] || '',
      });
    }
    return out.sort(byName);
  }

  // Items ----------------------------------------------------------------
  itemName(it) {
    return it[{ en: 'nameEn', ua: 'nameUa' }[this.lang] || 'name'] || it.name || '';
  }

  itemPlace(it) {
    const sfx = { en: 'En', ua: 'Ua' }[this.lang] || '';
    return [it['area' + sfx] || it.area || '', it['where' + sfx] || it.where || ''];
  }

  itemSpecial(it) {
    const sfx = { en: 'En', ua: 'Ua' }[this.lang] || '';
    const v = String(it['special' + sfx] || it.special || '').trim();
    return v.replace(/^[- ]+|[- ]+$/g, '') ? v : '';
  }

  /* Weapons or armor between low and high level, usable by align. */
  items(kind, low, high, align, slot, wclass) {
    const src = kind === 'weapon' ? this.weapons : this.armor;
    const out = src.filter(it => {
      const lvl = num(it.level);
      if (lvl == null || lvl < low || lvl > high) return false;
      if (slot && it.wearloc !== slot) return false;
      if (wclass && it.wclass !== wclass) return false;
      if (align && !usableBy(it.align, align)) return false;
      return true;
    });
    return out.sort((a, b) => num(b.level) - num(a.level) || cmp(lower(this.itemName(a)), lower(this.itemName(b))));
  }

  slots(kind) {
    const src = kind === 'weapon' ? this.weapons : this.armor;
    const key = kind === 'weapon' ? 'wclass' : 'wearloc';
    return Array.from(new Set(src.map(it => it[key]).filter(v => typeof v === 'string' && v))).sort();
  }

  /* The weapon types a class has a skill for (sword, dagger, ...), read from
   * the English names of its skills' help articles. */
  classWeapons(clsEn) {
    const kinds = new Set(this.weapons.map(it => it.wclass).filter(Boolean));
    const found = new Set();
    for (const sk of this.classSkillList(clsEn)) {
      const e = this.byId.get(sk.id);
      const name = lower(e && (e.toc || {}).en);
      if (kinds.has(name)) found.add(name);
    }
    // No class trains exotic: everyone uses it, with intelligence and level.
    if (found.size && kinds.has('exotic')) found.add('exotic');
    return Array.from(found).sort();
  }

  zoneMap() {
    if (!this._zones) {
      this._zones = new Map();
      for (const e of this.articles('area')) {
        const head = header(this.raw(e.id));
        const info = { levels: head[this.L.levels] || '', danger: head[this.L.danger] || '', id: e.id };
        for (const name of [this.title(e), (e.toc || {}).en]) {
          if (name && !this._zones.has(lower(name))) this._zones.set(lower(name), info);
        }
      }
    }
    return this._zones;
  }

  /* {levels, danger} of the zone an item comes from, from its help article. */
  zoneInfo(area) {
    if (!area) return { levels: '', danger: '' };
    return this.zoneMap().get(lower(area)) || { levels: '', danger: '' };
  }

  /* The help article id of an area named in any language, or null. */
  areaArticle(names) {
    if (!this._areaIds) {
      this._areaIds = new Map();
      for (const e of this.index) {
        if (!(e.labels || []).includes('area')) continue;
        for (const n of Object.values(e.toc || {})) if (n && !this._areaIds.has(lower(n))) this._areaIds.set(lower(n), e.id);
      }
    }
    for (const n of names || []) {
      const id = this._areaIds.get(lower(n).trim());
      if (id != null) return id;
    }
    return null;
  }

  /* An article as plain text for reading: the reader's language, else Russian. */
  articleText(id) {
    const o = this.bodies.overlay && this.bodies.overlay[id];
    const raw = o != null && o !== '' ? o : (this.bodies.ru && this.bodies.ru[id]) || '';
    return strip(raw).trim();
  }
}

const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
