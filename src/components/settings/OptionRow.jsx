import React, { useEffect, useRef, useState } from 'react';
import { t } from '../../i18n.js';

// One setting: its name, what the game says about its current state, and the
// control that changes it. The question mark opens the longer explanation and,
// for anything that changes how the game looks, samples of the real output --
// painted the way the terminal paints it.

// Colour markup from the server is "<c c='fgby'>text</c>", the same as in the
// terminal, and it arrives already escaped for the web -- so a '>' in the game
// line is '&gt;' before we ever see it. Escaping it a second time here is what
// put a literal '&gt;' on the screen. Instead every tag but <c> is dropped, and
// the entities are left exactly as the server wrote them.
function paint(text) {
  return String(text)
    .replace(/<(?!\/?c[\s>])[^>]*>/g, '')
    .replace(/<c c=['"]([a-z0-9_-]+)['"]>/g, '<span class="$1">')
    .replace(/<\/c>/g, '</span>');
}

/** The label with the part the player searched for marked out. */
function Marked({ text, query }) {
  const at = query ? String(text).toLowerCase().indexOf(query) : -1;
  if (at < 0) return <>{text}</>;

  return (
    <>
      {text.slice(0, at)}
      <mark className="cfg-mark">{text.slice(at, at + query.length)}</mark>
      {text.slice(at + query.length)}
    </>
  );
}

function Switch({ on, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      className={on ? 'cfg-switch cfg-switch-on' : 'cfg-switch'}
      onClick={() => onChange(!on)}
    >
      <span className="cfg-switch-knob" />
    </button>
  );
}

function Segments({ options, value, onChange }) {
  return (
    <div className="cfg-segments" role="group">
      {options.map(one => (
        <button
          type="button"
          key={one.value}
          className={
            one.value === value ? 'cfg-segment cfg-segment-on' : 'cfg-segment'
          }
          onClick={() => onChange(one.value)}
        >
          {one.label}
        </button>
      ))}
    </div>
  );
}

// A slider reports every pixel it passes through. Sending each one would fire a
// command a millisecond apart -- a flood at the server for one drag -- so the
// number here moves freely and only the value the player settles on is sent.
function NumberBox({ value, min, max, step, onChange }) {
  const [draft, setDraft] = useState(value);
  const [known, setKnown] = useState(value);

  if (value !== known) {
    setKnown(value);
    setDraft(value);
  }

  const commit = () => {
    // A field hands back a string, the server sends a number: dragged away and
    // back again, '60' and 60 would look like a change worth a command.
    if (Number(draft) !== Number(value)) onChange(draft);
  };

  return (
    <div className="cfg-number">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onMouseUp={commit}
        onTouchEnd={commit}
        onKeyUp={commit}
        onBlur={commit}
      />
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter') commit();
        }}
      />
    </div>
  );
}

// The word the player has to hand to a bot in another program. Selecting it out
// of a line of prose is fiddly on a phone and not much better on a desktop, so
// it sits in a field of its own that selects itself, with a button that puts it
// on the clipboard.
function Secret({ text, lang }) {
  const field = useRef(null);
  const [done, setDone] = useState(false);
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = () => {
    const node = field.current;
    if (node) node.select();

    const write = navigator.clipboard && navigator.clipboard.writeText;
    const copied = write
      ? navigator.clipboard.writeText(text).then(() => true, () => false)
      : Promise.resolve(document.execCommand && document.execCommand('copy'));

    copied.then(ok => {
      if (!ok) return;
      setDone(true);
      timer.current = setTimeout(() => setDone(false), 1500);
    });
  };

  return (
    <span className="cfg-secret">
      <input type="text" readOnly value={text} ref={field} onFocus={e => e.target.select()} />
      <button type="button" className="cfg-button" onClick={copy}>
        {t(done ? 'cfg.copied' : 'cfg.copy', lang)}
      </button>
    </span>
  );
}

function Text({ value, placeholder, action, onChange, onAction, clearable }) {
  const [draft, setDraft] = useState(value || '');
  const [known, setKnown] = useState(value || '');

  // Whatever the server says this is worth, the field follows -- unless the
  // player is in the middle of typing something else.
  if ((value || '') !== known) {
    setKnown(value || '');
    setDraft(value || '');
  }

  const commit = () => {
    if (draft !== (value || '')) onChange(draft);
  };

  return (
    <div className="cfg-text">
      <input
        type="text"
        value={draft}
        placeholder={placeholder || ''}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter') commit();
        }}
      />
      {/* Nothing to clear when the box is already empty: a button that does
          nothing still reads as a button that should. */}
      {clearable ? (
        <button type="button" className="cfg-button" onClick={onAction}>
          {action}
        </button>
      ) : null}
    </div>
  );
}

/** What the game says about the option as it stands now -- the same sentence
 *  the terminal prints when the option is changed. */
