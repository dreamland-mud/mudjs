import { parseStringCmd, echoHtml, clickableLink } from '../SysCommands';
import { send } from '../../websock';

export const actionHelp = {
  title: `Создать пользовательский триггер, подробнее ${clickableLink(
    '#help action'
  )}`,
  description: `Команда ${clickableLink(
    '#action'
  )} позволяет создавать/удалять/изменять пользовательские триггеры для событий в игре.
Синтаксис:
#action -- список всех триггеров
#action {trigger} {action} {priority} -- создать пользовательский триггер с действием {action} для события {trigger} с приоритетом {priority}. {priority} может быть от 0 до 9 (необязательный параметр, по умолчанию 5)
#action string -- вывести список триггеров совпадающих со строкой 'string'
#action string delete|удалить -- удалить все триггеры совпадающие со строкой 'string'
#action {trigger} delete|удалить -- удалить указанный триггер
#action {trigger} toggle|вкл|выкл -- включить или выключить указанный триггер без удаления

В триггере {trigger} могут быть использованы регулярные выражения. Можно определять переменные вида %1,%2,%3...%9 для дальнейшего использования в действиях {action}.  

Примеры использования:
#action {%1 пришел с севера} {say hello %1}
#action {^Ты умираешь от голода|^Ты умираешь от жажды} {взять бочон сумка|пить боч|пить боч|пить боч|положить боч сумка}
#action {%1 пришел с севера} toggle
`,
};

const actionAdd = actionArr => {
  const actionsStorage = localStorage.actions
    ? JSON.parse(localStorage.actions)
    : {};
  const trigger = actionArr[0].slice(1, -1);
  const action = actionArr[1].slice(1, -1);
  const rePrior = /{\d{1}}/gm;
  let priority = 5;
  if (actionArr[2]) {
    if (!actionArr[2].match(rePrior))
      return echoHtml(
        `Приоритет должен быть числом от 0 до 9. Набери ${clickableLink(
          '#help action'
        )} для справки.\n`
      );
    priority = parseInt(actionArr[2].slice(1, -1));
  }
  actionsStorage[trigger] = {
    action: action,
    priority: priority,
    enabled: true,
  };
  localStorage.actions = JSON.stringify(actionsStorage);
  echoHtml(` {${trigger}} добавлен в список триггеров. \n`);
};

const actionsListShow = string => {
  const actionsStorage = localStorage.actions
    ? JSON.parse(localStorage.actions)
    : {};
  if (Object.keys(actionsStorage).length === 0)
    return echoHtml(
      `Список действий пуст. Набери ${clickableLink(
        '#help action'
      )} для справки.\n`
    );
  let actionsList = 'Список действий: \n';
  for (let i in actionsStorage) {
    if (!string || i.match(new RegExp(string, 'g'))) {
      const item = actionsStorage[i];
      actionsList += `    {${i}} : {${item.action}} {${item.priority}} [${
        item.enabled ? 'вкл' : 'выкл'
      }]\n`;
    }
  }
  return echoHtml(actionsList + '\n');
};

const actionShow = trigger => {
  const actionsStorage = localStorage.actions
    ? JSON.parse(localStorage.actions)
    : {};
  if (!actionsStorage[trigger.slice(1, -1)])
    return echoHtml(
      `Триггер не найден. Для просмотра всех сохраненых действий введи ${clickableLink(
        '#action'
      )}.\n`
    );
  const t = trigger.slice(1, -1);
  const item = actionsStorage[t];
  echoHtml(
    `    {${t}} : {${item.action}} {${item.priority}} [${
      item.enabled ? 'вкл' : 'выкл'
    }]\n`
  );
};

const actionDelete = value => {
  const actionsStorage = localStorage.actions
    ? JSON.parse(localStorage.actions)
    : {};
  const trigger = value.slice(1, -1);
  if (actionsStorage[trigger]) {
    delete actionsStorage[trigger];
    localStorage.actions = JSON.stringify(actionsStorage);
    echoHtml(` {${trigger}} удален из списка.\n`);
    return;
  }
  return echoHtml(`Такой триггер не задан.\n`);
};

