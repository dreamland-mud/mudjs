import $ from 'jquery';

// notify(text) is what the player script calls for messages worth noticing.
// The stock script calls it for [ic] and [ooc] lines and for tells and says,
// matched by their Russian wording, so the last two only in Russian display.
//
// In screen reader mode each one also plays a sound (review.js listens for
// rpc-notify). While the tab is hidden it shows a browser notification, if the
// player allowed them.

// iOS Safari/WebKit has no Notification API, so this runs at module eval before any
// guard could help -- reading Notification.permission unguarded threw a ReferenceError
// during init and blanked the whole client on iPhone. Feature-detect first.
const hasNotifications = 'Notification' in window;

// Asked once, on the first click: browsers refuse the question without a gesture.
$(document).one('click', () => {
  if (hasNotifications && Notification.permission === 'default') Notification.requestPermission();
});

$(document).ready(function () {
  // The permission is read when a message comes, not at load, so a player who
  // allows notifications during play gets them without reloading the page.
  $('#rpc-events').on('rpc-notify', function (e, text) {
    if (document.hidden && hasNotifications && Notification.permission === 'granted') {
      new Notification(text);
    }
  });
});

export default function notify(txt) {
  $('#rpc-events').trigger('rpc-notify', [txt]);
}