function describe(option, value) {
  if (option.type === 'bool') {
    return (value ? option.on : option.off) || option.hint || '';
  }

  if (option.type === 'enum') {
    const chosen = (option.values || []).find(one => one.value === value);
    return (chosen && chosen.desc) || option.hint || '';
  }

  if (option.type === 'int') {
    const number = Number(value);
    const off = option.offValue != null ? option.offValue : 0;
    if (!Number.isFinite(number) || number === off) {
      return option.descEmpty || option.hint || '';
    }
    return (option.desc || option.hint || '').replace('%d', number);
  }

  const held = option.type === 'account' ? (value || {}).username : value;

  if (!held) return option.descEmpty || option.hint || '';
  return (option.desc || option.hint || '').replace('%s', held);
}

export default function OptionRow({
  option,
  value,
  lang,
  query,
  onChange,
  pending,
  refused,
}) {
  const [open, setOpen] = useState(false);

  // The server already sent everything in the player's language.
  const help = option.help;
  const examples = option.examples || [];
  const hasHelp = !!help || examples.length > 0;
  const label = option.label;

  const change = (next, spelled) => onChange(option, next, spelled);

  let control = null;

  if (option.type === 'bool') {
    control = (
      <Switch
        on={!!value}
        onChange={next =>
          // The server takes 'on' and 'off' in any language; the echo shows the
          // word the player would actually have typed in theirs.
          change(next ? 'on' : 'off', t(next ? 'cfg.yes' : 'cfg.no', lang))
        }
      />
    );
  } else if (option.type === 'enum') {
    control = (
      <Segments
        value={value}
        options={option.values || []}
        onChange={next => change(next, next)}
      />
    );
  } else if (option.type === 'int') {
    const off = option.offValue != null ? option.offValue : 0;
    const number = Number(value);
    control = (
      <div className="cfg-number-row">
        <button
          type="button"
          className={
            !Number.isFinite(number) || number === off
              ? 'cfg-button cfg-button-on'
              : 'cfg-button'
          }
          onClick={() => change(off, String(off))}
        >
          {t('cfg.off', lang)}
        </button>
        <NumberBox
          value={Number.isFinite(number) ? number : off}
          min={option.min != null ? option.min : 0}
          max={option.max != null ? option.max : 100}
          step={option.step || 1}
          onChange={next => change(next, String(next))}
        />
      </div>
    );
  } else if (option.type === 'account') {
    const account = value || {};
    const action = (option.actions || [])[0];
    control = (
      <div className="cfg-account">
        {account.token ? (
          <Secret text={'/link ' + account.token} lang={lang} />
        ) : null}
        {action ? (
          <button
            type="button"
            className="cfg-button"
            onClick={() => change(action.value, action.label)}
          >
            {action.label}
          </button>
        ) : null}
      </div>
    );
  } else {
    control = (
      <Text
        value={value}
        placeholder={option.placeholder}
        action={t('cfg.clear', lang)}
        clearable={!!value}
        onChange={next => change(next, next || t('cfg.clear', lang))}
        onAction={() => change('', t('cfg.clear', lang))}
      />
    );
  }

  return (
    <div className="cfg-row">
      <div className="cfg-row-text">
        <div className="cfg-row-name">
          <span className="cfg-row-key">
            <Marked text={label} query={query} />
          </span>
          {hasHelp ? (
            <button
              type="button"
              className="cfg-help-badge"
              aria-label={t('cfg.help', lang)}
              aria-expanded={open}
              onClick={() => setOpen(was => !was)}
            >
              ?
            </button>
          ) : null}
        </div>
        {/* What the server says the option is, or -- until the next thing
            happens to it -- why the server would not have it. */}
        {refused ? (
          <div className="cfg-row-desc cfg-row-refused">
            {typeof refused === 'string' ? refused : t('cfg.refused', lang)}
          </div>
        ) : (
          <div className="cfg-row-desc">{describe(option, value)}</div>
        )}
      </div>

      {/* A control with a change in flight takes no second click: the first one
          has not been answered yet, and the server is the one who decides.

          A fieldset rather than a div, because `disabled` on it disables every
          control inside for the keyboard too. Greying the layer out and turning
          off pointer-events stopped the mouse and nothing else: the row was
          still reachable by Tab and still answered Space. */}
      <fieldset
        className={pending ? 'cfg-row-control is-pending' : 'cfg-row-control'}
        disabled={pending || undefined}
        aria-busy={pending ? 'true' : undefined}
      >
        {control}
      </fieldset>

      {/* A line of its own under both: inside the text column the help would be
          squeezed by the width of the switch, and the switch would drift down
          to the middle of it instead of standing opposite the option. */}
      {open ? (
        <div className="cfg-help-body">
          {help ? <p className="cfg-help-text">{help}</p> : null}
          {examples.map((example, index) => (
            <div className="cfg-help-example" key={index}>
              <div className="cfg-help-example-label">{example.label}</div>
              <div
                className="cfg-help-example-text"
                dangerouslySetInnerHTML={{ __html: paint(example.text) }}
              />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
