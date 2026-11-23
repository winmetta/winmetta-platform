// Copy a short value (a Zelle address) with the standard copy text action (docs/design-guide.md §1).
import { useEffect, useState } from 'react';
import { CheckIcon, CopyIcon } from './icons';
import { TextAction } from './ui/text-action';
import { copyText } from '../lib/clipboard';

interface Props {
  value: string;
  /** Names what is copied for screen readers, e.g. "Copy winmetta.org@gmail.com". */
  label: string;
  copy: string;
  copied: string;
}

export default function CopyText({ value, label, copy, copied }: Props) {
  const [done, setDone] = useState(false);
  // Shown only once it works: without JavaScript a copy button would do nothing
  // (docs/design-guide.md §1), and the address beside it can still be selected.
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  if (!ready) return null;
  return (
    <TextAction
      icon={done ? <CheckIcon /> : <CopyIcon />}
      aria-label={done ? copied : label}
      onClick={() => {
        void copyText(value).then((ok) => {
          setDone(ok);
          if (ok) window.setTimeout(() => setDone(false), 2000);
        });
      }}
    >
      {done ? copied : copy}
    </TextAction>
  );
}
