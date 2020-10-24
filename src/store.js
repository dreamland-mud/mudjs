
import thunkMiddleware from 'redux-thunk';
import { combineReducers, createStore, applyMiddleware } from 'redux';

const connection = (state = { }, action) => {
    switch (action.type) {
        case 'CONNECTED':
            return { ...state, connected: true };
        case 'DISCONNECTED':
            return { ...state, connected: false };
        default:
            return state;
    }
};

const onConnected = () => ({ type: 'CONNECTED' });
const onDisconnected = () => ({ type: 'DISCONNECTED' });

const reducer = combineReducers({ connection });

const store = createStore(reducer, undefined, applyMiddleware(thunkMiddleware));

export { store, onConnected, onDisconnected };
