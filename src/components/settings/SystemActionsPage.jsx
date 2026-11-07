import React, { useEffect, useRef, useState } from 'react';
import { t, addStrings } from '../../i18n.js';
import { allTools, onToolsChanged, keyLabel, keyName, setToolKeys, toolForKey, setCapturing } from '../../port/tools';
import { macroFor } from '../../macros.js';
import { takesFromInput } from './MacrosPage.jsx';

// System actions: every tool of the client with its keys, which the player can
// change, add to, remove, or set back. Kept in this browser (port/tools.js).

addStrings({
  en: {
    'cfg.page.sysactions': 'System actions',
    'sa.intro': 'The keys of the client\'s own windows and actions. Change a key, add another, or remove them all. Your own macros on the same key always come first.',
    'sa.none': 'no key',
    'sa.change': 'Change key',
    'sa.add': 'Add key',
    'sa.clear': 'Remove keys',
    'sa.reset': 'Default',
    'sa.press': 'Press the new key for %s. Escape cancels.',
    'sa.set': '%s: %k.',
    'sa.cleared': '%s: no key now.',
    'sa.reseted': '%s: default keys, %k.',
    'sa.took': 'It was the key of %s, which has lost it.',
    'sa.typing': 'The command line needs this key for typing or history. Use it with Ctrl or Alt, or pick a function key.',
    'sa.macro': 'One of your macros has this key. Pick another key, or change the macro on the Macros page first.',
    'sa.overridden': 'your macro on %k comes first',
    'sa.cancel': 'Cancelled.',
  },
  ru: {
    'cfg.page.sysactions': 'Системные действия',
    'sa.intro': 'Клавиши собственных окон и действий клиента. Смените клавишу, добавьте ещё одну или уберите все. Ваши макросы на той же клавише всегда важнее.',
    'sa.none': 'без клавиши',
    'sa.change': 'Сменить клавишу',
    'sa.add': 'Добавить клавишу',
    'sa.clear': 'Убрать клавиши',
    'sa.reset': 'По умолчанию',
    'sa.press': 'Нажмите новую клавишу для: %s. Escape отменяет.',
    'sa.set': '%s: %k.',
    'sa.cleared': '%s: теперь без клавиши.',
    'sa.reseted': '%s: клавиши по умолчанию, %k.',
    'sa.took': 'Это была клавиша действия %s, у него она убрана.',
    'sa.typing': 'Эта клавиша нужна командной строке для ввода или истории. Возьмите её с Ctrl или Alt или выберите функциональную клавишу.',
    'sa.macro': 'Эта клавиша занята вашим макросом. Выберите другую или сначала измените макрос на странице «Макросы».',
    'sa.overridden': 'ваш макрос на %k важнее',
    'sa.cancel': 'Отменено.',
  },
  ua: {
    'cfg.page.sysactions': 'Системні дії',
    'sa.intro': 'Клавіші власних вікон і дій клієнта. Змініть клавішу, додайте ще одну або приберіть усі. Ваші макроси на тій самій клавіші завжди важливіші.',
    'sa.none': 'без клавіші',
    'sa.change': 'Змінити клавішу',
    'sa.add': 'Додати клавішу',
    'sa.clear': 'Прибрати клавіші',
    'sa.reset': 'Типово',
    'sa.press': 'Натисніть нову клавішу для: %s. Escape скасовує.',
    'sa.set': '%s: %k.',
    'sa.cleared': '%s: тепер без клавіші.',
    'sa.reseted': '%s: типові клавіші, %k.',
    'sa.took': 'Це була клавіша дії %s, у неї її прибрано.',
    'sa.typing': 'Ця клавіша потрібна командному рядку для введення чи історії. Візьміть її з Ctrl чи Alt або виберіть функціональну клавішу.',
    'sa.macro': 'Ця клавіша зайнята вашим макросом. Виберіть іншу або спершу змініть макрос на сторінці «Макроси».',
    'sa.overridden': 'ваш макрос на %k важливіший',
    'sa.cancel': 'Скасовано.',
  },
});

const MODIFIERS = ['Shift', 'Control', 'Alt', 'Meta', 'AltGraph', 'CapsLock'];
const fill = (s, name, keys) => s.replace('%s', name).replace('%k', keys);

/* A field that waits for one key press. In an edit field the screen reader
 * passes the keys on, so the page gets the press itself. */
