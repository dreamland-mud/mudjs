/* The list window's state: closed, or showing one list from the game. */
const subscribers = new Set();

let state = { open: false, list: null, command: '', selectKey: undefined, seq: 0 };

export const getState = () => state;

export function setState(next) {
  state = { ...state, ...next };
  subscribers.forEach(fn => fn(state));
}

export function onState(fn) {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}
