/**
 * Sector → fill/stroke colour, using the DreamLand web-client (mudjs) Tango ANSI
 * palette — the MUD's standard terminal colours. Each tile is a dark hue-tinted fill
 * (legible behind near-white room names) with a bright ANSI stroke that names the
 * terrain at a glance, mirroring how the in-game ASCII map colours each cell. Fills
 * are complemented by an SVG depth gradient overlay defined in <Map>.
 *
 * Tango refs: red #cc0000/#ed2330 · green #4e9a06/#8ee34f · yellow #c4a000/#fdea56
 * blue #3465a4/#55a3f2 · magenta #75507b/#d384cb · cyan #06989a/#2cf4eb · grey
 * #555753 · white #d3d7cf/#fff. Fills are those hues mixed down toward #121212.
 *
 * Colour is the only visual cue on the tile — sector names are read by screen
 * readers from the aria-label, so no icon glyphs are needed.
 */

import { locale } from './i18n.js';

export interface SectorStyle {
  fill: string;
  stroke: string;
  /** Bright, legible-on-#121212 colour for the room-name label on box-less tiles. */
  text: string;
  label: string;     // EN
  labelRu: string;   // RU
}

const STYLES: Record<string, SectorStyle> = {
  inside:        { fill: '#2a2410', stroke: '#c4a000', text: '#d9b94a', label: 'Inside',       labelRu: 'Помещение'     }, // ansi yellow (interior)
  city:          { fill: '#26282a', stroke: '#ffffff', text: '#ffffff', label: 'City',         labelRu: 'Город'         }, // white (paved)
  field:         { fill: '#1c2a10', stroke: '#8ee34f', text: '#8ee34f', label: 'Field',        labelRu: 'Поле'          }, // ansi bright green (grass)
  forest:        { fill: '#142509', stroke: '#4e9a06', text: '#6cba2e', label: 'Forest',       labelRu: 'Лес'           }, // ansi green (dense)
  hills:         { fill: '#2a230f', stroke: '#c4a000', text: '#c4a000', label: 'Hills',        labelRu: 'Холмы'         }, // ansi dark yellow {y — brown
  mountain:      { fill: '#232525', stroke: '#555753', text: '#a7aaa3', label: 'Mountain',     labelRu: 'Горы'          }, // ansi bright black (stone)
  water_swim:    { fill: '#0f1f33', stroke: '#3465a4', text: '#55a3f2', label: 'Water (swim)', labelRu: 'Вода (вплавь)' }, // ansi blue
  water_noswim:  { fill: '#0b1726', stroke: '#284a7e', text: '#4a86d8', label: 'Water (deep)', labelRu: 'Вода (глубоко)'}, // ansi blue (deep)
  underwater:    { fill: '#07101d', stroke: '#3465a4', text: '#5a90d0', label: 'Underwater',   labelRu: 'Под водой'     }, // ansi blue (darkest)
  air:           { fill: '#142632', stroke: '#55a3f2', text: '#7fc0ff', label: 'Air',          labelRu: 'Воздух'        }, // ansi bright blue (sky)
  desert:        { fill: '#2c2810', stroke: '#fdea56', text: '#fdea56', label: 'Desert',       labelRu: 'Пустыня'       }, // ansi bright yellow (sand)
  cave:          { fill: '#1a1c1d', stroke: '#555753', text: '#a7aaa3', label: 'Cave',         labelRu: 'Пещера'        }, // ansi bright black (dark)
  jungle:        { fill: '#102414', stroke: '#06989a', text: '#45c9b0', label: 'Jungle',       labelRu: 'Джунгли'       }, // ansi cyan-green (humid)
  tundra:        { fill: '#21282a', stroke: '#d3d7cf', text: '#e6e9e1', label: 'Tundra',       labelRu: 'Тундра'        }, // ansi white (snow)
  unknown:       { fill: '#1a1a1a', stroke: '#555753', text: '#a7aaa3', label: 'Unknown',      labelRu: 'Неизвестно'    }, // terminal ground
};

export function sectorStyle(sector: string): SectorStyle {
  return STYLES[sector] ?? STYLES.unknown;
}

/** Localized sector name for the active locale. */
export function sectorLabel(sector: string): string {
  const s = sectorStyle(sector);
  return locale === 'ru' ? s.labelRu : s.label;
}
