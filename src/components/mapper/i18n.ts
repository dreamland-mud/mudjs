/**
 * UI string table. Default locale is Russian; the player's in-game `config language`
 * drives `locale` via setLocale() (fed from the web-prompt `lang` field, see
 * location.js). Room + area names come from the area data (graph JSON `i18n` block) —
 * use nameFor()/descFor() to pick the display string for the active locale; this table
 * is only the UI chrome and computed labels.
 */

import type { LocalizedText } from './types.js';

export type Locale = 'ru' | 'en' | 'ua';

/** Anything carrying a base RU name/description plus optional en/ua overrides. */
type Named = { name?: string; i18n?: LocalizedText };
type Described = { description?: string; i18n?: LocalizedText };

/** Russian plural picker: forms = [one, few, many] (1 шаг / 2 шага / 5 шагов). */
function pluralRu(n: number, forms: [string, string, string]): string {
  const n10 = n % 10;
  const n100 = n % 100;
  if (n10 === 1 && n100 !== 11) return forms[0];
  if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) return forms[1];
  return forms[2];
}

/** Ukrainian plural picker: same one/few/many shape as Russian (1 крок / 2 кроки / 5 кроків). */
function pluralUa(n: number, forms: [string, string, string]): string {
  const n10 = n % 10;
  const n100 = n % 100;
  if (n10 === 1 && n100 !== 11) return forms[0];
  if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) return forms[1];
  return forms[2];
}

export interface Strings {
  // topbar
  area: string;
  layer: string;            // short form used in meta line ("слой")
  testAreas: string;
  allAreas: string;
  allLayers: string;
  selectArea: string;
  zLayerFilter: string;
  viewMode: string;
  tabMap: string;
  tabList: string;
  // loading
  loadingIndex: string;
  loadingArea: string;
  // integration (mudjs)
  noGraphMap: string;
  graphMapError: string;
  noAsciiMap: string;
  showAscii: string;
  closePanel: string;
  // search
  searchRooms: string;
  searchAria: string;
  resultsAria: string;
  unnamed: string;
  // side panel
  clickRoom: string;
  roomNotLoaded: string;
  flags: string;
  exits: string;
  description: string;
  noExits: string;
  anotherArea: string;
  runHere: string;
  unmapped: string;
  voidHere: (reason: string) => string;
  // toasts
  setCurrentFirst: string;
  alreadyThere: string;
  noPath: string;
  copied: string;
  steps: (n: number) => string;
  // map / list aria + headings
  mapOf: (name: string) => string;
  unnamedRoom: string;
  currentLocation: string;
  layerZ: (z: number) => string;     // ", слой z+1" fragment
  upTo: (name: string) => string;
  downTo: (name: string) => string;
  toZone: (name: string) => string;
  rooms: (n: number) => string;
  clusters: (n: number) => string;
  layers: string;
  clusterOf: (i: number, total: number) => string;
  layerHeading: (z: string, n: number) => string;
  voidShort: string;
  // exit directions
  dir: Record<string, string>;        // full word
  dirShort: Record<string, string>;   // compact glyph for the list view
}

const zSign = (z: number) => (z >= 0 ? `+${z}` : `${z}`);

