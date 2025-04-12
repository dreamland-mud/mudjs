import { echo } from './input';
import { send } from './websock';

const voiceCommands = [
  {
    match: /^сбежать$/,
    buildCommand: () => 'сбежать',
  },
  {
    match: /^снять$/,
    buildCommand: () => 'к снят воз',
  },
  {
    match: /^опознать\s+(.+)/i,
    buildCommand: (_, match) => `к опоз ${match[1]}`,
  },
  {
    match: /^исправить\s+(.+)/i,
    buildCommand: (_, match) => `к исправить ${match[1]}`,
  },
];

export function handleSpeechCommand(transcript, setValue) {
  const normalized = transcript.trim().toLowerCase();

  for (const { match, buildCommand } of voiceCommands) {
    const matchResult = normalized.match(match);
    if (matchResult) {
      const command = buildCommand(normalized, matchResult);
      echo(command);
      send(command);
      setValue('');
      return true;
    }
  }

  return false;
}
