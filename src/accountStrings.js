// Strings for the /newui account / master-login panel. Kept as a small
// self-contained table (not folded into the big i18n STRINGS yet) so the
// account feature stays isolated while it is prototyped -- move into i18n.js
// once the design lands. Language comes from the same source as the rest of
// the chrome (i18n getLang(), backed by localStorage 'mudjs.lang').
import { getLang } from './i18n';

const STRINGS = {
  en: {
    create_char: 'Create new character',
    pathA: 'Log in with your character',
    name: 'Character name',
    password: 'Character password',
    enter: 'Enter',
    pathB: 'Log in with your account',
    via_email: 'E-mail',
    via_discord: 'Discord',
    via_telegram: 'Telegram',
    roster: 'Choose your hero',
    entering: 'Entering…',
    authenticating: 'Authenticating…',
    email_ph: 'your e-mail',
    code_ph: '6-digit code',
    send_code: 'Send code',
    verify: 'Verify',
    fail: 'Check your name or password',
    lang: 'Language',
    back: 'Back',
  },
  ru: {
    create_char: 'Создать нового персонажа',
    pathA: 'Войти своим персонажем',
    name: 'Имя персонажа',
    password: 'Пароль персонажа',
    enter: 'Войти',
    pathB: 'Войти аккаунтом',
    via_email: 'E-mail',
    via_discord: 'Discord',
    via_telegram: 'Telegram',
    roster: 'Выбери героя',
    entering: 'Вход…',
    authenticating: 'Аутентификация…',
    email_ph: 'твоя почта',
    code_ph: '6-значный код',
    send_code: 'Отправить код',
    verify: 'Проверить',
    fail: 'Проверь имя или пароль',
    lang: 'Язык',
    back: 'Назад',
  },
  ua: {
    create_char: 'Створити нового персонажа',
    pathA: 'Увійти своїм персонажем',
    name: 'Імʼя персонажа',
    password: 'Пароль персонажа',
    enter: 'Увійти',
    pathB: 'Увійти акаунтом',
    via_email: 'E-mail',
    via_discord: 'Discord',
    via_telegram: 'Telegram',
    roster: 'Обери героя',
    entering: 'Вхід…',
    authenticating: 'Автентифікація…',
    email_ph: 'твоя пошта',
    code_ph: '6-значний код',
    send_code: 'Надіслати код',
    verify: 'Перевірити',
    fail: 'Перевір імʼя або пароль',
    lang: 'Мова',
    back: 'Назад',
  },
};

// at(key, lang?) -- account-panel string, defaulting to the current UI language,
// falling back to English then to the key (same contract as i18n t()).
export function at(key, lang) {
  const l = lang || getLang();
  const table = STRINGS[l] || STRINGS.en;
  if (table[key] != null) return table[key];
  if (STRINGS.en[key] != null) return STRINGS.en[key];
  return key;
}

export const LANGS = [
  { code: 'ua', label: 'Українська' },
  { code: 'en', label: 'English' },
  { code: 'ru', label: 'Русский' },
];
