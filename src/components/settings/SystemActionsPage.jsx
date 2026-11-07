import React, { useEffect, useRef, useState } from 'react';
import { t, addStrings } from '../../i18n.js';
import { allTools, onToolsChanged, keyLabel, keyName, setToolKeys, toolForKey, setCapturing } from '../../port/tools';
import { macroFor } from '../../macros.js';
import { takesFromInput, KeyCaps } from './MacrosPage.jsx';

// System actions: every tool of the client with its keys, which the player can
// change, add to, remove, or set back. Kept in this browser (port/tools.js).
// Laid out as the Macros page: one row per tool, its keys as key caps, and
// Edit, which opens the keys in a dialog of the Macros dialog's style.

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
    'sa.edit.title': 'Keys: %s',
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
    'sa.edit.title': 'Клавиши: %s',
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
    'sa.edit.title': 'Клавіші: %s',
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
      className="cfg-input mc-capture sa-catch"
      readOnly
      aria-label={label}
      placeholder={label}
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

/* A tool's keys as key caps, or "no key"; a key one of the player's macros
 * has as well is named: the macro wins there. */
function ToolKeys({ tool, lang }) {
  if (!tool.keys.length) return <span className="cfg-note">{t('sa.none', lang)}</span>;
  const taken = tool.keys.filter(k => macroFor(k));
  return (
    <span className="ab-keys">
      {tool.keys.map(k => (
        <KeyCaps key={k} value={k} />
      ))}
      {taken.length ? (
        <span className="cfg-note">({t('sa.overridden', lang).replace('%k', keyLabel(taken))})</span>
      ) : null}
    </span>
  );
}

/* One tool's keys, in the Macros dialog's frame: the keys now, then Change,
 * Add, Remove, Default and Cancel. Change and Add wait for a key in place.
 * onDone(msg) closes it; msg goes to the page's status line. */
function KeysDialog({ lang, tool, onDone }) {
  const [waiting, setWaiting] = useState(null); // { add }
  const [note, setNote] = useState(''); // said inside: a refused key, a cancel
  const first = useRef(null);
  const started = useRef(null); // the button that started the wait gets the focus back

  useEffect(() => {
    if (first.current) first.current.focus();
  }, []);

  // Escape closes this dialog, never the settings sheet under it: a capture
  // listener on window runs before the sheet's own on document. While a key
  // is awaited, Escape is the catcher's, which cancels the wait.
  useEffect(() => {
    const onKey = e => {
      if (e.key !== 'Escape' || waiting) return;
      e.stopPropagation();
      e.preventDefault();
      onDone('');
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [waiting, onDone]);

  const refocus = () => setTimeout(() => started.current && started.current.focus(), 0);

  const take = add => key => {
    // A key the command line needs (a letter, a digit, space, Up or Down,
    // without Ctrl or Alt): refused, or the tool would eat every one typed.
    if (takesFromInput(key)) {
      setWaiting(null);
      setNote(t('sa.typing', lang));
      refocus();
      return;
    }
    // A key one of the player's macros has: refused, so the two never fight.
    if (macroFor(key)) {
      setWaiting(null);
      setNote(t('sa.macro', lang));
      refocus();
      return;
    }
    const keys = add ? Array.from(new Set(tool.keys.concat([key]))) : [key];
    const before = toolForKey(key);
    const lost = setToolKeys(tool.id, keys);
    let msg = fill(t('sa.set', lang), tool.label(), keyLabel(keys));
    if (lost.length && before && before.id !== tool.id) msg += ' ' + fill(t('sa.took', lang), before.label(), '');
    onDone(msg);
  };

  const wait = add => e => {
    started.current = e.currentTarget;
    setNote('');
    setWaiting({ add });
  };

  return (
    <div className="mc-scrim">
      <div className="mc-dialog ab trig" role="dialog" aria-modal="true" aria-labelledby="sa-title">
        <div className="ab-h" id="sa-title">
          {fill(t('sa.edit.title', lang), tool.label(), '')}
        </div>

        <div className="mc-keyrow">
          {waiting ? (
            <KeyCatcher
              label={fill(t('sa.press', lang), tool.label(), '')}
              onKey={take(waiting.add)}
              onCancel={() => {
                setWaiting(null);
                setNote(t('sa.cancel', lang));
                refocus();
              }}
            />
          ) : (
            <div className="mc-capture mc-captured">
              <ToolKeys tool={tool} lang={lang} />
            </div>
          )}
        </div>
        <div className="cfg-note" role="status">
          {note}
        </div>

        <div className="trig-buttons">
          <button type="button" className="cfg-button" ref={first} onClick={wait(false)}>
            {t('sa.change', lang)}
          </button>
          <button type="button" className="cfg-button" onClick={wait(true)}>
            {t('sa.add', lang)}
          </button>
          {tool.keys.length ? (
            <button
              type="button"
              className="cfg-button"
             
              onClick={() => {
                setToolKeys(tool.id, []);
                onDone(fill(t('sa.cleared', lang), tool.label(), ''));
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
              onDone(
                fill(
                  t('sa.reseted', lang),
                  tool.label(),
                  tool.defaultKeys.length ? keyLabel(tool.defaultKeys) : t('sa.none', lang)
                )
              );
            }}
          >
            {t('sa.reset', lang)}
          </button>
          <button type="button" className="cfg-button" onClick={() => onDone('')}>
            {t('tr.cancel', lang)}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SystemActionsPage({ lang }) {
  const [, bump] = useState(0);
  const [editing, setEditing] = useState(null); // tool id
  const [said, setSaid] = useState('');
  const buttons = useRef({});
  useEffect(() => onToolsChanged(() => bump(n => n + 1)), []);

  const list = allTools()
    .slice()
    .sort((a, b) => a.label().localeCompare(b.label()));

  // Spoken: the keys, and which of them a macro has as well.
  const keysOf = tool => {
    if (!tool.keys.length) return t('sa.none', lang);
    const taken = tool.keys.filter(k => macroFor(k));
    return keyLabel(tool.keys) + (taken.length ? ' (' + t('sa.overridden', lang).replace('%k', keyLabel(taken)) + ')' : '');
  };
  const back = id => setTimeout(() => buttons.current[id] && buttons.current[id].focus(), 0);
  const tool = editing ? list.find(x => x.id === editing) : null;

  return (
    <div className="ab trig">
      <div className="cfg-row-desc ab-intro">{t('sa.intro', lang)}</div>
      <div role="status" className="sr-only">{said}</div>
      <ol className="ab-list" role="list" aria-label={t('cfg.page.sysactions', lang)}>
        {list.map(one => (
          <li key={one.id} className="ab-item">
            <span className="ab-name">
              <span role="heading" aria-level={3}>
                {one.label()}
              </span>
              <ToolKeys tool={one} lang={lang} />
            </span>
            <button
              type="button"
              className="cfg-button"
              ref={el => (buttons.current[one.id] = el)}
              aria-label={t('tr.edit', lang) + ': ' + one.label() + ', ' + keysOf(one)}
              onClick={() => {
                setSaid('');
                setEditing(one.id);
              }}
            >
              {t('tr.edit', lang)}
            </button>
          </li>
        ))}
      </ol>

      {tool ? (
        <KeysDialog
          lang={lang}
          tool={tool}
          onDone={msg => {
            setEditing(null);
            if (msg) setSaid(msg);
            back(tool.id);
          }}
        />
      ) : null}
    </div>
  );
}
