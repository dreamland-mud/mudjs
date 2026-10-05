import $ from 'jquery';
import { combineReducers, legacy_createStore as createStore } from 'redux';

// sessionStorage key of the session-resume token (owned by websock.js).
const RESUME_KEY = 'mudjs.resume';

function hasResumeToken() {
  try {
    return !!sessionStorage.getItem(RESUME_KEY);
  } catch (e) {
    return false;
  }
}

// Reducer для з'єднання. `resuming`: the character is still in the world and a
// silent resume is bringing it back, so the login door must stay down. Starts on
// after a page reload that kept the token.
const connection = (state = { resuming: hasResumeToken() }, action) => {
  switch (action.type) {
    case 'CONNECTED':
      return { ...state, connected: true };
    case 'DISCONNECTED':
      return { ...state, connected: false, resuming: !!action.resuming };
    case 'RESUME_DONE':
      return state.resuming ? { ...state, resuming: false } : state;
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
const onDisconnected = resuming => ({ type: 'DISCONNECTED', resuming });
const onResumeDone = () => ({ type: 'RESUME_DONE' });
const onNewPrompt = changes => ({ type: 'NEW_PROMPT', changes });

// Комбінований reducer
const reducer = combineReducers({ connection, prompt });

// ✅ Створюємо store без middleware
const store = createStore(reducer);

// Прив'язуємо івент на зміну промпта
$(document).ready(() => {
  $('#rpc-events').on('rpc-prompt', (e, b) => store.dispatch(onNewPrompt(b)));
});

export { store, onConnected, onDisconnected, onResumeDone, RESUME_KEY };
