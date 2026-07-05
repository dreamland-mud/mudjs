import $ from 'jquery';

// Central client-side i18n for the mudjs UI chrome (panel titles, column headers,
// button labels, ARIA labels, placeholders). The player's display language
// ("en"/"ru"/"ua") arrives on every web prompt as b.lang (server side:
// Player::displayLang -> interprethandler webPrompt). We cache the last value and
// DEFAULT TO ENGLISH until the first prompt, matching the "EN default" policy.
//
// Two ways to localize a string:
//   * components that already receive the prompt pass it explicitly: t(key, prompt.lang)
//     -- these re-render on every prompt, so a live `config language` switch updates them;
//   * static components with no prompt (help search, input bar, overlay, terminal) call
//     t(key) and rely on getLang(). Those pick up a language change on their next render.
//
// Only UI CHROME lives here. Game text (room/act/affect labels) is localized on the
// server and arrives already in the player's language.

let currentLang = 'en';

$(function () {
  $('#rpc-events').on('rpc-prompt', function (e, b) {
    if (b && b.lang != null) currentLang = b.lang;
  });
});

export function getLang() {
  return currentLang;
}

// Mostly for explicit control / tests; the prompt handler above is the normal path.
export function setLang(lang) {
  if (lang != null) currentLang = lang;
}

