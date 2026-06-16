import $ from 'jquery';

// iOS Safari/WebKit has no Notification API, so this runs at module eval before any
// guard could help -- reading Notification.permission unguarded threw a ReferenceError
// during init and blanked the whole client on iPhone. Feature-detect first.
let notificationPermission =
  'Notification' in window ? Notification.permission : 'denied';

// Один раз реєструємо обробник після першого кліку
$(document).one('click', () => {
  if ('Notification' in window && notificationPermission !== 'granted') {
    Notification.requestPermission().then(perm => {
      notificationPermission = perm;
    });
  }
});

// Реєстрація події при готовності документа
$(document).ready(function () {
  if ('Notification' in window && notificationPermission === 'granted') {
    $('#rpc-events').on('rpc-notify', function (e, text) {
      if (document.hidden) {
        new Notification(text);
      }
    });
  }
});

// Функція виклику повідомлення
export default function notify(txt) {
  $('#rpc-events').trigger('rpc-notify', [txt]);
}
