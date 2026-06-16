// Monokai colour scheme for Monaco, matching the palette the editors used
// back when they ran on Ace (brace/theme/monokai). Shared by the Fenia code
// editor (cs.js) and the plain-text editor (textedit.js). defineTheme is
// idempotent, so calling this from both modules is safe.
export function defineMonokai(monaco) {
  monaco.editor.defineTheme('monokai', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: '', foreground: 'f8f8f2', background: '272822' },
      { token: 'comment', foreground: '88846f' },
      { token: 'string', foreground: 'e6db74' },
      { token: 'string.escape', foreground: 'ae81ff' },
      { token: 'string.invalid', foreground: 'f92672' },
      { token: 'number', foreground: 'ae81ff' },
      { token: 'keyword', foreground: 'f92672' },
      { token: 'operator', foreground: 'f92672' },
      { token: 'identifier', foreground: 'f8f8f2' },
      { token: 'type', foreground: '66d9ef' },
    ],
    colors: {
      'editor.background': '#272822',
      'editor.foreground': '#f8f8f2',
      'editorLineNumber.foreground': '#90908a',
      'editorCursor.foreground': '#f8f8f0',
      'editor.selectionBackground': '#49483e',
      'editor.lineHighlightBackground': '#3e3d32',
      'editorWhitespace.foreground': '#3b3a32',
      'editorIndentGuide.background': '#3b3a32',
      'editorRuler.foreground': '#3b3a32',
    },
  });
}