const STRINGS = {
  en: {
    // affects panel (title + column headers)
    'aff.title': 'Affects on you',
    'aff.pro': 'Prot',
    'aff.det': 'Detect',
    'aff.trv': 'Travel',
    'aff.enh': 'Boost',
    'aff.mal': 'Curse',
    'aff.cln': 'Clan',
    // time & weather panel
    'tw.title': 'Weather & time',
    // group panel
    'grp.title': 'Group',
    'grp.name': 'Name',
    'grp.lvl': 'Lvl',
    'grp.health': 'Health',
    'grp.exp': 'Exp',
    // who panel
    'who.title': 'Online now',
    'who.name': 'Name',
    'who.race': 'Race',
    'who.clan': 'Clan',
    // player params panel
    'par.title': 'Your stats',
    'par.str': 'Str',
    'par.int': 'Int',
    'par.wis': 'Wis',
    'par.dex': 'Dex',
    'par.con': 'Con',
    'par.cha': 'Cha',
    'par.hit': 'Hit',
    'par.dam': 'Dam',
    'par.ac': 'AC',
    'par.save': 'Save',
    // location panel
    'loc.title': 'Your location',
    'loc.exits': 'exits:',
    // questor panel
    'qst.title': 'Questor task:',
    'qst.min': 'min',
    // command buttons
    'cmd.title': 'Commands',
    'cmd.look': 'Look',
    'cmd.inv': 'Inventory',
    'cmd.equip': 'Equipment',
    'cmd.score': 'Score',
    'cmd.recall': 'Recall',
    'cmd.flee': 'Flee',
    'cmd.practice': 'Practice',
    'cmd.magic': 'Spells',
    'cmd.skills': 'Skills',
    'cmd.quests': 'Quests',
    'cmd.quit': 'Quit',
    'cmd.quitConfirm': 'leave the world',
    // help search panel
    'help.title': 'Help search',
    'help.placeholder': 'Enter a keyword',
    'help.notFound': 'No help found',
    // vital bars
    'st.health': 'Health',
    'st.enemy': 'Enemy',
    'st.mana': 'Mana',
    'st.moves': 'Moves',
    // command input bar (ARIA + reconnect)
    'in.repeat': 'Repeat command',
    'in.next': 'Next command',
    'in.prev': 'Previous command',
    'in.reconnect': 'Reconnect',
    // overlay buttons (ARIA) + unread badge ("%d" = count)
    'ov.logs': 'logs',
    'ov.settings': 'settings',
    'ov.map': 'map',
    'ov.unread': '%d unread',
    // terminal
    'term.historyLoaded': 'CHAT HISTORY LOADED',
    // input placeholder hint ("%s" = example command)
    'ph.example': 'Type a command, e.g.: %s',
  },
  ru: {
    'aff.title': 'Воздействия на тебе',
    'aff.pro': 'Защита',
    'aff.det': 'Обнар',
    'aff.trv': 'Трансп',
    'aff.enh': 'Усилен',
    'aff.mal': 'Отриц',
    'aff.cln': 'Клан',
    'tw.title': 'Погода и время',
    'grp.title': 'Группа',
    'grp.name': 'Имя',
    'grp.lvl': 'Ур.',
    'grp.health': 'Здор.',
    'grp.exp': 'Опыт',
    'who.title': 'Сейчас в мире',
    'who.name': 'Имя',
    'who.race': 'Раса',
    'who.clan': 'Клан',
    'par.title': 'Твои параметры',
    'par.str': 'Сила',
    'par.int': 'Ум',
    'par.wis': 'Мудр',
    'par.dex': 'Ловк',
    'par.con': 'Слож',
    'par.cha': 'Обая',
    'par.hit': 'Точность',
    'par.dam': 'Урон',
    'par.ac': 'Броня',
    'par.save': 'Заклин',
    'loc.title': 'Твое местоположение',
    'loc.exits': 'выходы:',
    'qst.title': 'Задание квестора:',
    'qst.min': 'мин',
    'cmd.title': 'Команды',
    'cmd.look': 'Смотреть',
    'cmd.inv': 'Инвентарь',
    'cmd.equip': 'Одежда',
    'cmd.score': 'Счет',
    'cmd.recall': 'Возврат',
    'cmd.flee': 'Сбежать',
    'cmd.practice': 'Практика',
    'cmd.magic': 'Магия',
    'cmd.skills': 'Умения',
    'cmd.quests': 'Задания',
    'cmd.quit': 'Конец',
    'cmd.quitConfirm': 'покинуть мир',
    'help.title': 'Поиск по справке',
    'help.placeholder': 'Введи ключевое слово',
    'help.notFound': 'Справка не найдена',
    'st.health': 'Здоровье',
    'st.enemy': 'Противник',
    'st.mana': 'Мана',
    'st.moves': 'Шаги',
    'in.repeat': 'Повторить команду',
    'in.next': 'Следующая команда',
    'in.prev': 'Предыдущая команда',
    'in.reconnect': 'Переподключиться',
    'ov.logs': 'логи',
    'ov.settings': 'настройки',
    'ov.map': 'карта',
    'ov.unread': 'Непрочитано: %d',
    'term.historyLoaded': 'ИСТОРИЯ ЧАТА ЗАГРУЖЕНА',
    'ph.example': 'Введи команду, например: %s',
  },
  ua: {
    'aff.title': 'Впливи на тебе',
    'aff.pro': 'Захист',
    'aff.det': 'Виявл',
    'aff.trv': 'Трансп',
    'aff.enh': 'Підсил',
    'aff.mal': 'Негат',
    'aff.cln': 'Клан',
    'tw.title': 'Погода і час',
    'grp.title': 'Група',
    'grp.name': 'Імʼя',
    'grp.lvl': 'Рів.',
    'grp.health': 'Здор.',
    'grp.exp': 'Досв.',
    'who.title': 'Зараз у світі',
    'who.name': 'Імʼя',
    'who.race': 'Раса',
    'who.clan': 'Клан',
    'par.title': 'Твої параметри',
    'par.str': 'Сила',
    'par.int': 'Розум',
    'par.wis': 'Мудр',
    'par.dex': 'Сприт',
    'par.con': 'Статура',
    'par.cha': 'Харизма',
    'par.hit': 'Влучність',
    'par.dam': 'Шкода',
    'par.ac': 'Броня',
    'par.save': 'Чари',
    'loc.title': 'Твоє місцезнаходження',
    'loc.exits': 'виходи:',
    'qst.title': 'Завдання квестора:',
    'qst.min': 'хв',
    'cmd.title': 'Команди',
    'cmd.look': 'Дивитись',
    'cmd.inv': 'Інвентар',
    'cmd.equip': 'Одяг',
    'cmd.score': 'Стан',
    'cmd.recall': 'Поверн.',
    'cmd.flee': 'Втекти',
    'cmd.practice': 'Практика',
    'cmd.magic': 'Магія',
    'cmd.skills': 'Уміння',
    'cmd.quests': 'Завдання',
    'cmd.quit': 'Вихід',
    'cmd.quitConfirm': 'покинути світ',
    'help.title': 'Пошук у довідці',
    'help.placeholder': 'Введи ключове слово',
    'help.notFound': 'Довідку не знайдено',
    'st.health': 'Здоровʼя',
    'st.enemy': 'Ворог',
    'st.mana': 'Мана',
    'st.moves': 'Кроки',
    'in.repeat': 'Повторити команду',
    'in.next': 'Наступна команда',
    'in.prev': 'Попередня команда',
    'in.reconnect': 'Перепідключитися',
    'ov.logs': 'логи',
    'ov.settings': 'налаштування',
    'ov.map': 'карта',
    'ov.unread': 'Непрочитано: %d',
    'term.historyLoaded': 'ІСТОРІЯ ЧАТУ ЗАВАНТАЖЕНА',
    'ph.example': 'Введи команду, наприклад: %s',
  },
};

// t(key, lang?) -- look up a UI string. `lang` defaults to the current display language.
// Falls back to English, then to the key itself, so a missing translation degrades
// visibly-but-safely instead of throwing. Placeholders "%d"/"%s" are substituted via fmt().
export function t(key, lang) {
  const l = lang || currentLang;
  const table = STRINGS[l] || STRINGS.en;
  if (table[key] != null) return table[key];
  if (STRINGS.en[key] != null) return STRINGS.en[key];
  return key;
}

// fmt(key, value, lang?) -- t() with the first "%d"/"%s" placeholder replaced by `value`.
export function fmt(key, value, lang) {
  return t(key, lang).replace(/%[ds]/, value);
}
