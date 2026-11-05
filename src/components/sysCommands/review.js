import { parseStringCmd, echoHtml, clickableLink } from '../sysCommandUtils';
import { t } from '../../i18n';
import { reviewEnabled, setReviewEnabled } from '../../review';

export const reviewHelp = {
  title: `Включить или выключить чтение вывода для программ экранного доступа, подробнее ${clickableLink('#help review')}`,
  description: `Когда чтение вывода включено, Tab в командной строке переносит в текст вывода игры. Стрелки вверх и вниз читают его по строкам, Enter выполняет команду в строке, Tab, Shift+Tab или Escape возвращают в командную строку.

Синтаксис:
#review      - сказать, включено ли
#review on   - включить
#review off  - выключить

Настройка запоминается в этом браузере.

`,
};

const reviewCmd = value => {
  const arg = (parseStringCmd(value)[0] || '').toLowerCase();
  if (arg === 'on' || arg === 'off') setReviewEnabled(arg === 'on');
  else if (arg) return echoHtml(t('rv.cmd.usage'));
  echoHtml(t(reviewEnabled() ? 'rv.cmd.on' : 'rv.cmd.off'));
};

export default reviewCmd;