function KeyCatcher({ label, onKey, onCancel }) {
  const box = useRef(null);
  const done = useRef(false); // a key or Escape came: the blur that follows is not a cancel
  useEffect(() => {
    setCapturing(true);
    if (box.current) box.current.focus();
    return () => setCapturing(false);
  }, []);
  return (
    <input
      ref={box}
      className="cfg-input"
      readOnly
      aria-label={label}
      value=""
      onBlur={() => {
        if (!done.current) onCancel();
      }}
      onKeyDown={e => {
        if (MODIFIERS.includes(e.key)) return;
        e.preventDefault();
        e.stopPropagation();
        if (e.key === 'Escape') {
          done.current = true;
          return onCancel();
        }
        const name = keyName(e);
        if (name) {
          done.current = true;
          onKey(name);
        }
      }}
    />
  );
}

export default function SystemActionsPage({ lang }) {
  const [, bump] = useState(0);
  const [waiting, setWaiting] = useState(null); // { id, add }
  const [said, setSaid] = useState('');
  const buttons = useRef({});
  useEffect(() => onToolsChanged(() => bump(n => n + 1)), []);

  const list = allTools()
    .slice()
    .sort((a, b) => a.label().localeCompare(b.label()));

  // Keys a macro made before has as well: the macro wins there, said so.
  const keysOf = tool => {
    if (!tool.keys.length) return t('sa.none', lang);
    const taken = tool.keys.filter(k => macroFor(k));
    return keyLabel(tool.keys) + (taken.length ? ' (' + t('sa.overridden', lang).replace('%k', keyLabel(taken)) + ')' : '');
  };
  const back = id => setTimeout(() => buttons.current[id] && buttons.current[id].focus(), 0);

  const take = (tool, add) => key => {
    // A key the command line needs (a letter, a digit, space, Up or Down,
    // without Ctrl or Alt): refused, or the tool would eat every one typed.
    if (takesFromInput(key)) {
      setWaiting(null);
      setSaid(t('sa.typing', lang));
      back(tool.id);
      return;
    }
    // A key one of the player's macros has: refused, so the two never fight.
    if (macroFor(key)) {
      setWaiting(null);
      setSaid(t('sa.macro', lang));
      back(tool.id);
      return;
    }
    const keys = add ? Array.from(new Set(tool.keys.concat([key]))) : [key];
    const before = toolForKey(key);
    const lost = setToolKeys(tool.id, keys);
    let msg = fill(t('sa.set', lang), tool.label(), keyLabel(keys));
    if (lost.length && before && before.id !== tool.id) msg += ' ' + fill(t('sa.took', lang), before.label(), '');
    setWaiting(null);
    setSaid(msg);
    back(tool.id);
  };

  return (
    <div className="ab trig">
      <div className="cfg-row-desc ab-intro">{t('sa.intro', lang)}</div>
      <div role="status" className="sr-only">{said}</div>
      {list.map(tool => (
        <div key={tool.id} className="ab-item" role="group" aria-label={tool.label() + ', ' + keysOf(tool)}>
          <span className="ab-name" role="heading" aria-level={3}>
            {tool.label()}: {keysOf(tool)}
          </span>
          {waiting && waiting.id === tool.id ? (
            <KeyCatcher
              label={fill(t('sa.press', lang), tool.label(), '')}
              onKey={take(tool, waiting.add)}
              onCancel={() => {
                setWaiting(null);
                setSaid(t('sa.cancel', lang));
                back(tool.id);
              }}
            />
          ) : (
            <>
              <button
                type="button"
                className="cfg-button"
                ref={el => (buttons.current[tool.id] = el)}
                onClick={() => setWaiting({ id: tool.id, add: false })}
              >
                {t('sa.change', lang)}
              </button>
              <button type="button" className="cfg-button" onClick={() => setWaiting({ id: tool.id, add: true })}>
                {t('sa.add', lang)}
              </button>
              {tool.keys.length ? (
                <button
                  type="button"
                  className="cfg-button"
                  onClick={() => {
                    setToolKeys(tool.id, []);
                    setSaid(fill(t('sa.cleared', lang), tool.label(), ''));
                    back(tool.id);
                  }}
                >
                  {t('sa.clear', lang)}
                </button>
              ) : null}
              <button
                type="button"
                className="cfg-button"
                onClick={() => {
                  setToolKeys(tool.id, null);
                  setSaid(fill(t('sa.reseted', lang), tool.label(), tool.defaultKeys.length ? keyLabel(tool.defaultKeys) : t('sa.none', lang)));
                  back(tool.id);
                }}
              >
                {t('sa.reset', lang)}
              </button>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
