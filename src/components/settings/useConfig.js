import { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import $ from 'jquery';
import { rpccmd } from '../../websock.js';

// The settings the server offers, and their current values.
//
// The schema is asked for when the dialog first opens, and again on the two
// occasions it goes stale: the player changes language (it arrives in one
// language) and the connection comes back. The values come with it, and after
// that only as deltas -- one frame per change, from whichever hand made it.
// That is why an open dialog follows the player typing 'config brief' into the
// terminal just as well as its own switches.
//
// Nothing is believed until the server says so. A click sends the change and
// leaves the control where it was, marked pending; it moves when the answer
// arrives, and a refusal leaves it where it was with the reason beside it. A
// switch that moves on the click alone is a claim about the world that the
// client is in no position to make.
//
// A server that does not know about settings answers nothing at all, and there
// is no capability flag to ask about either: the answer, or its absence, IS the
// flag. That is what the timeout below is for.
const ANSWER_TIMEOUT = 2000;

// Settings the schema itself is built around: the samples of real output under
// a setting's question mark are painted in the player's own palette, so a
// changed colour scheme leaves a window full of pictures of the old one.
const REPAINTS = ['color'];

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
  // A change that has left the client and has no answer yet: the control is
  // disabled while its name is in here.
  const [pending, setPending] = useState({});
  // Why the server said no, by option: shown in place of the description until
  // the next thing happens to that option.
  const [refused, setRefused] = useState({});
  // A prompt, or the server's own word, that a character is in the world. Only
  // then is asking for settings worth anything.
  const [playing, setPlaying] = useState(false);
  // The last change, spelled as the command that would have done the same at
  // the keyboard: the dialog teaches the terminal instead of hiding it.
  const [echo, setEcho] = useState(null);
  const asked = useRef(null);
  // Bumped when something the schema itself depends on changes -- the colour
  // scheme, so far. The samples under the question marks are painted for the
  // palette the player had when the schema was built, and after a change they
  // are a picture of the old one.
  const [stamp, setStamp] = useState(0);
  // Whose settings are on screen. A different name means a different character
  // and everything on screen belongs to nobody.
  const who = useRef(null);
  const timers = useRef({});
  const connected = useSelector(state => state.connection.connected);

  // Ask for the schema again, because what is in hand was built for something
  // that has since changed.
  const repaint = () => {
    asked.current = null;
    setStamp(was => was + 1);
  };

  const forget = key => {
    setPending(was => {
      if (!was[key]) return was;
      const next = { ...was };
      delete next[key];
      return next;
    });
  };

  // A dropped connection puts the dialog back where it started. The game may
  // come back at the name prompt rather than in the world -- the settings on
  // screen would then belong to nobody, and a switch clicked there would go
  // into a socket that is not listening.
  useEffect(() => {
    if (connected) return;

    setPlaying(false);
    setSchema(null);
    setValues({});
    setPending({});
    setRefused({});
    setSupport(SUPPORT.OFFLINE);
    asked.current = null;
    who.current = null;
  }, [connected]);

  useEffect(() => () => {
    Object.keys(timers.current).forEach(key => clearTimeout(timers.current[key]));
  }, []);

  useEffect(() => {
    // A character change empties everything: an alt's switches must never be
    // shown, however briefly, as this character's.
    const arrived = name => {
      if (!name || who.current === name) return;
      who.current = name;
      setValues({});
      setPending({});
      setRefused({});
      asked.current = null;
    };

    // The prompt says nothing about settings any more; it is still the plainest
    // sign that somebody is in the world.
    const onPrompt = () => setPlaying(true);

    const onSchema = (e, b) => {
      const body = b || {};
      arrived(body.who);
      setSchema(body);
      setValues(body.values || {});
      setRefused({});
      setSupport(SUPPORT.READY);
    };

    // One setting changed by some other hand: a typed command, an alt on the
    // same account, the server itself.
    const onChanged = (e, b) => {
      if (!b || !b.key) return;
      setValues(was => ({ ...was, [b.key]: b.value }));
      setRefused(was => (was[b.key] ? { ...was, [b.key]: null } : was));
      if (REPAINTS.includes(b.key)) repaint();
    };

    // The answer to a change of our own.
    const onResult = (e, b) => {
      if (!b || !b.key) return;

      clearTimeout(timers.current[b.key]);
      delete timers.current[b.key];
      forget(b.key);

      if (b.ok) {
        // The value the server stored, which is not always the one that was
        // asked for: a handle is trimmed, a number is clamped by the same rules
        // the typed command applies.
        setValues(was => ({ ...was, [b.key]: b.value }));
        setRefused(was => (was[b.key] ? { ...was, [b.key]: null } : was));
        if (REPAINTS.includes(b.key)) repaint();
      } else {
        setRefused(was => ({ ...was, [b.key]: b.reason || b.error || true }));
      }
    };

    // Entering or leaving the world, said plainly, because a player can quit to
    // the login prompt with the socket still open and the dialog still up.
    const onState = (e, b) => {
      const body = b || {};
      if (body.playing) {
        arrived(body.who);
        setPlaying(true);
      } else {
        setPlaying(false);
        setSchema(null);
        setValues({});
        setPending({});
        setRefused({});
        setSupport(SUPPORT.OFFLINE);
        asked.current = null;
        who.current = null;
      }
    };

    $('#rpc-events').on('rpc-prompt', onPrompt);
    $('#rpc-events').on('rpc-config_schema', onSchema);
    $('#rpc-events').on('rpc-config_changed', onChanged);
    $('#rpc-events').on('rpc-config_result', onResult);
    $('#rpc-events').on('rpc-config_state', onState);

    return () => {
      $('#rpc-events').off('rpc-prompt', onPrompt);
      $('#rpc-events').off('rpc-config_schema', onSchema);
      $('#rpc-events').off('rpc-config_changed', onChanged);
      $('#rpc-events').off('rpc-config_result', onResult);
      $('#rpc-events').off('rpc-config_state', onState);
    };
  }, []);

  // Asked again when the player changes language, because the schema arrives in
  // one language: the dialog is worth a round trip on a change that rare.
  useEffect(() => {
    if (!open || !playing) return undefined;
    if (asked.current === lang) return undefined;

    asked.current = lang;
    void stamp;
    setSupport(was => (was === SUPPORT.READY ? was : SUPPORT.UNKNOWN));
    rpccmd('config_schema');

    const timer = setTimeout(() => {
      setSupport(was => (was === SUPPORT.UNKNOWN ? SUPPORT.MISSING : was));
    }, ANSWER_TIMEOUT);

    return () => clearTimeout(timer);
  }, [open, playing, lang, stamp]);

  // Sent, then waited for. Nothing on screen moves until the server answers --
  // and if it never does, the control comes back to life where it was.
  const set = (key, value, spelled) => {
    // Nothing moves on screen unless the change actually left the client: a
    // socket can be gone a moment before anyone says so.
    if (!playing) return;
    if (!rpccmd('config_set', key, String(value))) return;

    setPending(was => ({ ...was, [key]: true }));
    setRefused(was => (was[key] ? { ...was, [key]: null } : was));
    if (spelled) setEcho(spelled);

    clearTimeout(timers.current[key]);
    timers.current[key] = setTimeout(() => {
      delete timers.current[key];
      forget(key);
    }, ANSWER_TIMEOUT);
  };

  return { schema, values, support, set, echo, pending, refused };
}