const ru: Strings = {
  area: 'Зона',
  layer: 'слой',
  testAreas: '— Тестовые зоны —',
  allAreas: '— Все зоны —',
  allLayers: 'все',
  selectArea: 'Выбрать зону',
  zLayerFilter: 'Фильтр по слою',
  viewMode: 'Режим отображения',
  tabMap: 'Карта',
  tabList: 'Список',
  loadingIndex: 'Загрузка индекса',
  loadingArea: 'Загрузка зоны',
  noGraphMap: 'Графической карты для этой зоны пока нет.',
  graphMapError: 'Не удалось загрузить карту зоны.',
  noAsciiMap: 'ASCII-карты для этой зоны нет.',
  showAscii: 'Показать ASCII-карту',
  closePanel: 'Закрыть',
  searchRooms: 'поиск комнат…',
  searchAria: 'Поиск комнат в этой зоне',
  resultsAria: 'Результаты поиска',
  unnamed: '(без имени)',
  clickRoom: 'Кликни комнату, чтобы осмотреть её. Двойной клик по любой клетке проложит маршрут от твоей текущей позиции.',
  roomNotLoaded: 'Комната не загружена.',
  flags: 'Флаги',
  exits: 'Выходы',
  description: 'Описание',
  noExits: 'нет выходов',
  anotherArea: '(другая зона)',
  runHere: 'Бежать сюда',
  unmapped: 'не на карте',
  voidHere: (reason) => `Ужасная пустота (${reason})`,
  setCurrentFirst: 'Сначала укажи текущую комнату.',
  alreadyThere: 'Уже здесь.',
  noPath: 'Нет пути в пределах зоны.',
  copied: 'скопировано',
  steps: (n) => `${n} ${pluralRu(n, ['шаг', 'шага', 'шагов'])}`,
  mapOf: (name) => `Карта зоны ${name}`,
  unnamedRoom: 'комната без имени',
  currentLocation: 'текущая позиция',
  layerZ: (z) => `, слой z${zSign(z)}`,
  upTo: (name) => `Вверх в ${name}`,
  downTo: (name) => `Вниз в ${name}`,
  toZone: (name) => `Переход в зону ${name}`,
  rooms: (n) => `${n} ${pluralRu(n, ['комната', 'комнаты', 'комнат'])}`,
  clusters: (n) => `${n} ${pluralRu(n, ['кластер', 'кластера', 'кластеров'])}`,
  layers: 'слои',
  clusterOf: (i, total) => `Кластер ${i} из ${total}`,
  layerHeading: (z, n) => `Слой z ${z} · ${n} ${pluralRu(n, ['комната', 'комнаты', 'комнат'])}`,
  voidShort: '✦ пустота',
  dir: { north: 'север', south: 'юг', east: 'восток', west: 'запад', up: 'вверх', down: 'вниз' },
  dirShort: { north: 'с', south: 'ю', east: 'в', west: 'з', up: '^', down: 'v' },
};

const en: Strings = {
  area: 'Area',
  layer: 'layer',
  testAreas: '— Test areas —',
  allAreas: '— All areas —',
  allLayers: 'all',
  selectArea: 'Select area',
  zLayerFilter: 'Z-layer filter',
  viewMode: 'View mode',
  tabMap: 'Map',
  tabList: 'List',
  loadingIndex: 'Loading index',
  loadingArea: 'Loading area',
  noGraphMap: 'No graphical map for this zone yet.',
  graphMapError: 'Failed to load the zone map.',
  noAsciiMap: 'No ASCII map for this zone.',
  showAscii: 'Show ASCII map',
  closePanel: 'Close',
  searchRooms: 'search rooms…',
  searchAria: 'Search rooms in this area',
  resultsAria: 'Search results',
  unnamed: '(unnamed)',
  clickRoom: 'Click a room to inspect it. Double-click any tile to compute a speedwalk path from your current location.',
  roomNotLoaded: 'Room not loaded.',
  flags: 'Flags',
  exits: 'Exits',
  description: 'Description',
  noExits: 'no exits',
  anotherArea: '(another area)',
  runHere: 'Run here',
  unmapped: 'unmapped',
  voidHere: (reason) => `A terrible void here (${reason})`,
  setCurrentFirst: 'Set a current room first.',
  alreadyThere: 'Already there.',
  noPath: 'No path within this area.',
  copied: 'copied',
  steps: (n) => `${n} step${n === 1 ? '' : 's'}`,
  mapOf: (name) => `Map of ${name}`,
  unnamedRoom: 'unnamed room',
  currentLocation: 'current location',
  layerZ: (z) => `, layer z${zSign(z)}`,
  upTo: (name) => `Up to ${name}`,
  downTo: (name) => `Down to ${name}`,
  toZone: (name) => `To zone ${name}`,
  rooms: (n) => `${n} room${n === 1 ? '' : 's'}`,
  clusters: (n) => `${n} cluster${n === 1 ? '' : 's'}`,
  layers: 'layers',
  clusterOf: (i, total) => `Cluster ${i} of ${total}`,
  layerHeading: (z, n) => `Layer z ${z} · ${n} room${n === 1 ? '' : 's'}`,
  voidShort: '✦ void',
  dir: { north: 'north', south: 'south', east: 'east', west: 'west', up: 'up', down: 'down' },
  dirShort: { north: 'n', south: 's', east: 'e', west: 'w', up: 'u', down: 'd' },
};

