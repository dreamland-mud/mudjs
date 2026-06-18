/**
 * UI string table. Default locale is Russian; a future player-settings toggle will
 * switch `locale` (and re-render). Room names themselves come from area data and are
 * already localized — this table is only the UI chrome and computed labels.
 */

export type Locale = 'ru' | 'en';

/** Russian plural picker: forms = [one, few, many] (1 шаг / 2 шага / 5 шагов). */
function pluralRu(n: number, forms: [string, string, string]): string {
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

const TABLE: Record<Locale, Strings> = { ru, en };

/** Active locale. Default Russian; wire to player settings later. */
export const locale: Locale = 'ru';

/** Active string table. */
export const t: Strings = TABLE[locale];
