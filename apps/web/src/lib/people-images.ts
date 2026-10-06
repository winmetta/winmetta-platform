// Teacher portraits copied from winmetta.org (see assets/SOURCES.md), by file name.
import type { ImageMetadata } from 'astro';

const images = import.meta.glob<{ default: ImageMetadata }>(
  '../assets/people/*.{jpg,jpeg,png,webp}',
  { eager: true },
);
const byName = new Map(
  Object.entries(images).map(([path, module]) => [
    path.split('/').pop() ?? path,
    module.default,
  ]),
);

export function portrait(file: string | undefined): ImageMetadata | undefined {
  return file ? byName.get(file) : undefined;
}
