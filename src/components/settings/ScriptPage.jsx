import React, { useEffect, useRef } from 'react';
import { mountScriptEditor, relayoutScriptEditor } from '../../settings.js';

// The player's own script. The editor is heavy, so it is created the first time
// this page is shown and then kept alive: the page is hidden rather than
// unmounted, or every walk through the tree would cost a fresh editor.
export default function ScriptPage({ visible }) {
  const host = useRef(null);

  // Runs on every render, not once: the element under the editor can be a new
  // one, and then the editor has to be built again in it.
  useEffect(() => {
    if (host.current) mountScriptEditor(host.current);
  });

  // Hidden, the editor cannot measure itself, so it measures again every time
  // the page comes back -- including after the window changed shape meanwhile.
  useEffect(() => {
    if (visible) relayoutScriptEditor();
  }, [visible]);

  return (
    <div className="cfg-script">
      <div className="cfg-script-editor" ref={host} />
    </div>
  );
}
