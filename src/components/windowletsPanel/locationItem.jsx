import React from 'react';
import PanelItem from './panelItem';
import {
  FaTree,
  FaCity,
  FaMountain,
  FaWater,
  FaWind,
  FaFire,
  FaHome,
  FaSwimmingPool,
  FaLeaf,
  FaQuestionCircle,
  FaSeedling,
} from 'react-icons/fa';

import { MdScubaDiving } from 'react-icons/md';
import { MdPool } from 'react-icons/md';
import { TiWeatherWindyCloudy } from 'react-icons/ti';
import { GiForest } from 'react-icons/gi';
import { GiDesert } from 'react-icons/gi';
import { PiCityFill } from 'react-icons/pi';
import { GiWheat } from 'react-icons/gi';
import { GiHills } from 'react-icons/gi';
import { TbSailboat } from 'react-icons/tb';
import { PiMountainsBold } from 'react-icons/pi';

// Prompt zone field: string with area name.
const ZoneRow = ({ zone }) => {
  return (
    <tr>
      <td>
        &nbsp;<i className="fa">&#xf041;</i>
      </td>
      <td>
        "<span className="fg-ansi-dark-color-6">{zone}</span>"
      </td>
    </tr>
  );
};

// Prompt room field: string with room name.
const RoomRow = ({ room }) => {
  return (
    <tr>
      <td></td>
      <td>
        "<span className="fg-ansi-bright-color-6">{room}</span>"
      </td>
    </tr>
  );
};

// Draw a single exit letter or a dot if no such exit exists.
const ExitCell = ({ ex_ru, ex_en, ex_hidden, ex_visible, lang }) => {
  let exit = ex_en.toLowerCase();

  // See if this exit letter is among hidden exits.
  let hidden = ex_hidden.indexOf(exit) !== -1;
  // See if this exit letter is among visible exits.
  let visible = ex_visible.indexOf(exit) !== -1;

  // If found anywhere, draw a letter of selected language, otherwise a dot.
  let letter;
  if (hidden || visible) {
    letter = lang === 'r' ? ex_ru : ex_en;
  } else {
    letter = '\u00B7';
  }

  // Mark hidden exits with default color, other exits with bright blue.
  let color = hidden ? '' : 'fg-ansi-bright-color-6';

  return <span className={`${color}`}>{letter}</span>;
};

// Prompt exits field: e - open exits, h - closed exits, l - language (r, e)
const ExitsRow = ({ e, h, l }) => {
  return (
    <tr>
      <td className="v-top">
        &nbsp;<i className="fa">&#xf277;</i>
      </td>
      <td className="v-bottom">
        выходы:&nbsp;
        <ExitCell ex_ru="С" ex_en="N" ex_hidden={h} ex_visible={e} lang={l} />
        <ExitCell ex_ru="В" ex_en="E" ex_hidden={h} ex_visible={e} lang={l} />
        <ExitCell ex_ru="Ю" ex_en="S" ex_hidden={h} ex_visible={e} lang={l} />
        <ExitCell ex_ru="З" ex_en="W" ex_hidden={h} ex_visible={e} lang={l} />
        <ExitCell ex_ru="О" ex_en="D" ex_hidden={h} ex_visible={e} lang={l} />
        <ExitCell ex_ru="П" ex_en="U" ex_hidden={h} ex_visible={e} lang={l} />
      </td>
    </tr>
  );
};

// Sector type info: i - sector icon unicode, n - sector name
const getSectorIcon = sectorName => {
  console.log(` sectorName:`, sectorName);
  const firstWord = sectorName
    ?.split(',')[0]
    .trim()
    .replace(/[()]/g, '')
    .toLowerCase();
  console.log(` sectorName:`, firstWord);
  switch (firstWord) {
    case 'внутри':
      return <FaHome size={19} />;
    case 'город':
      return <PiCityFill size={20} />;
    case 'поле':
      return <GiWheat size={22} />;
    case 'лес':
      return <GiForest size={22} />;
    case 'холмы':
      return <GiHills size={21} />;
    case 'горы':
      return <PiMountainsBold size={21} />;
    case 'мелководье':
      return <MdPool size={23} />;
    case 'глубоководье':
      return <TbSailboat size={23} />;
    case 'воздух':
      return <TiWeatherWindyCloudy size={23} />;
    case 'пустыня':
      return <GiDesert size={21} />;
    case 'под водой':
      return <MdScubaDiving size={23} />;
    default:
      return <FaQuestionCircle />;
  }
};

const SectorRow = ({ n }) => {
  return (
    <tr>
      <td className="v-top" aria-label={`Иконка сектора ${n}`}>
        &nbsp;{getSectorIcon(n)}
      </td>
      <td className="v-bottom">{n}&nbsp;</td>
    </tr>
  );
};

/**
 * Render player location windowlet.
 */
export default function LocationItem(prompt) {
  const { zone, room, exits, sect } = prompt;

  return (
    <PanelItem title="Твое местоположение">
      <table>
        <tbody>
          {zone && zone !== 'none' && <ZoneRow zone={zone} />}
          {room && room !== 'none' && <RoomRow room={room} />}
          {exits && exits !== 'none' && <ExitsRow {...exits} />}
          {sect && sect !== 'none' && <SectorRow {...sect} />}
        </tbody>
      </table>
    </PanelItem>
  );
}
