import $ from 'jquery';
import { combineReducers, legacy_createStore as createStore } from 'redux';

// Reducer для з'єднання
const connection = (state = {}, action) => {
  switch (action.type) {
    case 'CONNECTED':
      return { ...state, connected: true };
    case 'DISCONNECTED':
      return { ...state, connected: false };
    default:
      return state;
  }
};

// Reducer для промпта
const prompt = (state = null, action) => {
  switch (action.type) {
    case 'DISCONNECTED':
      return null;
    case 'NEW_PROMPT':
      return { ...state, ...action.changes };
    default:
      return state;
  }
};

// Екшени
const onConnected = () => ({ type: 'CONNECTED' });
const onDisconnected = () => ({ type: 'DISCONNECTED' });
const onNewPrompt = changes => ({ type: 'NEW_PROMPT', changes });

// Комбінований reducer
const reducer = combineReducers({ connection, prompt });

// ✅ Створюємо store без middleware
const store = createStore(reducer);

// Прив'язуємо івент на зміну промпта
$(document).ready(() => {
  $('#rpc-events').on('rpc-prompt', (e, b) => store.dispatch(onNewPrompt(b)));
});

export { store, onConnected, onDisconnected };
