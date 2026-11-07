import React, { useState } from 'react';
import { t, addStrings } from '../../i18n.js';
import { runTool } from '../../port/tools';
import { reviewEnabled, setReviewEnabled, IS_PHONE } from '../../review';
import { announceSheet } from '../../sheets';

/* Another window from here: Settings closes first (it keeps the page behind it
 * out of reach while open), then the window opens. */
const openWindow = id => {
  announceSheet('access-leave');
  setTimeout(() => runTool(id), 200);
};

// Accessibility: every switch of the tools from the desktop client, in plain
// words, so nobody has to know a #command. Each one is the same switch as its
// command (#lists, #exittones, #roomsounds, Ctrl+Shift+S, #review) and is kept
// in this browser.

addStrings({
  en: {
    'cfg.section.access': 'Accessibility',
    'cfg.page.access': 'Screen reader',
    'acc.intro': 'For playing with a screen reader. Each switch is kept in this browser.',
    'acc.review': 'Read the output with Tab from the command line (review mode)',
    'acc.review.hint': 'On a computer. Phones read the output by touch, with its links, so it is never on there.',
    'acc.lists': 'Open game lists (skills, groups, help) in a window with buttons',
    'acc.speech': 'Speak new output',
    'acc.tones': 'Play a sound for each exit when you move',
    'acc.room': 'Play sounds for players, creatures and items in a room',
    'acc.filter': 'Words not to speak',
  },
  ru: {
    'cfg.section.access': 'Доступность',
    'cfg.page.access': 'Экранный чтец',
    'acc.intro': 'Для игры с экранным чтецом. Каждый переключатель хранится в этом браузере.',
    'acc.review': 'Читать вывод клавишей Tab из командной строки (режим просмотра)',
    'acc.review.hint': 'На компьютере. Телефон читает вывод касанием, со ссылками, поэтому там он не включается.',
    'acc.lists': 'Открывать игровые списки (умения, группы, справку) в окне с кнопками',
    'acc.speech': 'Озвучивать новый вывод',
    'acc.tones': 'Звук для каждого выхода при движении',
    'acc.room': 'Звуки для игроков, существ и предметов в комнате',
    'acc.filter': 'Слова, которые не озвучивать',
  },
  ua: {
    'cfg.section.access': 'Доступність',
    'cfg.page.access': 'Екранний читач',
    'acc.intro': 'Для гри з екранним читачем. Кожен перемикач зберігається в цьому браузері.',
    'acc.review': 'Читати вивід клавішею Tab з командного рядка (режим перегляду)',
    'acc.review.hint': 'На комп\'ютері. Телефон читає вивід дотиком, з посиланнями, тому там він не вмикається.',
    'acc.lists': 'Відкривати ігрові списки (вміння, групи, довідку) у вікні з кнопками',
    'acc.speech': 'Озвучувати новий вивід',
    'acc.tones': 'Звук для кожного виходу під час руху',
    'acc.room': 'Звуки для гравців, істот і предметів у кімнаті',
    'acc.filter': 'Слова, які не озвучувати',
  },
});

function read(key) {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    return null;
  }
}

const state = () => ({
  review: reviewEnabled(),
  lists: read('mudjs.serverLists') === '1',
  speech: read('mudjs.speechOff') !== '1',
  tones: read('mudjs.exitTones') === '1',
  room: read('mudjs.roomSounds') === '1',
});

function Switch({ id, label, hint, on, onToggle }) {
  return (
    <div className="ab-item trig-mute">
      <span className="ab-name" id={id + '-l'} role="heading" aria-level={3}>
        {label}
        {hint ? <span className="cfg-row-desc"> {hint}</span> : null}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-labelledby={id + '-l'}
        className={on ? 'cfg-switch cfg-switch-on' : 'cfg-switch'}
        onClick={onToggle}
      >
        <span className="cfg-switch-knob" />
      </button>
    </div>
  );
}

export default function AccessPage({ lang }) {
  // Read fresh on every draw: a switch may have been turned elsewhere (#exittones,
  // Ctrl+Shift+S) while Settings stayed in the page.
  const [, bump] = useState(0);
  const s = state();
  const again = () => bump(n => n + 1);
  const tool = (id, arg) => () => {
    runTool(id, arg);
    again();
  };

  return (
    <div className="ab trig">
      <div className="cfg-row-desc ab-intro">{t('acc.intro', lang)}</div>
      {IS_PHONE ? null : (
        <Switch
          id="acc-review"
          label={t('acc.review', lang)}
          hint={t('acc.review.hint', lang)}
          on={s.review}
          onToggle={() => {
            setReviewEnabled(!s.review);
            again();
          }}
        />
      )}
      <Switch id="acc-lists" label={t('acc.lists', lang)} on={s.lists} onToggle={tool('lists', s.lists ? 'off' : 'on')} />
      <Switch id="acc-speech" label={t('acc.speech', lang)} on={s.speech} onToggle={tool('out-speech')} />
      <Switch id="acc-tones" label={t('acc.tones', lang)} on={s.tones} onToggle={tool('exittones', s.tones ? 'off' : 'on')} />
      <Switch id="acc-room" label={t('acc.room', lang)} on={s.room} onToggle={tool('roomsounds', s.room ? 'off' : 'on')} />
      <div className="ab-item">
        <button type="button" className="cfg-button" onClick={() => openWindow('out-speechfilter')}>
          {t('acc.filter', lang)}
        </button>
      </div>
    </div>
  );
}
