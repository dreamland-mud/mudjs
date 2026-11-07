/* Texts of the #-commands (#help, #hotkey, #action, #var, #delete, #settings,
 * #autobuff, #review, #N), in the player's display language. Help texts are
 * read when shown, so a language switch reaches them without a reload.
 *
 * st(key, ...args) is tf() from i18n.js: it fills each %s in turn. Arguments
 * are HTML: links made with clickableLink() go in as they are. Game command words in the examples are
 * the game's own names for each language (dreamland_world commands/*.xml). */
import { addStrings, tf } from '../../i18n';

export const st = tf;

addStrings({
  en: {
    'sys.nocmd': 'There is no such command. Type %s for the list of commands.\n',
    'sys.forhelp': 'Type %s for help.\n',

    'sys.help.title': 'Help on the built-in commands, more: %s',
    'sys.help.desc': `The %s command shows help on the built-in commands.
Syntax:
#help         - list the commands
#help command - detailed help on one command
\n`,
    'sys.help.list': 'Built-in commands:\n',

    'sys.multi.title': 'Run a command several times, more: %s',
    'sys.multi.desc': `Syntax:
#number action - run the command action number times

Examples:
#10 news
#3 flee|recall

`,

    'sys.var.title': 'Create a variable with a value, more: %s',
    'sys.var.desc': `The %s command creates variables.
Syntax:
#var                - list your variables
#var variable       - show the value of variable
#var variable value - set variable to value
#var variable delete - delete variable

A name starts with a letter and may hold English, Russian and Ukrainian letters, digits and the underscore. Good names: victim, my_enemy, food1, враг

Variables are handy inside hotkey commands: write a dollar sign before the name.
#var food pie
#hotkey f1 eat $food
Now f1 runs 'eat pie'.

`,
    'sys.var.badname': 'That name will not do for a variable. Type %s for help.\n',
    'sys.var.set': "Variable '%s' now means '%s'.\n",
    'sys.var.deleted': 'Variable %s deleted.\n',
    'sys.var.notset': 'No such variable.\n',
    'sys.var.notfound': 'Variable not found. Type %s to see all your variables.\n',
    'sys.var.empty': 'You have no variables. Type %s for help.\n',
    'sys.var.list': 'Your variables:\n',

    'sys.del.title': 'Delete hotkeys, variables and client settings, more: %s',
    'sys.del.desc': `The %s command deletes hotkeys, variables and client settings.
Syntax:
#delete                - list the stores you can delete from
#delete store          - list the records in store
#delete store record   - delete record from store
#delete store all      - delete every record in store

`,
    'sys.del.trigall': 'All triggers of this character deleted. Account triggers are deleted one by one.\n',
    'sys.del.norecord': 'Record not found. Type %s for the list of records.\n',
    'sys.del.deleted': '%s deleted.\n',
    'sys.del.nostore': 'Store not found. Type %s for the list of stores.\n',
    'sys.del.allgone': 'All records deleted from %s.\n',
    'sys.del.empty': '%s has no records.\n',
    'sys.del.records': 'Records you can delete:\n',
    'sys.del.stores': 'Stores you can delete records from:\n',

    'sys.set.title': 'Set or reset client settings, more: %s',
    'sys.set.desc': `The #settings command changes and remembers client settings.

Syntax:
#settings                - list the settings
#settings property       - reset property to its default
#settings property value - set property to value

Settings:
terminalLayoutWidth - width of the output window
panelLayoutWidth    - width of the panels window
mapLayoutWidth      - width of the map window
terminalFontSize    - font size of the output
isPgKeysScroll      - true: Page Up and Page Down scroll the output; false: they are free for hotkeys.

`,
    'sys.set.noparam': 'No such setting.\n',
    'sys.set.number': 'The value must be a number.\n',
    'sys.set.bool': 'The value must be true or false.\n',
    'sys.set.removed': 'Setting %s removed. The default comes back after the page reloads.\n',
    'sys.set.list': 'Client settings:\n',
    'sys.set.check': 'Check the command and try again.\n',

    'sys.hk.title': 'Bind a command to a hotkey, more: %s',
    'sys.hk.desc': `The %s command binds game commands to hotkeys.
Syntax:
#hotkey            - list your hotkeys
#hotkey key action - bind the command action to key
#hotkey key        - show every hotkey that starts with key
#hotkey key delete - delete a hotkey

action can be any game command, several of them too, separated by |.
Hotkeys are easiest to set in Settings (the gear at the top), Extensions, Macros. There you also see which belong to the character and which to the whole account.
For a key that needs JavaScript, use the keydown function in the custom script editor (the same gear).

key can be a lower-case letter, a digit, a punctuation sign, f1-f12, the keypad kp0-kp9, kp*, kp-, kp+, kp., kp/, the arrows up down left right, and ins del home end pgup pgdown.
ctrl, alt and shift can be combined, several at once: ctrl+a, alt+9, ctrl+shift+f1. Not every key and combination is free to use in a browser.

An example for keypad Down: on its own, go south; with alt, run south as far as you can; with shift, scan south.
#hotkey kp2 s
#hotkey alt+kp2 run S
#hotkey shift+kp2 scan s

A key that runs several commands at once:
#hotkey f1 flee | flee | recall

`,
    'sys.hk.mods': 'A key combination may only use ctrl, alt and shift.\n',
    'sys.hk.nokey': 'There is no key %s. %s',
    'sys.hk.deleted': 'Hotkey %s deleted.\n',
    'sys.hk.notset': 'No such hotkey.\n',
    'sys.hk.found': 'Hotkeys found:\n%sTo delete one, type #hotkey key delete.\n',
    'sys.hk.notdefined': 'Hotkey %s is not set. Type %s to see all your hotkeys.\n',
    'sys.hk.full': 'Your hotkey list is full.\n',
    'sys.hk.added': 'Command for %s added.\n',
    'sys.hk.exists': 'This key is already bound. Type %s to delete it.\n',
    'sys.hk.empty': 'You have no hotkeys. Type %s for help.\n',
    'sys.hk.list': 'Your hotkeys:\n',
    'sys.hk.scope.char': 'character',
    'sys.hk.scope.acct': 'account',
    'sys.hk.scope.local': 'this browser',

    'sys.act.title': 'Create a trigger, more: %s',
    'sys.act.desc': `The %s command creates, changes and deletes triggers on game events.
Syntax:
#action -- list all triggers
#action {trigger} {action} -- run action whenever the game shows trigger. The trigger is kept on the character and works from any device
#action string -- list the triggers that match 'string'
#action string delete -- delete every trigger that matches 'string'
#action {trigger} delete -- delete that trigger

A trigger may be a regular expression. %1 to %9 each take one word, to use in the action.

Sound, highlight and triggers for the whole account: Settings, Extensions, Triggers.

Example:
#action {^You are starving} {get barrel bag|drink barrel|drink barrel|drink barrel|put barrel bag}
`,
    'sys.act.priority': 'The priority must be a number from 0 to 9. Type %s for help.\n',
    'sys.act.added': ' {%s} added to your triggers.\n',
    'sys.act.added.server': ' {%s} added to your triggers. Sound and highlight: Settings, Extensions, Triggers.\n',
    'sys.act.badsearch': 'That search pattern does not work.\n',
    'sys.act.empty': 'You have no triggers. Type %s for help.\n',
    'sys.act.list': 'Your triggers:\n',
    'sys.act.off': 'off',
    'sys.act.notfound': 'Trigger not found. Type %s to see all your triggers.\n',
    'sys.act.notset': 'No such trigger.\n',
    'sys.act.deleted': ' {%s} deleted.\n',
    'sys.act.badmask': 'That pattern does not work.\n',
    'sys.act.nomatch': 'No triggers match.\n',
    'sys.act.alldeleted': 'All matching triggers deleted.\n',
    'sys.act.badcmd': 'That command is not right. Type %s for help.\n',

    'sys.ab.title': 'Your own autobuff lines, more: %s',
    'sys.ab.desc': `The autobuff button (the ~ key by default) casts every buff you know at 50% or more and do not have on you. The server works that part out by itself as you level and practise; it needs no setting.

The %s command adds YOUR lines, the ones the server cannot know: a buff from a pet, an order, anything.

Syntax:
#autobuff                     - show your list
#autobuff add affect command  - send command while you do not have affect
#autobuff add * command       - send command every time
#autobuff del N               - delete line number N
#autobuff clear               - clear the list

An affect is the English system name of the spell, as in cast: haste, sanctuary, fly.

Examples:
#autobuff add haste order rat c haste
#autobuff add sanctuary c sanctuary
#autobuff add * smile

These lines live only in this browser. Settings, Extensions, Autobuff is easier: there you can switch single buffs off, change their order and add your own lines to the character itself, and they work from any device and from the 'buff' command.

`,
    'sys.ab.empty': 'Your autobuff list is empty. Type %s for help.\n',
    'sys.ab.list': 'Your autobuff lines:\n',
    'sys.ab.always': 'always',
    'sys.ab.ifnot': "if no '%s'",
    'sys.ab.whilenot': "while you do not have '%s'",
    'sys.ab.added': 'Autobuff line added (%s): %s\n',
    'sys.ab.nonum': 'There is no line with that number. Type %s to see the list.\n',
    'sys.ab.deleted': 'Autobuff line deleted: %s\n',
    'sys.ab.cleared': 'Autobuff list cleared.\n',

    'sys.rv.title': 'Turn output review for screen readers on or off, more: %s',
    'sys.rv.desc': `With output review on, Tab in the command line moves into the game output. Up and Down read it line by line, Enter runs the command on the line, and Tab, Shift+Tab or Escape go back to the command line.

Syntax:
#review      - say whether it is on
#review on   - turn it on
#review off  - turn it off

While output review is on, Alt with the arrows reads the chat (not on a Mac).

The choice is remembered in this browser. Turning config screenreader on in the game turns output review on, and off turns it off.

`,
  },
  ru: {
    'sys.nocmd': 'Этой команды не существует, набери %s для получения списка доступных команд.\n',
    'sys.forhelp': 'Набери %s для справки.\n',

    'sys.help.title': 'Получить справку по встроенным командам, подробнее %s',
    'sys.help.desc': `Команда %s позволяет получить справку по встроенным командам.
Синтаксис:
#help         - вывести список доступных команд
#help command - подробная справка по команде command
\n`,
    'sys.help.list': 'Список доступных команд:\n',

    'sys.multi.title': 'Выполнить указанную команду несколько раз, подробнее %s',
    'sys.multi.desc': `Синтаксис:
#number action - выполнить команду action указанное число раз (number)

Примеры:
#10 новость
#3 сбежать|возврат

`,

    'sys.var.title': 'Позволяет создать переменную с указанным значением, подробнее %s',
    'sys.var.desc': `Команда %s позволяет создавать переменные.
Синтаксис:
#var                - вывести список заданных переменных
#var variable       - вывести значение переменной variable
#var variable value - задать значение value переменной variable
#var variable delete - удалить переменную variable

Имя переменной должно начинаться с буквы. В имени переменной могут быть использованы русские, украинские и английские буквы, цифры и символ нижнего подчеркивания. Пример правильного имени переменной: враг, victim, my_enemy, food1

Переменные удобно использовать внутри команд для горячих клавиш, перед именем переменной нужно написать знак доллара $:
#var еда пирог
#hotkey f1 есть $еда
После этого по нажатию клавиши f1 выполнится команда 'есть пирог'.

`,
    'sys.var.badname': 'Неподходящее имя переменной. Для дополнительной справки введи %s.\n',
    'sys.var.set': "Переменная '%s' теперь означает '%s'.\n",
    'sys.var.deleted': 'Переменная %s удалена из списка.\n',
    'sys.var.notset': 'Переменная не задана.\n',
    'sys.var.notfound': 'Переменная не найдена. Для просмотра всех сохраненных переменных введи %s.\n',
    'sys.var.empty': 'Список переменных пуст. Набери %s для справки.\n',
    'sys.var.list': 'Список переменных:\n',

    'sys.del.title': 'Позволяет удалять горячие клавиши, переменные и пользовательские настройки, подробнее %s',
    'sys.del.desc': `Команда %s позволяет удалять горячие клавиши, переменные и пользовательские настройки.
Синтаксис:
#delete                 - вывести список хранилищ, доступных для взаимодействия
#delete storage         - вывести список записей из storage, которые можно удалить
#delete storage record  - удалить запись record из хранилища storage
#delete storage all     - ключевое слово all позволяет удалить все записи из хранилища storage

`,
    'sys.del.trigall': 'Все триггеры персонажа удалены. Общие триггеры аккаунта удаляются по одному.\n',
    'sys.del.norecord': 'Запись не найдена, набери %s для списка записей.\n',
    'sys.del.deleted': '%s удалено.\n',
    'sys.del.nostore': 'Хранилище не найдено, набери %s для получения доступных хранилищ.\n',
    'sys.del.allgone': 'Все записи из %s удалены.\n',
    'sys.del.empty': 'В %s нет записей.\n',
    'sys.del.records': 'Список записей, доступных для удаления:\n',
    'sys.del.stores': 'Список хранилищ, из которых можно удалять записи:\n',

    'sys.set.title': 'Установить или сбросить пользовательские настройки, подробнее %s',
    'sys.set.desc': `Команда #settings позволяет изменять и запоминать пользовательские настройки.

Синтаксис:
#settings - вывести список доступных настроек
#settings property - удаляет текущий параметр property и сбрасывает его на значение "по умолчанию"
#settings property value - устанавливает значение value для параметра property

Список доступных настроек:
terminalLayoutWidth - ширина окна терминала
panelLayoutWidth    - ширина окна панели виджетов
mapLayoutWidth      - ширина окна карты
terminalFontSize    - размер шрифта в окне терминала
isPgKeysScroll      - использовать ли клавиши PgUp и PgDown для листания (true) или сделать их доступными для использования в качестве горячих клавиш (false).

`,
    'sys.set.noparam': 'Нет такого параметра.\n',
    'sys.set.number': 'Параметр должен быть числом.\n',
    'sys.set.bool': 'Параметр должен быть true или false.\n',
    'sys.set.removed': 'Параметр %s удален. После перезагрузки страницы будет использовано значение "по умолчанию".\n',
    'sys.set.list': 'Пользовательские настройки:\n',
    'sys.set.check': 'Проверьте правильность введенной команды.\n',

    'sys.hk.title': 'Присвоить команду для горячей клавиши, подробнее %s',
    'sys.hk.desc': `Команда %s позволяет назначать горячие клавиши для игровых команд.
Синтаксис:
#hotkey            - вывести список назначенных клавиш
#hotkey key action - привязать команду action к клавише key
#hotkey key        - показать все клавиши, начинающиеся с key
#hotkey key delete - удалить горячую клавишу

В качестве action могут использоваться любые игровые команды, в том числе перечисленные через разделитель команд |.
Удобнее всего задавать клавиши в настройках: шестеренка вверху экрана, Расширения, Макросы. Там же их видно для персонажа и для всего аккаунта.
Если нужно задать более сложные реакции на нажатую клавишу с использованием JavaScript, используйте функцию keydown в редакторе настроек (шестеренка вверху экрана).

В качестве key можно использовать маленькие буквы, цифры, знаки препинания, функциональные клавиши f1-f12, клавиши кейпада kp0-kp9, kp*, kp-, kp+, kp., kp/, стрелки up down left right, клавиши ins del home end pgup pgdown.
Доступны комбинации с участием ctrl, alt, shift, в том числе нескольких сразу. Например: ctrl+a, alt+9, ctrl+shift+f1. Далеко не все клавиши и комбинации удобны к использованию в браузере.

Пример для стрелки "вниз" на кейпаде: просто стрелка -- идти на юг, alt+стрелка -- бежать до упора на юг, shift+стрелка -- пристально смотреть на юг.
#hotkey kp2 ю
#hotkey alt+kp2 бежать Ю
#hotkey shift+kp2 всмотр ю

Пример клавиши, выполняющей несколько команд сразу:
#hotkey f1 сбежать | сбежать | возврат

`,
    'sys.hk.mods': 'В комбинации клавиш можно использовать только ctrl, alt и shift.\n',
    'sys.hk.nokey': 'Код клавиши %s не найден. %s',
    'sys.hk.deleted': 'Горячая клавиша %s удалена из списка.\n',
    'sys.hk.notset': 'Такая горячая клавиша не задана.\n',
    'sys.hk.found': 'Найдены такие горячие клавиши:\n%sДля удаления используй команду: #hotkey клавиша delete.\n',
    'sys.hk.notdefined': 'Горячая клавиша %s не задана. Для просмотра всех горячих клавиш введи %s.\n',
    'sys.hk.full': 'Список горячих клавиш уже полон.\n',
    'sys.hk.added': 'Команда для %s добавлена.\n',
    'sys.hk.exists': 'Этот ключ уже существует, набери %s для удаления.\n',
    'sys.hk.empty': 'Список горячих клавиш пуст. Набери %s для справки.\n',
    'sys.hk.list': 'Список горячих клавиш:\n',
    'sys.hk.scope.char': 'персонаж',
    'sys.hk.scope.acct': 'аккаунт',
    'sys.hk.scope.local': 'этот браузер',

    'sys.act.title': 'Создать пользовательский триггер, подробнее %s',
    'sys.act.desc': `Команда %s позволяет создавать/удалять/изменять пользовательские триггеры для событий в игре.
Синтаксис:
#action -- список всех триггеров
#action {trigger} {action} -- создать пользовательский триггер с действием {action} для события {trigger}. Триггер хранится на персонаже и работает с любого устройства
#action string -- вывести список триггеров, совпадающих со строкой 'string'
#action string delete|удалить -- удалить все триггеры, совпадающие со строкой 'string'
#action {trigger} delete|удалить -- удалить указанный триггер

В триггере {trigger} могут быть использованы регулярные выражения. Можно определять переменные вида %1,%2,%3...%9 для дальнейшего использования в действиях {action}.

Звук, подсветку и общие для всего аккаунта триггеры настраивай в Настройки -> Расширения -> Триггеры.

Примеры использования:
#action {%1 пришел с севера} {say hello %1}
#action {^Ты умираешь от голода|^Ты умираешь от жажды} {взять бочон сумка|пить боч|пить боч|пить боч|положить боч сумка}
`,
    'sys.act.priority': 'Приоритет должен быть числом от 0 до 9. Набери %s для справки.\n',
    'sys.act.added': ' {%s} добавлен в список триггеров.\n',
    'sys.act.added.server': ' {%s} добавлен в список триггеров. Звук и подсветка: Настройки -> Расширения -> Триггеры.\n',
    'sys.act.badsearch': 'Некорректный шаблон поиска.\n',
    'sys.act.empty': 'Список триггеров пуст. Набери %s для справки.\n',
    'sys.act.list': 'Список триггеров:\n',
    'sys.act.off': 'выкл',
    'sys.act.notfound': 'Триггер не найден. Для просмотра всех триггеров введи %s.\n',
    'sys.act.notset': 'Такой триггер не задан.\n',
    'sys.act.deleted': ' {%s} удален из списка.\n',
    'sys.act.badmask': 'Некорректный шаблон.\n',
    'sys.act.nomatch': 'Совпавших триггеров не найдено.\n',
    'sys.act.alldeleted': 'Все совпавшие триггеры удалены.\n',
    'sys.act.badcmd': 'Некорректная команда. Введи %s для получения справки.\n',

    'sys.ab.title': 'Настроить свои строки автобаффа, подробнее %s',
    'sys.ab.desc': `Кнопка автобаффа (по умолчанию клавиша ~) накладывает все доступные тебе усиления, которые ты знаешь на 50%+ и которых на тебе еще нет. Серверная часть считается сама и обновляется с уровнем и практикой -- ее настраивать не нужно.

Команда %s добавляет ТВОИ строки, которые сервер знать не может: баф от питомца, приказ, что угодно.

Синтаксис:
#autobuff                     - показать свой список
#autobuff add аффект команда  - слать команду, пока этого аффекта нет на тебе
#autobuff add * команда       - слать команду всегда, по каждому нажатию
#autobuff del N               - удалить строку номер N
#autobuff clear               - очистить весь список

Аффект пишется английским системным именем заклинания, как в касте: haste, sanctuary, fly.

Примеры:
#autobuff add haste order rat c haste
#autobuff add sanctuary c sanctuary
#autobuff add * улыбка

Эти строки живут только в этом браузере. Удобнее настроить все во вкладке Настройки -> Расширения -> Автобафф: там можно выключить отдельные баффы, поменять порядок и добавить свои строки прямо персонажу, и они сработают с любого устройства и из команды 'buff'.

`,
    'sys.ab.empty': 'Твой список автобаффа пуст. Набери %s для справки.\n',
    'sys.ab.list': 'Твои строки автобаффа:\n',
    'sys.ab.always': 'всегда',
    'sys.ab.ifnot': "если нет '%s'",
    'sys.ab.whilenot': "пока нет аффекта '%s'",
    'sys.ab.added': 'Строка автобаффа добавлена (%s): %s\n',
    'sys.ab.nonum': 'Нет строки с таким номером. Набери %s, чтобы увидеть список.\n',
    'sys.ab.deleted': 'Строка автобаффа удалена: %s\n',
    'sys.ab.cleared': 'Список автобаффа очищен.\n',

    'sys.rv.title': 'Включить или выключить чтение вывода для программ экранного доступа, подробнее %s',
    'sys.rv.desc': `Когда чтение вывода включено, Tab в командной строке переносит в текст вывода игры. Стрелки вверх и вниз читают его по строкам, Enter выполняет команду в строке, Tab, Shift+Tab или Escape возвращают в командную строку.

Синтаксис:
#review      - сказать, включено ли
#review on   - включить
#review off  - выключить

Пока чтение вывода включено, Alt со стрелками читает чат (кроме Mac).

Настройка запоминается в этом браузере. Если в игре включить config screenreader, чтение вывода включится само, а выключить -- выключится.

`,
  },
  ua: {
    'sys.nocmd': 'Такої команди немає. Набери %s, щоб побачити список команд.\n',
    'sys.forhelp': 'Набери %s для довідки.\n',

    'sys.help.title': 'Довідка про вбудовані команди, докладніше %s',
    'sys.help.desc': `Команда %s показує довідку про вбудовані команди.
Синтаксис:
#help         - список команд
#help command - докладна довідка про команду command
\n`,
    'sys.help.list': 'Вбудовані команди:\n',

    'sys.multi.title': 'Виконати команду кілька разів, докладніше %s',
    'sys.multi.desc': `Синтаксис:
#number action - виконати команду action number разів

Приклади:
#10 новина
#3 втекти|повернення

`,

    'sys.var.title': 'Створити змінну зі значенням, докладніше %s',
    'sys.var.desc': `Команда %s створює змінні.
Синтаксис:
#var                - список твоїх змінних
#var variable       - показати значення змінної variable
#var variable value - задати змінній variable значення value
#var variable delete - видалити змінну variable

Імʼя змінної починається з літери, і в ньому можуть бути англійські, українські та російські літери, цифри й знак підкреслення. Приклади правильних імен: victim, my_enemy, food1, ворог, їжа

Змінні зручні в командах гарячих клавіш: перед імʼям пиши знак долара $.
#var food пиріг
#hotkey f1 їсти $food
Тепер f1 виконає 'їсти пиріг'.

`,
    'sys.var.badname': 'Таке імʼя не годиться для змінної. Набери %s для довідки.\n',
    'sys.var.set': "Змінна '%s' тепер означає '%s'.\n",
    'sys.var.deleted': 'Змінну %s видалено.\n',
    'sys.var.notset': 'Такої змінної немає.\n',
    'sys.var.notfound': 'Змінну не знайдено. Набери %s, щоб побачити всі твої змінні.\n',
    'sys.var.empty': 'У тебе немає змінних. Набери %s для довідки.\n',
    'sys.var.list': 'Твої змінні:\n',

    'sys.del.title': 'Видалити гарячі клавіші, змінні й налаштування клієнта, докладніше %s',
    'sys.del.desc': `Команда %s видаляє гарячі клавіші, змінні й налаштування клієнта.
Синтаксис:
#delete                - список сховищ, з яких можна видаляти
#delete store          - список записів у сховищі store
#delete store record   - видалити запис record зі сховища store
#delete store all      - видалити всі записи зі сховища store

`,
    'sys.del.trigall': 'Усі тригери персонажа видалено. Спільні тригери акаунта видаляються по одному.\n',
    'sys.del.norecord': 'Запис не знайдено. Набери %s, щоб побачити записи.\n',
    'sys.del.deleted': '%s видалено.\n',
    'sys.del.nostore': 'Сховище не знайдено. Набери %s, щоб побачити сховища.\n',
    'sys.del.allgone': 'Усі записи з %s видалено.\n',
    'sys.del.empty': 'У %s немає записів.\n',
    'sys.del.records': 'Записи, які можна видалити:\n',
    'sys.del.stores': 'Сховища, з яких можна видаляти записи:\n',

    'sys.set.title': 'Задати або скинути налаштування клієнта, докладніше %s',
    'sys.set.desc': `Команда #settings змінює й запамʼятовує налаштування клієнта.

Синтаксис:
#settings                - список налаштувань
#settings property       - скинути property до значення за замовчуванням
#settings property value - задати property значення value

Налаштування:
terminalLayoutWidth - ширина вікна виводу
panelLayoutWidth    - ширина вікна панелей
mapLayoutWidth      - ширина вікна мапи
terminalFontSize    - розмір шрифту у виводі
isPgKeysScroll      - true: Page Up і Page Down гортають вивід; false: вони вільні для гарячих клавіш.

`,
    'sys.set.noparam': 'Такого налаштування немає.\n',
    'sys.set.number': 'Значення має бути числом.\n',
    'sys.set.bool': 'Значення має бути true або false.\n',
    'sys.set.removed': 'Налаштування %s видалено. Значення за замовчуванням повернеться після перезавантаження сторінки.\n',
    'sys.set.list': 'Налаштування клієнта:\n',
    'sys.set.check': 'Перевір команду й спробуй ще раз.\n',

    'sys.hk.title': 'Призначити команду на гарячу клавішу, докладніше %s',
    'sys.hk.desc': `Команда %s призначає ігрові команди на гарячі клавіші.
Синтаксис:
#hotkey            - список твоїх гарячих клавіш
#hotkey key action - призначити команду action на клавішу key
#hotkey key        - показати всі клавіші, що починаються з key
#hotkey key delete - видалити гарячу клавішу

action -- будь-яка ігрова команда, кілька теж, через |.
Найзручніше задавати клавіші в налаштуваннях: шестерня вгорі, Розширення, Макроси. Там видно, які належать персонажу, а які всьому акаунту.
Для клавіші, якій потрібен JavaScript, є функція keydown у редакторі власного скрипту (та сама шестерня).

key -- мала літера, цифра, розділовий знак, f1-f12, клавіші цифрового блоку kp0-kp9, kp*, kp-, kp+, kp., kp/, стрілки up down left right, а також ins del home end pgup pgdown.
ctrl, alt і shift можна поєднувати, і кілька разом: ctrl+a, alt+9, ctrl+shift+f1. Не кожна клавіша й комбінація вільна в браузері.

Приклад для стрілки вниз на цифровому блоці: сама -- йти на південь, з alt -- бігти на південь до упору, з shift -- вдивитися на південь.
#hotkey kp2 пд
#hotkey alt+kp2 бігти Ю
#hotkey shift+kp2 вдивитися ю

Клавіша, що виконує кілька команд разом:
#hotkey f1 втекти | втекти | повернення

`,
    'sys.hk.mods': 'У комбінації клавіш можна вживати лише ctrl, alt і shift.\n',
    'sys.hk.nokey': 'Клавіші %s немає. %s',
    'sys.hk.deleted': 'Гарячу клавішу %s видалено.\n',
    'sys.hk.notset': 'Такої гарячої клавіші немає.\n',
    'sys.hk.found': 'Знайдено такі гарячі клавіші:\n%sЩоб видалити, набери #hotkey клавіша delete.\n',
    'sys.hk.notdefined': 'Гарячу клавішу %s не задано. Набери %s, щоб побачити всі гарячі клавіші.\n',
    'sys.hk.full': 'Список гарячих клавіш заповнений.\n',
    'sys.hk.added': 'Команду для %s додано.\n',
    'sys.hk.exists': 'Цю клавішу вже призначено. Набери %s, щоб видалити.\n',
    'sys.hk.empty': 'У тебе немає гарячих клавіш. Набери %s для довідки.\n',
    'sys.hk.list': 'Твої гарячі клавіші:\n',
    'sys.hk.scope.char': 'персонаж',
    'sys.hk.scope.acct': 'акаунт',
    'sys.hk.scope.local': 'цей браузер',

    'sys.act.title': 'Створити тригер, докладніше %s',
    'sys.act.desc': `Команда %s створює, змінює й видаляє тригери на ігрові події.
Синтаксис:
#action -- список усіх тригерів
#action {trigger} {action} -- виконувати action, щойно гра покаже trigger. Тригер зберігається на персонажі й працює з будь-якого пристрою
#action string -- список тригерів, що збігаються з 'string'
#action string delete -- видалити всі тригери, що збігаються з 'string'
#action {trigger} delete -- видалити цей тригер

Тригер може бути регулярним виразом. %1 до %9 беруть по одному слову, щоб уживати їх в action.

Звук, підсвічування й тригери для всього акаунта: Налаштування, Розширення, Тригери.

Приклад:
#action {^Ти вмираєш з голоду|^Ти вмираєш від спраги} {взяти бочон сумка|пити боч|пити боч|пити боч|покласти боч сумка}
`,
    'sys.act.priority': 'Пріоритет має бути числом від 0 до 9. Набери %s для довідки.\n',
    'sys.act.added': ' {%s} додано до тригерів.\n',
    'sys.act.added.server': ' {%s} додано до тригерів. Звук і підсвічування: Налаштування, Розширення, Тригери.\n',
    'sys.act.badsearch': 'Такий шаблон пошуку не працює.\n',
    'sys.act.empty': 'У тебе немає тригерів. Набери %s для довідки.\n',
    'sys.act.list': 'Твої тригери:\n',
    'sys.act.off': 'вимк',
    'sys.act.notfound': 'Тригер не знайдено. Набери %s, щоб побачити всі тригери.\n',
    'sys.act.notset': 'Такого тригера немає.\n',
    'sys.act.deleted': ' {%s} видалено.\n',
    'sys.act.badmask': 'Такий шаблон не працює.\n',
    'sys.act.nomatch': 'Жоден тригер не збігся.\n',
    'sys.act.alldeleted': 'Усі тригери, що збіглися, видалено.\n',
    'sys.act.badcmd': 'Команда неправильна. Набери %s для довідки.\n',

    'sys.ab.title': 'Твої рядки автобафу, докладніше %s',
    'sys.ab.desc': `Кнопка автобафу (типово клавіша ~) накладає всі посилення, які ти знаєш на 50% і більше і яких на тобі ще немає. Цю частину сервер рахує сам і оновлює з рівнем і практикою, її не треба налаштовувати.

Команда %s додає ТВОЇ рядки, яких сервер знати не може: баф від улюбленця, наказ, що завгодно.

Синтаксис:
#autobuff                     - показати твій список
#autobuff add афект команда   - слати команду, поки цього афекту на тобі немає
#autobuff add * команда       - слати команду щоразу
#autobuff del N               - видалити рядок номер N
#autobuff clear               - очистити список

Афект пишеться англійською системною назвою закляття, як у касті: haste, sanctuary, fly.

Приклади:
#autobuff add haste order rat c haste
#autobuff add sanctuary c sanctuary
#autobuff add * усмішка

Ці рядки живуть лише в цьому браузері. Зручніше у вкладці Налаштування, Розширення, Автобаф: там можна вимкнути окремі бафи, змінити порядок і додати свої рядки просто персонажу, і вони спрацюють з будь-якого пристрою й з команди 'buff'.

`,
    'sys.ab.empty': 'Твій список автобафу порожній. Набери %s для довідки.\n',
    'sys.ab.list': 'Твої рядки автобафу:\n',
    'sys.ab.always': 'завжди',
    'sys.ab.ifnot': "якщо немає '%s'",
    'sys.ab.whilenot': "поки немає афекту '%s'",
    'sys.ab.added': 'Рядок автобафу додано (%s): %s\n',
    'sys.ab.nonum': 'Рядка з таким номером немає. Набери %s, щоб побачити список.\n',
    'sys.ab.deleted': 'Рядок автобафу видалено: %s\n',
    'sys.ab.cleared': 'Список автобафу очищено.\n',

    'sys.rv.title': 'Увімкнути або вимкнути читання виводу для екранних читачів, докладніше %s',
    'sys.rv.desc': `Коли читання виводу ввімкнене, Tab у командному рядку переносить у текст виводу гри. Стрілки вгору й вниз читають його по рядках, Enter виконує команду з рядка, а Tab, Shift+Tab або Escape повертають у командний рядок.

Синтаксис:
#review      - сказати, чи ввімкнено
#review on   - увімкнути
#review off  - вимкнути

Поки читання виводу ввімкнене, Alt зі стрілками читає чат (крім Mac).

Вибір запамʼятовується в цьому браузері. Якщо в грі ввімкнути config screenreader, читання виводу ввімкнеться само, а вимкнути -- вимкнеться.

`,
  },
});
