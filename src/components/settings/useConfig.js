import { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import $ from 'jquery';
import { rpccmd } from '../../websock.js';

// The settings the server offers, and their current values.
//
// The schema is asked for when the dialog first opens, and again on the two
// occasions it goes stale: the player changes language (it arrives in one
// language) and the connection comes back. Values ride along on the prompt,
// which only carries a field when it has changed -- so an open dialog follows
// the player typing 'config brief' into the terminal just as well as its own
// switches.
//
// A server that does not know about settings answers nothing at all, and there
// is no capability flag to ask about either: the answer, or its absence, IS the
// flag. That is what the timeout below is for.
const ANSWER_TIMEOUT = 2000;

export const SUPPORT = {
  // Nobody is in the world yet, so there are no settings to have: the schema is
  // asked for only once the game starts talking.
  OFFLINE: 'offline',
  UNKNOWN: 'unknown',
  READY: 'ready',
  MISSING: 'missing',
};

export default function useConfig(open, lang) {
  const [schema, setSchema] = useState(null);
  const [values, setValues] = useState({});
  const [support, setSupport] = useState(SUPPORT.OFFLINE);
  // A prompt only ever arrives from a character standing in the world, which
  // makes it the one honest sign that asking is worth anything.
  const [playing, setPlaying] = useState(false);
  // The last change, spelled as the command that would have done the same at
  // the keyboard: the dialog teaches the terminal instead of hiding it.
  const [echo, setEcho] = useState(null);
  const asked = useRef(null);
  const connected = useSelector(state => state.connection.connected);

  // A dropped connection puts the dialog back where it started. The game may
  // come back at the name prompt rather than in the world -- the settings on
  // screen would then belong to nobody, and a switch clicked there would go
  // into a socket that is not listening.
  useEffect(() => {
    if (connected) return;

    setPlaying(false);
    setSchema(null);
    setValues({});
    setSupport(SUPPORT.OFFLINE);
    asked.current = null;
  }, [connected]);

  // Values arrive whether or not the dialog is open, so it opens on what the
  // player actually has rather than on a blank.
  useEffect(() => {
    const onPrompt = (e, b) => {
      setPlaying(true);
      if (b && b.config) setValues(b.config);
    };
    const onSchema = (e, b) => {
      setSchema(b || {});
      setSupport(SUPPORT.READY);
    };

    $('#rpc-events').on('rpc-prompt', onPrompt);
    $('#rpc-events').on('rpc-config_schema', onSchema);

    return () => {
      $('#rpc-events').off('rpc-prompt', onPrompt);
      $('#rpc-events').off('rpc-config_schema', onSchema);
    };
  }, []);

  // Asked again when the player changes language, because the schema arrives in
  // one language: the dialog is worth a round trip on a change that rare.
  useEffect(() => {
    if (!open || !playing) return undefined;
    if (asked.current === lang) return undefined;

    asked.current = lang;
    setSupport(was => (was === SUPPORT.READY ? was : SUPPORT.UNKNOWN));
    rpccmd('config_schema');

    const timer = setTimeout(() => {
      setSupport(was => (was === SUPPORT.UNKNOWN ? SUPPORT.MISSING : was));
    }, ANSWER_TIMEOUT);

    return () => clearTimeout(timer);
  }, [open, playing, lang]);

  // Applied at once, with no confirmation to wait for: the server replies the
  // way it replies to the typed command -- a line in the terminal -- and the
  // new value comes back with the next prompt a moment later.
  const set = (key, value, spelled) => {
    // Nothing moves on screen unless the change actually left the client: a
    // socket can be gone a moment before anyone says so.
    if (!playing) return;
    if (!rpccmd('config_set', key, String(value))) return;

    setValues(was => ({ ...was, [key]: value }));
    if (spelled) setEcho(spelled);
  };

  return { schema, values, support, set, echo };
}
