import React, { useState } from 'react';
import { t } from '../../i18n.js';
import { getSoundPrefs, setSoundPrefs, playSound, stopSound } from '../../sound.js';

// Sound settings: this device's volume, not the character's -- a phone in a
// bus and a desktop with headphones want different levels for the same player.
// Mute stops what is playing at once. Each type has its own level, so combat
// can stay loud while the ambience whispers.

const TYPES = ['combat', 'alert', 'chat', 'ui', 'ambient', 'music'];
// A short sample per type, so a slider can be tried where it is set.
const SAMPLE = { combat: 'combat/hit', alert: 'alert/bell', chat: 'chat/tell', ui: 'ui/notify' };

function Slider({ id, label, value, onChange, onTry, lang }) {
  return (
    <div className="trig-slider">
      <label htmlFor={id}>{label}</label>
      <input id={id} type="range" min="0" max="100" step="5" value={value} onChange={e => onChange(Number(e.target.value))} />
      <span className="trig-slider-val">{value}%</span>
      {onTry ? (
        <button type="button" className="cfg-button" aria-label={t('tr.sound.play', lang) + ': ' + label} onClick={onTry}>
          {t('tr.sound.play', lang)}
        </button>
      ) : null}
    </div>
  );
}

export default function SoundPage({ lang }) {
  const [prefs, setPrefs] = useState(getSoundPrefs());
  const update = next => {
    setSoundPrefs(next);
    setPrefs(getSoundPrefs());
  };
  const trySound = name => () => {
    stopSound();
    playSound(name, { P: 100 });
  };

  return (
    <div className="ab trig">
      <div className="cfg-row-desc ab-intro">{t('snd.intro', lang)}</div>

      <div className="ab-item trig-mute">
        <span className="ab-name">{t('snd.on', lang)}</span>
        {/* A positive switch: on = sound plays. Stored as `mute`, inverted here. */}
        <button
          type="button"
          role="switch"
          aria-checked={!prefs.mute}
          aria-label={t('snd.on', lang)}
          className={prefs.mute ? 'cfg-switch' : 'cfg-switch cfg-switch-on'}
          onClick={() => update({ mute: !prefs.mute })}
        >
          <span className="cfg-switch-knob" />
        </button>
      </div>

      <Slider id="snd-master" label={t('snd.master', lang)} value={prefs.master} onChange={v => update({ master: v })} lang={lang} />

      <div className="ab-h">{t('snd.types', lang)}</div>
      {TYPES.map(type => (
        <Slider
          key={type}
          id={'snd-' + type}
          label={t('snd.type.' + type, lang)}
          value={prefs.types[type]}
          onChange={v => update({ types: { [type]: v } })}
          onTry={SAMPLE[type] ? trySound(SAMPLE[type]) : null}
          lang={lang}
        />
      ))}
    </div>
  );
}
