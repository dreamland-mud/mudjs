import React from 'react'
import { useSelector } from 'react-redux'
import PanelItem from './panelItem'
import { t } from '../../i18n'
import { runAutobuff, autobuffHasEntries } from '../sysCommands/autobuff'

// What each button actually sends. The interpreter resolves command names in
// every language it knows, so a button speaks the player's own: manip.js echoes
// data-action verbatim into the scrollback, and a Russian word landing in an
// English player's log reads like a glitch. Source of truth for every word
// below: <name>/<aliases> in dreamland_world/commands.
const WORDS = {
  look: { en: 'look', ru: 'смотреть', ua: 'дивитися' },
  inv: { en: 'inventory', ru: 'инвентарь', ua: 'інвентар' },
  equip: { en: 'equipment', ru: 'снаряжение', ua: 'спорядження' },
  // 'score', not 'oscore': the compact modern sheet, not the classic layout.
  score: { en: 'score', ru: 'счет', ua: 'рахунок' },
  recall: { en: 'recall', ru: 'возврат', ua: 'повернення' },
  flee: { en: 'flee', ru: 'сбежать', ua: 'втекти' },
  practice: { en: 'practice', ru: 'практиковать', ua: 'практикувати' },
  magic: { en: 'skills spells', ru: 'умения заклинания', ua: 'вміння заклинання' },
  skills: { en: 'skills skills', ru: 'умения навыки', ua: 'вміння навички' },
  quests: { en: 'quest', ru: 'задания', ua: 'завдання' },
  commands: { en: 'commands', ru: 'команды', ua: 'команди' },
  quit: { en: 'quit', ru: 'конец', ua: 'кінець' },
}

function word(key, lang) {
  const w = WORDS[key]
  return (w && (w[lang] || w.en)) || key
}

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s
}

function Btn({ action, label, confirm, combat }) {
  return (
    <button
      type="button"
      className={'btn btn-ctrl-panel' + (combat ? ' btn-combat' : '')}
      data-action={action}
      data-confirm={confirm}
    >
      {label}
    </button>
  )
}

// The autobuff button doesn't send a plain command: it calls runAutobuff(),
// which fires the server RPC plus the player's manual entries. It carries no
// data-action, so manip.js's .btn-ctrl-panel click handler no-ops on it.
function AutobuffBtn({ label }) {
  return (
    <button
      type="button"
      className="btn btn-ctrl-panel"
      aria-label={label}
      onClick={() => runAutobuff()}
    >
      {label}
    </button>
  )
}

export default function CommandButtons() {
  const prompt = useSelector(state => state.prompt)

  if (!prompt) return null

  const l = prompt.lang
  const fighting = prompt.fight > 0

  // Peace-time buttons, in the order they were always in. 'flee' is not here:
  // it is the one command in the set that only exists inside a fight.
  const info = ['look', 'inv', 'equip', 'score']
  const std = (key, confirm) => (
    <Btn key={key} action={word(key, l)} label={t('cmd.' + key, l)} confirm={confirm} />
  )

  let items

  if (fighting) {
    // The server sends the combat actions this character can use right now
    // (webprompt 'fcmd': flee, recall, then their own class and clan skills).
    // "none" or a server that predates the field leaves us the two escapes,
    // which every character has anyway.
    const fcmd = Array.isArray(prompt.fcmd) ? prompt.fcmd : []
    const actions = fcmd.length > 0 ? fcmd : [word('flee', l), word('recall', l)]

    items = actions
      .map(cmd => <Btn key={'f:' + cmd} action={cmd} label={capitalize(cmd)} combat />)
      // Looking around and checking your own state stay useful mid-fight;
      // practicing, browsing skills or quitting do not.
      .concat(info.map(key => std(key)))
  } else {
    items = ['look', 'inv', 'equip', 'score', 'recall', 'practice']
      .concat(
        // Hide the spell list from characters who have no spells to list
        // (webprompt 'sp'). An older server sends nothing, so keep the button.
        prompt.sp === 0 ? [] : ['magic']
      )
      .concat(['skills', 'quests', 'commands'])
      .map(key => std(key))
      .concat(std('quit', t('cmd.quitConfirm', l)))
  }

  // Autobuff button: show for casters (webprompt 'sp' > 0, or an older server
  // that omits the field) and for anyone keeping manual autobuff entries -- a
  // non-caster with a pet buffer. Prepended so the survivability tool sits first.
  if (prompt.sp !== 0 || autobuffHasEntries())
    items = [<AutobuffBtn key="autobuff" label={t('cmd.autobuff', l)} />].concat(items)

  // Two columns, filled top-down: the taller one first, so an odd count leaves
  // the gap on the right where the eye expects it.
  const half = Math.ceil(items.length / 2)

  return (
    <PanelItem storageKey="commands" title={t('cmd.title', l)}>
      <div id="commands-table" className="flexcontainer-row collapse show">
        <div className="flexcontainer-column">{items.slice(0, half)}</div>
        <div className="flexcontainer-column">{items.slice(half)}</div>
      </div>
    </PanelItem>
  )
}
