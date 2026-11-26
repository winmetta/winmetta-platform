// The small symbols used next to words in text actions (docs/design-guide.md §1). All are
// decorative: the words carry the meaning, so they are hidden from screen readers.
import type { ReactNode } from 'react';

const Svg = ({ children }: { children: ReactNode }) => (
  <svg
    aria-hidden="true"
    focusable="false"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {children}
  </svg>
);

/** The usual copy symbol: two overlapping sheets. */
export const CopyIcon = () => (
  <Svg>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15V6a2 2 0 0 1 2-2h9" />
  </Svg>
);
export const CheckIcon = () => (
  <Svg>
    <path d="m5 12 5 5L20 7" />
  </Svg>
);
/** A document, before a file size. */
export const FileIcon = () => (
  <Svg>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5" />
  </Svg>
);
/** A folder, before a folder name (docs/design-guide.md §1). */
export const FolderIcon = () => (
  <Svg>
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
  </Svg>
);
/** Remove, clear and reset. */
export const CloseIcon = () => (
  <Svg>
    <path d="M6 6l12 12M18 6 6 18" />
  </Svg>
);
/** Try again. */
export const RetryIcon = () => (
  <Svg>
    <path d="M20 11a8 8 0 1 0-2.3 5.7" />
    <path d="M20 5v6h-6" />
  </Svg>
);
/** Show more. */
export const MoreIcon = () => (
  <Svg>
    <path d="m6 9 6 6 6-6" />
  </Svg>
);
/** Two opposite arrows: swap two choices. */
export const SwapIcon = () => (
  <Svg>
    <path d="M7 4 3 8l4 4" />
    <path d="M3 8h14" />
    <path d="m17 20 4-4-4-4" />
    <path d="M21 16H7" />
  </Svg>
);

/** A pencil: write or edit text. */
export const EditIcon = () => (
  <Svg>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </Svg>
);
