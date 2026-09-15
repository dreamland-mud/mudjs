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

// Seed from the browser's remembered choice so the UI chrome opens in the right
// language instead of flashing English until the first prompt arrives. The
// server still overrides it on every prompt (below), and we persist that value
// back so the memory survives reloads and follows an in-game `config lang`.
function readSavedLang() {
  try {
    return localStorage.getItem('mudjs.lang');
  } catch (e) {
    return null; // localStorage unavailable (private mode) -- fall back to EN
  }
}

let currentLang = readSavedLang() || 'en';

$(function () {
  $('#rpc-events').on('rpc-prompt', function (e, b) {
    if (b && b.lang != null) {
      currentLang = b.lang;
      try {
        localStorage.setItem('mudjs.lang', b.lang);
      } catch (e2) {
        /* ignore: private mode / storage disabled */
      }
    }
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
    'cmd.autobuff': 'Autobuff',
    'cmd.skills': 'Skills',
    'cmd.quests': 'Quests',
    'cmd.commands': 'Commands',
    'cmd.quit': 'Quit',
    'cmd.quitConfirm': 'Really leave the world?',
    // help search panel
    'help.title': 'Help search',
    'help.placeholder': 'Enter a keyword',
    'help.notFound': 'No help found',
    'help.openMap': 'open the map',
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
    // Echo verbs for clickable links. The command SENT is always the canonical
    // English one; these are only what gets echoed into the player's own
    // scrollback, so they follow the display language the way a typed command
    // would. Values mirror <name l="..."> in dreamland_world/commands. Kept in
    // their own "echo." namespace: as "cmd.look" they silently overwrote the
    // panel button label of the same key, since a later key wins in an object
    // literal.
    'echo.read': 'read',
    'echo.look': 'look',
    'echo.help': 'help',
    'echo.glist': 'glist',
    'echo.run': 'run',
    // settings window
    'cfg.title': 'Settings',
    'cfg.close': 'Close',
    'cfg.log.download': 'Download log',
    'cfg.back': 'Back',
    'cfg.search': 'Search settings',
    'cfg.help': 'What this does',
    'cfg.off': 'off',
    'cfg.clear': 'clear',
    'cfg.resize': 'Drag to resize',
    'cfg.copy': 'copy',
    'cfg.copied': 'copied',
    'cfg.nothing': 'Nothing matches that.',
    'cfg.echo.idle': 'Settings apply immediately',
    'cfg.asking': 'Asking the server what it can do...',
    'cfg.asking.page': 'Just a moment',
    'cfg.yes': 'yes',
    'cfg.no': 'no',
    'cfg.missing.title': 'Server settings',
    'cfg.missing.page': 'Not available',
    'cfg.offline.page': 'Not in the game yet',
    'cfg.offline.text':
      'Log into the game and its settings will appear here.',
    'cfg.missing.text':
      'This game server cannot hand out its settings yet. Change them with the "config" command in the game.',
    'cfg.section.ext': 'Extensions',
    'cfg.page.script': 'Custom script',
    'cfg.section.account': 'Account',
    'cfg.page.account': 'My account',
    'acct.heroes': 'Your characters',
    'acct.methods': 'Login methods',
    'acct.current': 'in the world now',
    'acct.online': 'online',
    'acct.switch': 'Enter',
    'acct.no_account': 'This character is not linked to an account yet.',
    'acct.link_hint': 'Link one with the account link command in the terminal.',
    'acct.manual': 'Switch to another character',
    'acct.manual_ph': 'character name',
    'acct.list': 'List my characters in the terminal',
    'acct.refresh': 'Refresh',
    'acct.loading': 'Loading…',
    'cfg.save.note': 'Applied after saving',
    'cfg.save': 'Save',
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
    'cmd.autobuff': 'Автобафф',
    'cmd.skills': 'Умения',
    'cmd.quests': 'Задания',
    'cmd.commands': 'Команды',
    'cmd.quit': 'Конец',
    'cmd.quitConfirm': 'Действительно хочешь покинуть мир?',
    'help.title': 'Поиск по справке',
    'help.placeholder': 'Введи ключевое слово',
    'help.notFound': 'Справка не найдена',
    'help.openMap': 'открыть карту',
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
    'echo.read': 'читать',
    'echo.look': 'смотреть',
    'echo.help': 'помощь',
    'echo.glist': 'группаумений',
    'echo.run': 'бежать',
    // settings window
    'cfg.title': 'Настройки',
    'cfg.close': 'Закрыть',
    'cfg.log.download': 'Скачать лог',
    'cfg.back': 'Назад',
    'cfg.search': 'Поиск настроек',
    'cfg.help': 'Что это делает',
    'cfg.off': 'выкл',
    'cfg.clear': 'очистить',
    'cfg.resize': 'Потяни, чтобы изменить ширину',
    'cfg.copy': 'копировать',
    'cfg.copied': 'скопировано',
    'cfg.nothing': 'Ничего не нашлось.',
    'cfg.echo.idle': 'Настройки применяются сразу',
    'cfg.asking': 'Спрашиваем сервер, что он умеет...',
    'cfg.asking.page': 'Минутку',
    'cfg.yes': 'да',
    'cfg.no': 'нет',
    'cfg.missing.title': 'Настройки сервера',
    'cfg.missing.page': 'Недоступны',
    'cfg.offline.page': 'Ты ещё не в игре',
    'cfg.offline.text':
      'Зайди в мир, и настройки игры появятся здесь.',
    'cfg.missing.text':
      'Этот игровой сервер пока не умеет отдавать настройки. Меняй их командой «режим» в игре.',
    'cfg.section.ext': 'Расширения',
    'cfg.page.script': 'Свой скрипт',
    'cfg.section.account': 'Аккаунт',
    'cfg.page.account': 'Мой аккаунт',
    'acct.heroes': 'Твои персонажи',
    'acct.methods': 'Способы входа',
    'acct.current': 'сейчас в игре',
    'acct.online': 'в сети',
    'acct.switch': 'Войти',
    'acct.no_account': 'Этот персонаж ещё не привязан к аккаунту.',
    'acct.link_hint': 'Привяжи командой account link в терминале.',
    'acct.manual': 'Переключиться на другого персонажа',
    'acct.manual_ph': 'имя персонажа',
    'acct.list': 'Показать моих персонажей в терминале',
    'acct.refresh': 'Обновить',
    'acct.loading': 'Загрузка…',
    'cfg.save.note': 'Применяется после сохранения',
    'cfg.save': 'Сохранить',
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
    'cmd.autobuff': 'Автобаф',
    'cmd.skills': 'Уміння',
    'cmd.quests': 'Завдання',
    'cmd.commands': 'Команди',
    'cmd.quit': 'Вихід',
    'cmd.quitConfirm': 'Справді хочеш покинути світ?',
    'help.title': 'Пошук у довідці',
    'help.placeholder': 'Введи ключове слово',
    'help.notFound': 'Довідку не знайдено',
    'help.openMap': 'відкрити мапу',
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
    'echo.read': 'читати',
    'echo.look': 'дивитися',
    'echo.help': 'допомога',
    'echo.glist': 'групавмінь',
    'echo.run': 'бігти',
    // settings window
    'cfg.title': 'Налаштування',
    'cfg.close': 'Закрити',
    'cfg.log.download': 'Завантажити лог',
    'cfg.back': 'Назад',
    'cfg.search': 'Пошук налаштувань',
    'cfg.help': 'Що це робить',
    'cfg.off': 'вимк',
    'cfg.clear': 'очистити',
    'cfg.resize': 'Потягни, щоб змінити ширину',
    'cfg.copy': 'копіювати',
    'cfg.copied': 'скопійовано',
    'cfg.nothing': 'Нічого не знайшлося.',
    'cfg.echo.idle': 'Налаштування застосовуються одразу',
    'cfg.asking': 'Питаємо сервер, що він уміє...',
    'cfg.asking.page': 'Хвилинку',
    'cfg.yes': 'так',
    'cfg.no': 'ні',
    'cfg.missing.title': 'Налаштування сервера',
    'cfg.missing.page': 'Недоступні',
    'cfg.offline.page': 'Ти ще не у грі',
    'cfg.offline.text':
      'Увійди у світ, і налаштування гри з\'являться тут.',
    'cfg.missing.text':
      'Цей ігровий сервер поки не вміє віддавати налаштування. Змінюй їх командою «режим» у грі.',
    'cfg.section.ext': 'Розширення',
    'cfg.page.script': 'Власний скрипт',
    'cfg.section.account': 'Акаунт',
    'cfg.page.account': 'Мій акаунт',
    'acct.heroes': 'Твої персонажі',
    'acct.methods': 'Способи входу',
    'acct.current': 'зараз у грі',
    'acct.online': 'у мережі',
    'acct.switch': 'Увійти',
    'acct.no_account': 'Цей персонаж ще не привʼязаний до акаунту.',
    'acct.link_hint': 'Привʼяжи командою account link у терміналі.',
    'acct.manual': 'Перемкнутися на іншого персонажа',
    'acct.manual_ph': 'імʼя персонажа',
    'acct.list': 'Показати моїх персонажів у терміналі',
    'acct.refresh': 'Оновити',
    'acct.loading': 'Завантаження…',
    'cfg.save.note': 'Застосовується після збереження',
    'cfg.save': 'Зберегти',
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
