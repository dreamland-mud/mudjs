
import thunkMiddleware from 'redux-thunk';
import { combineReducers, createStore, applyMiddleware } from 'redux';

// A reducer. Takes old state and new action, create new state.
// It will be applied onto part of the state specific to this reducer
// once a dispatch is called for an action.
const connection = (state = { }, action) => {
    switch (action.type) {
        case 'CONNECTED':
            return { ...state, connected: true };
        case 'DISCONNECTED':
            return { ...state, connected: false };
        default: // Return state as is in case it's not our action that called us.
            return state;
    }
};

// Function called when trying to connect to websocket. Returns new simple command/action.
const onConnected = () => ({ type: 'CONNECTED' });
// Function called when websocket is closed.  Returns new simple action.
const onDisconnected = () => ({ type: 'DISCONNECTED' });

// Main reducer, a combination of several ones. One in our simple case.
// For every action all reducers from this list are going to be called.
const reducer = combineReducers({ connection });

// Create a singleton store that keeps global state of the whole application.
const store = createStore(reducer, undefined, applyMiddleware(thunkMiddleware));

export { store, onConnected, onDisconnected };
