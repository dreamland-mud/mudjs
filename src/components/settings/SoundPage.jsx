import React, { useState } from 'react';
import { t } from '../../i18n.js';
import { getSoundPrefs, setSoundPrefs, playSound, stopSound, SWITCHABLE } from '../../sound.js';
import SwitchButton from './SwitchButton.jsx';

// Sound settings: this device's volume, not the character's -- a phone in a
// bus and a desktop with headphones want different levels for the same player.
// Mute stops what is playing at once. Each type has its own level, so combat
// can stay loud while the ambience whispers. A few server sounds also get
// their own switch under their type (say can be noise, a tell never is).

const TYPES = ['combat', 'spell', 'skill', 'alert', 'chat', 'ui', 'ambient', 'music'];
// A short sample per type, so a slider can be tried where it is set.
const SAMPLE = { combat: 'combat/hit', spell: 'spell/fire', skill: 'skill/kick', alert: 'alert/bell', chat: 'chat/tell', ui: 'ui/notify' };

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

// A positive switch: on = sound plays. The visible name is its label too.
function Switch({ label, on, onToggle }) {
  return (
    <div className="ab-item trig-mute">
      <span className="ab-name">{label}</span>
      <SwitchButton on={on} label={label} onToggle={onToggle} />
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

      {/* Stored as `mute`, inverted here. */}
      <Switch label={t('snd.on', lang)} on={!prefs.mute} onToggle={() => update({ mute: !prefs.mute })} />

      <Slider id="snd-master" label={t('snd.master', lang)} value={prefs.master} onChange={v => update({ master: v })} lang={lang} />

      <div className="ab-h">{t('snd.types', lang)}</div>
      {TYPES.map(type => {
        const switches = SWITCHABLE.filter(name => name.split('/')[0] === type);
        return (
          <React.Fragment key={type}>
            <Slider
              id={'snd-' + type}
              label={t('snd.type.' + type, lang)}
              value={prefs.types[type]}
              onChange={v => update({ types: { [type]: v } })}
              onTry={SAMPLE[type] ? trySound(SAMPLE[type]) : null}
              lang={lang}
            />
            {switches.length ? (
              <div className="trig-subswitches" role="group" aria-label={t('snd.type.' + type, lang)}>
                {switches.map(name => (
                  <Switch
                    key={name}
                    label={t('snd.sound.' + name, lang)}
                    on={!prefs.off[name]}
                    onToggle={() => update({ off: { ...prefs.off, [name]: !prefs.off[name] } })}
                  />
                ))}
              </div>
            ) : null}
          </React.Fragment>
        );
      })}
    </div>
  );
}
