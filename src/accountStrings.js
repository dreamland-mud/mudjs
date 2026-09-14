// Strings for the /newui account / master-login panel. Kept as a small
// self-contained table (not folded into the big i18n STRINGS yet) so the
// account feature stays isolated while it is prototyped -- move into i18n.js
// once the design lands. Language comes from the same source as the rest of
// the chrome (i18n getLang(), backed by localStorage 'mudjs.lang').
import { getLang } from './i18n';

const STRINGS = {
  en: {
    subtitle: 'Enter the World of Dreams',
    pathA: 'Log in as a character',
    name: 'Name',
    password: 'Password',
    enter: 'Enter',
    pathB: 'Log in with your account',
    pathB_hint: 'One login, every hero you own',
    via_email: 'E-mail code',
    via_discord: 'Discord',
    via_telegram: 'Telegram',
    roster: 'Choose your hero',
    entering: 'Entering…',
    authenticating: 'Authenticating…',
    email_ph: 'your e-mail',
    code_ph: '6-digit code',
    send_code: 'Send code',
    verify: 'Verify',
    new_hero: 'New hero? Create one in the terminal',
    fail: 'Check your name or password',
    prototype: 'prototype · backend pending',
    lang: 'Language',
    back: 'Back',
  },
  ru: {
    subtitle: 'Войди в Мир Мечты',
    pathA: 'Войти персонажем',
    name: 'Имя',
    password: 'Пароль',
    enter: 'Войти',
    pathB: 'Войти аккаунтом',
    pathB_hint: 'Один вход — все твои герои',
    via_email: 'E-mail код',
    via_discord: 'Discord',
    via_telegram: 'Telegram',
    roster: 'Выбери героя',
    entering: 'Вход…',
    authenticating: 'Аутентификация…',
    email_ph: 'твоя почта',
    code_ph: '6-значный код',
    send_code: 'Отправить код',
    verify: 'Проверить',
    new_hero: 'Новый герой? Создай его в терминале',
    fail: 'Проверь имя или пароль',
    prototype: 'прототип · бэкенд в разработке',
    lang: 'Язык',
    back: 'Назад',
  },
  ua: {
    subtitle: 'Увійди у Світ Мрій',
    pathA: 'Увійти персонажем',
    name: 'Імʼя',
    password: 'Пароль',
    enter: 'Увійти',
    pathB: 'Увійти акаунтом',
    pathB_hint: 'Один вхід — усі твої герої',
    via_email: 'E-mail код',
    via_discord: 'Discord',
    via_telegram: 'Telegram',
    roster: 'Обери героя',
    entering: 'Вхід…',
    authenticating: 'Автентифікація…',
    email_ph: 'твоя пошта',
    code_ph: '6-значний код',
    send_code: 'Надіслати код',
    verify: 'Перевірити',
    new_hero: 'Новий герой? Створи його в терміналі',
    fail: 'Перевір імʼя або пароль',
    prototype: 'прототип · бекенд у розробці',
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
  { code: 'ru', label: 'Русский' },
  { code: 'en', label: 'English' },
];
