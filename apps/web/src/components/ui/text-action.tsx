import type { ComponentProps, ReactNode } from 'react';

/**
 * A small action on what is already on screen (copy, clear, remove a filter, try again, show
 * more): the symbol readers know, then the words, in the link color and with no button frame.
 * A real <button> underneath, so keyboard and screen readers treat it as one. Framed buttons
 * are for submitting and for getting something (docs/design-guide.md §1).
 */
export function TextAction({
  icon,
  children,
  ...props
}: Omit<ComponentProps<'button'>, 'className' | 'type'> & {
  icon: ReactNode;
}) {
  return (
    <button type="button" className="text-action" {...props}>
      {icon}
      <span>{children}</span>
    </button>
  );
}
