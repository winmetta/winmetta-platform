// Build-time view of the library for pages: the validated manifest plus the folder tree.
import folders from '../library/folders.json';
import manifest from '../library/manifest.json';
import { buildFolderTree } from './library-folders';
import { folderEntrySchema, libraryFileSchema } from './schemas';

export const files = libraryFileSchema.array().parse(manifest);
export const tree = buildFolderTree(
  files,
  folderEntrySchema.array().parse(folders),
);
