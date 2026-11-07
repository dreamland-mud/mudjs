import React, { useState } from 'react';
import { t, addStrings } from '../../i18n.js';
import { reviewEnabled, setReviewEnabled, IS_PHONE } from '../../review';

// Accessibility: the screen reader switches in plain words, so nobody has to
// know a #command. Each is the same switch as its command (#review) and is
// kept in this browser. The next PRs add their own switches here.

addStrings({
  en: {
    'cfg.section.access': 'Accessibility',
    'cfg.page.access': 'Screen reader',
    'acc.intro': 'For playing with a screen reader. Each switch is kept in this browser.',
    'acc.review': 'Read the output with Tab from the command line (review mode)',
    'acc.review.hint': 'On a computer. Phones read the output by touch, with its links, so it is never on there.',
  },
  ru: {
    'cfg.section.access': 'Доступность',
    'cfg.page.access': 'Экранный чтец',
    'acc.intro': 'Для игры с экранным чтецом. Каждый переключатель хранится в этом браузере.',
    'acc.review': 'Читать вывод клавишей Tab из командной строки (режим просмотра)',
    'acc.review.hint': 'На компьютере. Телефон читает вывод касанием, со ссылками, поэтому там он не включается.',
  },
  ua: {
    'cfg.section.access': 'Доступність',
    'cfg.page.access': 'Екранний читач',
    'acc.intro': 'Для гри з екранним читачем. Кожен перемикач зберігається в цьому браузері.',
    'acc.review': 'Читати вивід клавішею Tab з командного рядка (режим перегляду)',
    'acc.review.hint': 'На комп\'ютері. Телефон читає вивід дотиком, з посиланнями, тому там він не вмикається.',
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
    </div>
  );
}