const actionDeleteOnMask = value => {
  const actionsStorage = localStorage.actions
    ? JSON.parse(localStorage.actions)
    : {};
  const deleteIndex = value.lastIndexOf(' ');
  const trigger = value.substring(0, deleteIndex);
  const re = new RegExp(trigger, 'g');
  let i = 0;
  for (let key in actionsStorage) {
    if (key.match(re)) {
      delete actionsStorage[key];
      i++;
    }
  }
  localStorage.actions = JSON.stringify(actionsStorage);
  return echoHtml(
    i > 0
      ? `Все совпавшие триггеры удалены.\n`
      : `Совпавших триггеров не найдено.\n`
  );
};

const actionToggle = value => {
  const actionsStorage = localStorage.actions
    ? JSON.parse(localStorage.actions)
    : {};
  const trigger = value.slice(1, -1);
  if (actionsStorage[trigger]) {
    actionsStorage[trigger].enabled = !actionsStorage[trigger].enabled;
    localStorage.actions = JSON.stringify(actionsStorage);
    echoHtml(
      ` {${trigger}} ${
        actionsStorage[trigger].enabled ? 'включен' : 'выключен'
      }\n`
    );
    return;
  }
  return echoHtml(`Такой триггер не задан.\n`);
};

const actionCmd = value => {
  const stringCmd = parseStringCmd(value);
  const actionArr = parseActionCmd(value);
  if (value.toString().startsWith('{')) {
    if (actionArr.length === 1) {
      const last = stringCmd[stringCmd.length - 1];
      if (last === 'delete' || last === 'удалить')
        return actionDelete(actionArr[0]);
      if (last === 'toggle' || last === 'вкл' || last === 'выкл')
        return actionToggle(actionArr[0]);
      return actionShow(actionArr[0]);
    }
    if (actionArr.length >= 2) return actionAdd(actionArr);
    return echoHtml(
      `Некорректная команда. Введи ${clickableLink(
        '#help action'
      )} для получения справки.\n`
    );
  }
  if (!stringCmd[0]) return actionsListShow();
  if (stringCmd.length > 1) {
    const last = stringCmd[stringCmd.length - 1];
    if (last === 'delete' || last === 'удалить')
      return actionDeleteOnMask(value);
  }
  if (stringCmd[0] && !actionArr?.length) return actionsListShow(stringCmd);
  return echoHtml(
    `Некорректная команда. Введи ${clickableLink(
      '#help action'
    )} для получения справки.\n`
  );
};

export default actionCmd;

const parseActionCmd = value => {
  const re = /{(.*?)}/gm;
  const actionArr = value.match(re);
  return actionArr;
};

const sortByPriorities = (a, b) => {
  return a.priority - b.priority;
};

export function processTriggers(line) {
  const actionsStorage = localStorage.actions
    ? JSON.parse(localStorage.actions)
    : {};
  const regexpActionShow = /^\s*{|^\s*#\b/gm;
  const regexpVariable = /%\d{1}\b/gm;
  const actionArray = [];

  for (let trigger in actionsStorage) {
    const config = actionsStorage[trigger];
    if (!config.enabled) continue;

    const variableArr = [...trigger.matchAll(regexpVariable)];
    if (variableArr[0]) {
      let i = 1;
      const valList = {};
      const tmpTrigger = trigger.replace(/%\d{1}\b/gm, '(\\S+)');
      const reVal = new RegExp(tmpTrigger, 'gm');
      if (line.match(tmpTrigger) && !line.match(regexpActionShow)) {
        const valArray = [...line.matchAll(reVal)];
        if (valArray[0]) {
          variableArr.forEach(item => {
            valList[item] = valArray[0][i];
            i++;
          });
          let action = config['action'];
          for (let i in valList) {
            const re = new RegExp(i, 'g');
            action = action.replace(re, valList[i]);
          }
          actionArray.push({
            priority: config['priority'],
            action: action,
          });
        }
      }
    } else {
      const re = new RegExp(trigger, 'g');
      if (line.match(re) && !line.match(regexpActionShow)) {
        actionArray.push({
          priority: config['priority'],
          action: config['action'],
        });
      }
    }
  }

  if (actionArray.length > 0) {
    actionArray.sort(sortByPriorities);
    actionArray.forEach(item => send(item.action));
  }
}
