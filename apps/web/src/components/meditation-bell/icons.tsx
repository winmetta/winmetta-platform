// Outline icons for the bell's buttons (Feather, MIT). Every button has one next to its word, to help
// readers who read little English (docs/meditation-bell.md §7.1). Decorative: the word is the name.
import type { ReactNode } from 'react';

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  focusable: false,
  className: 'size-5 shrink-0',
};
const icon = (children: ReactNode) => () => <svg {...base}>{children}</svg>;

export const BellIcon = icon(
  <>
    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </>,
);
export const PlayIcon = icon(<path d="M6 4l14 8-14 8z" />);
export const PauseIcon = icon(
  <>
    <path d="M6 4h4v16H6z" />
    <path d="M14 4h4v16h-4z" />
  </>,
);
export const ResetIcon = icon(
  <>
    <path d="M1 4v6h6" />
    <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
  </>,
);
export const ClearIcon = icon(
  <>
    <path d="M18 6 6 18" />
    <path d="M6 6l12 12" />
  </>,
);
export const ChevronIcon = icon(<path d="m6 9 6 6 6-6" />);
export const VolumeIcon = icon(
  <>
    <path d="M11 5 6 9H2v6h4l5 4z" />
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
  </>,
);
