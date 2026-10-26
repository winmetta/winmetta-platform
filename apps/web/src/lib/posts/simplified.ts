// Traditional -> Simplified (mainland) Chinese with OpenCC. Posts must already be Simplified, so
// the validator flags any line this would change.
import { Converter } from 'opencc-js/t2cn';

export const toSimplified: (text: string) => string = Converter({
  from: 't',
  to: 'cn',
});
