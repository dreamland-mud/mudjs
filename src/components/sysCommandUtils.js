import $ from 'jquery';

// Leaf helpers shared across the #-command modules. They live in their OWN
// dependency-free module (only jquery) so a sysCommand can import them WITHOUT
// importing SysCommands.js -- which would form a SysCommands<->child import cycle.
//
// That cycle is harmless for children SysCommands itself loads first (action,
// hotkey, ...), but autobuff is ALSO imported by settings.js and commandButtons.jsx,
// which evaluate BEFORE SysCommands. The cycle then inverts: autobuff loads first,
// re-enters a not-yet-evaluated SysCommands, and SysCommands' body reads
// autobuffHelp while it is still uninitialised -- white-screening the whole client
// on load (a runtime module-eval-order fault a passing `vite build` never exercises).
// SysCommands re-exports these three so the other #-command modules stay unchanged.

export function parseStringCmd(value) {
  const stringCmd = value.trim().split(' ')
  return stringCmd
}

export function clickableLink(cmd) {
  return `<span class="builtin-cmd manip-link" data-action="${cmd}" data-echo="${cmd}">${cmd}</span>`
}

export function echoHtml(html) {
  if (!html) return
  $('.terminal').trigger('output-html', html)
}