const ua: Strings = {
  area: 'Зона',
  layer: 'шар',
  testAreas: '— Тестові зони —',
  allAreas: '— Усі зони —',
  allLayers: 'усі',
  selectArea: 'Обрати зону',
  zLayerFilter: 'Фільтр за шаром',
  viewMode: 'Режим відображення',
  tabMap: 'Мапа',
  tabList: 'Список',
  loadingIndex: 'Завантаження індексу',
  loadingArea: 'Завантаження зони',
  noGraphMap: 'Графічної мапи для цієї зони поки немає.',
  graphMapError: 'Не вдалося завантажити мапу зони.',
  noAsciiMap: 'ASCII-мапи для цієї зони немає.',
  showAscii: 'Показати ASCII-мапу',
  closePanel: 'Закрити',
  searchRooms: 'пошук кімнат…',
  searchAria: 'Пошук кімнат у цій зоні',
  resultsAria: 'Результати пошуку',
  unnamed: '(без назви)',
  clickRoom: 'Клікни кімнату, щоб оглянути її. Подвійний клік на будь-якій клітинці прокладе маршрут від твоєї поточної позиції.',
  roomNotLoaded: 'Кімната не завантажена.',
  flags: 'Прапори',
  exits: 'Виходи',
  description: 'Опис',
  noExits: 'немає виходів',
  anotherArea: '(інша зона)',
  runHere: 'Бігти сюди',
  unmapped: 'не на мапі',
  voidHere: (reason) => `Жахлива порожнеча (${reason})`,
  setCurrentFirst: 'Спершу вкажи поточну кімнату.',
  alreadyThere: 'Уже тут.',
  noPath: 'Немає шляху в межах зони.',
  copied: 'скопійовано',
  steps: (n) => `${n} ${pluralUa(n, ['крок', 'кроки', 'кроків'])}`,
  mapOf: (name) => `Мапа зони ${name}`,
  unnamedRoom: 'кімната без назви',
  currentLocation: 'поточна позиція',
  layerZ: (z) => `, шар z${zSign(z)}`,
  upTo: (name) => `Вгору до ${name}`,
  downTo: (name) => `Вниз до ${name}`,
  toZone: (name) => `Перехід до зони ${name}`,
  rooms: (n) => `${n} ${pluralUa(n, ['кімната', 'кімнати', 'кімнат'])}`,
  clusters: (n) => `${n} ${pluralUa(n, ['кластер', 'кластери', 'кластерів'])}`,
  layers: 'шари',
  clusterOf: (i, total) => `Кластер ${i} з ${total}`,
  layerHeading: (z, n) => `Шар z ${z} · ${n} ${pluralUa(n, ['кімната', 'кімнати', 'кімнат'])}`,
  voidShort: '✦ порожнеча',
  dir: { north: 'північ', south: 'південь', east: 'схід', west: 'захід', up: 'вгору', down: 'вниз' },
  dirShort: { north: 'пн', south: 'пд', east: 'сх', west: 'зх', up: '^', down: 'v' },
};

const TABLE: Record<Locale, Strings> = { ru, en, ua };

/**
 * Active locale + string table. Mutable module state (live ES bindings): setLocale()
 * swaps both, and every `import { t, locale }` sees the new value on its next read.
 * Memoized components (GraphMapPane, Map) still need a `locale` prop to re-render on a
 * pure language switch — the prop busts their memo; the render then reads the fresh `t`.
 * Default RU keeps the map identical until the server sends a `lang` (pre-keystone).
 */
export let locale: Locale = 'ru';
export let t: Strings = TABLE[locale];

/** Point the UI at a locale. No-op if unchanged; unknown locales fall back to RU. */
export function setLocale(loc: Locale): void {
  const next: Locale = loc === 'en' || loc === 'ua' ? loc : 'ru';
  if (next === locale) return;
  locale = next;
  t = TABLE[next];
}

/** Map the web-prompt `lang` attribute ("en"/"ru"/"ua") to a UI Locale; default RU. */
export function localeFromLang(lang: string | undefined | null): Locale {
  return lang === 'en' || lang === 'ua' ? lang : 'ru';
}

/**
 * Display name for an entity (room / area meta) in `loc` (default: active locale).
 * RU is the base `name`; en/ua come from the graph `i18n` block. Falls back to the RU
 * base whenever the requested locale has no override (untranslated room, older graph).
 */
export function nameFor(entity: Named | null | undefined, loc: Locale = locale): string {
  if (entity == null) return '';
  if (loc !== 'ru' && entity.i18n) {
    const over = entity.i18n[loc]?.name;
    if (over != null && over !== '') return over;
  }
  return entity.name ?? '';
}

/** Display description for an entity in `loc` (default: active locale); RU base fallback. */
export function descFor(entity: Described | null | undefined, loc: Locale = locale): string {
  if (entity == null) return '';
  if (loc !== 'ru' && entity.i18n) {
    const over = entity.i18n[loc]?.description;
    if (over != null && over !== '') return over;
  }
  return entity.description ?? '';
}
