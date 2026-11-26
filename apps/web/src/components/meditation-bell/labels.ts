export type Labels = Record<string, string>;

export const fill = (text: string, values: Record<string, string | number>) =>
  text.replace(/\{(\w+)\}/g, (_match, key: string) =>
    String(values[key] ?? ''),
  );
