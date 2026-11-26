// Win Innwa -> Unicode with knayi-myscript, which has the most complete Win Innwa table
// (every code point Win Innwa 4 maps) and writes each syllable in Unicode storage order.

import { fontConvert } from 'knayi-myscript';

const EDGE_SPACE = /^(\s*)([\s\S]*?)(\s*)$/;

/**
 * knayi trims the text it converts, which would lose indentation and blank lines, so each line is
 * converted on its own and its leading and trailing white space is put back.
 */
export function winInnwaToUnicode(text: string): string {
  return text
    .split('\n')
    .map((line) => {
      const [, lead = '', body = '', trail = ''] = EDGE_SPACE.exec(line) ?? [];
      return body ? lead + fontConvert(body, 'unicode', 'win') + trail : line;
    })
    .join('\n');
}
