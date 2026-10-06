// The folder tree of the library: one node per folder (S3 key prefix), built from the manifest
// and the committed folders.json (stable ids). Pure, so it is shared by pages, tests and scripts.
import {
  cleanDisplay,
  compareFolderPath,
  folderName,
} from './library-index.ts';
import type { FolderEntry, LibraryFile } from './schemas.ts';

export interface FolderNode {
  id: string;
  /** Exact S3 key prefix, e.g. "၁၀။ မြန်မာရှား (၁)/၁။ ဝိနိစ္ဆယများ". */
  path: string;
  /** Display name: number prefix and zero-width characters removed. */
  name: string;
  /** Ancestors from the top-level folder down to this one (this node excluded). */
  ancestors: string[];
  childIds: string[];
  /** Books stored directly in this folder, in library order. */
  books: LibraryFile[];
  /** Books in this folder and all subfolders. */
  total: number;
}
export interface FolderTree {
  nodes: Map<string, FolderNode>;
  roots: FolderNode[];
}

export const PAGE_SIZE = 50;
export const pageCount = (node: FolderNode): number =>
  Math.max(1, Math.ceil(node.books.length / PAGE_SIZE));

export function buildFolderTree(
  files: readonly LibraryFile[],
  folders: readonly FolderEntry[],
): FolderTree {
  const idByPath = new Map(folders.map((entry) => [entry.path, entry.id]));
  const nodes = new Map<string, FolderNode>();
  const byPath = new Map<string, FolderNode>();
  const need = (path: string): FolderNode => {
    const existing = byPath.get(path);
    if (existing) return existing;
    const id = idByPath.get(path);
    if (!id)
      throw new Error(
        `Folder "${path}" has no id in folders.json; run npm run library:manifest`,
      );
    const segments = path.split('/');
    const node: FolderNode = {
      id,
      path,
      name: folderName(segments[segments.length - 1] ?? ''),
      ancestors: segments.slice(0, -1).map((_, i) => {
        const ancestorId = idByPath.get(segments.slice(0, i + 1).join('/'));
        if (!ancestorId)
          throw new Error(`Missing folder id for ancestor of "${path}"`);
        return ancestorId;
      }),
      childIds: [],
      books: [],
      total: 0,
    };
    byPath.set(path, node);
    nodes.set(id, node);
    return node;
  };
  for (const file of files) {
    const segments = file.key.split('/').slice(0, -1);
    segments.forEach((_, i) => {
      const node = need(segments.slice(0, i + 1).join('/'));
      node.total++;
      if (i === segments.length - 1) node.books.push(file);
    });
  }
  // Sibling folders whose names are the same once the number prefix is removed (for example two
  // folders called ပါဠိစာပေ) get their original number appended so they can be told apart.
  const parentKey = (node: FolderNode): string => node.ancestors.join('/');
  const siblings = new Map<string, FolderNode[]>();
  for (const node of byPath.values()) {
    const group = siblings.get(`${parentKey(node)}|${node.name}`) ?? [];
    group.push(node);
    siblings.set(`${parentKey(node)}|${node.name}`, group);
  }
  for (const group of siblings.values()) {
    if (group.length < 2) continue;
    for (const node of group) {
      const segment = node.path.split('/').pop() ?? '';
      const prefix = /^[0-9၀-၉]+/.exec(cleanDisplay(segment))?.[0];
      if (prefix) node.name = `${node.name} [${prefix}]`;
    }
  }
  // Link children after every node exists, in folder sequence.
  const ordered = [...byPath.values()].sort((a, b) =>
    compareFolderPath(a.path, b.path),
  );
  for (const node of ordered) {
    const parentId = node.ancestors[node.ancestors.length - 1];
    if (parentId) nodes.get(parentId)?.childIds.push(node.id);
  }
  return {
    nodes,
    roots: ordered.filter((node) => node.ancestors.length === 0),
  };
}

/** Folders from the top-level down to this folder, for breadcrumbs. */
export function trail(tree: FolderTree, node: FolderNode): FolderNode[] {
  return [...node.ancestors, node.id].flatMap((id) => tree.nodes.get(id) ?? []);
}
