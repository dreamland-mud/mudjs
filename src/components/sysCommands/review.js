import { parseStringCmd, echoHtml, clickableLink } from '../sysCommandUtils';
import { t } from '../../i18n';
import { reviewEnabled, setReviewEnabled, IS_MAC } from '../../review';

export const reviewHelp = {
  title: `Включить или выключить чтение вывода для программ экранного доступа, подробнее ${clickableLink('#help review')}`,
  description: `Когда чтение вывода включено, Tab в командной строке переносит в текст вывода игры. Стрелки вверх и вниз читают его по строкам, Enter выполняет команду в строке, Tab, Shift+Tab или Escape возвращают в командную строку.

Синтаксис:
#review      - сказать, включено ли
#review on   - включить
#review off  - выключить

Пока чтение вывода включено, Alt со стрелками читает чат (кроме Mac).

Настройка запоминается в этом браузере. Если в игре включить config screenreader, чтение вывода включится само, а выключить -- выключится.

`,
};

const reviewCmd = value => {
  const arg = (parseStringCmd(value)[0] || '').toLowerCase();
  if (arg === 'on' || arg === 'off') setReviewEnabled(arg === 'on');
  else if (arg) return echoHtml(t('rv.cmd.usage'));
  const on = reviewEnabled();
  echoHtml(t(on ? 'rv.cmd.on' : 'rv.cmd.off') + (IS_MAC ? '' : ' ' + t(on ? 'rv.cmd.chat.on' : 'rv.cmd.chat.off')));
};

export default reviewCmd;
