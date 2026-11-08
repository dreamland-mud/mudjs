import { parseStringCmd, echoHtml, clickableLink } from '../sysCommandUtils';
import { t } from '../../i18n';
import { setReviewEnabled, reviewStateText } from '../../review';
import { st } from './strings';

export const reviewHelp = {
  get title() { return st('sys.rv.title', clickableLink('#help review')); },
  get description() { return st('sys.rv.desc'); },
};

const reviewCmd = value => {
  const arg = (parseStringCmd(value)[0] || '').toLowerCase();
  if (arg === 'on' || arg === 'off') setReviewEnabled(arg === 'on');
  else if (arg) return echoHtml(t('rv.cmd.usage'));
  echoHtml(reviewStateText());
};

export default reviewCmd;
