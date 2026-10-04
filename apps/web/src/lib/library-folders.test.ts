import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  PAGE_SIZE,
  buildFolderTree,
  pageCount,
  trail,
} from './library-folders';
import { folderEntrySchema, libraryFileSchema } from './schemas';

const read = (name: string): unknown =>
  JSON.parse(
    readFileSync(new URL(`../library/${name}`, import.meta.url), 'utf8'),
  );
const files = libraryFileSchema.array().parse(read('manifest.json'));
const folders = folderEntrySchema.array().parse(read('folders.json'));

const file = (key: string) => ({
  id: key.replace(/\W/g, ''),
  key,
  title: 'x',
  tags: [],
  tagPath: [],
  language: 'my',
  sizeBytes: 1,
  format: 'pdf' as const,
  lastModified: '2023-01-01T00:00:00.000Z',
});

describe('buildFolderTree', () => {
  const small = buildFolderTree(
    [file('၁၀။ က/၂။ ခ/a.pdf'), file('၁၀။ က/b.pdf'), file('၁။ ဂ/c.pdf')],
    [
      { id: 'f001', path: '၁။ ဂ' },
      { id: 'f002', path: '၁၀။ က' },
      { id: 'f003', path: '၁၀။ က/၂။ ခ' },
    ],
  );
  it('creates a node per folder with names, ancestors, direct books and totals', () => {
    const parent = small.nodes.get('f002');
    expect(parent).toMatchObject({
      name: 'က',
      total: 2,
      ancestors: [],
      childIds: ['f003'],
    });
    expect(parent?.books).toHaveLength(1);
    expect(small.nodes.get('f003')).toMatchObject({
      name: 'ခ',
      total: 1,
      ancestors: ['f002'],
    });
  });
  it('orders top-level folders by number value and builds breadcrumb trails', () => {
    expect(small.roots.map((node) => node.id)).toEqual(['f001', 'f002']);
    const child = small.nodes.get('f003');
    expect(child && trail(small, child).map((node) => node.name)).toEqual([
      'က',
      'ခ',
    ]);
  });
  it('tells sibling folders with the same name apart by their original number', () => {
    const tree = buildFolderTree(
      [
        file('၁။ ဂ/၉။ စာ/a.pdf'),
        file('၁။ ဂ/၂၀။ စာ/b.pdf'),
        file('၁။ ဂ/၃။ ဃ/c.pdf'),
      ],
      [
        { id: 'f001', path: '၁။ ဂ' },
        { id: 'f002', path: '၁။ ဂ/၉။ စာ' },
        { id: 'f003', path: '၁။ ဂ/၂၀။ စာ' },
        { id: 'f004', path: '၁။ ဂ/၃။ ဃ' },
      ],
    );
    expect(tree.nodes.get('f002')?.name).toBe('စာ [၉]');
    expect(tree.nodes.get('f003')?.name).toBe('စာ [၂၀]');
    expect(tree.nodes.get('f004')?.name).toBe('ဃ');
  });
  it('fails when a folder has no id, so folders.json cannot silently go stale', () => {
    expect(() => buildFolderTree([file('၁။ ဂ/c.pdf')], [])).toThrow(
      'folders.json',
    );
  });
  it('pages a folder in blocks of PAGE_SIZE and always has at least one page', () => {
    const many = buildFolderTree(
      Array.from({ length: PAGE_SIZE + 1 }, (_, i) => file(`၁။ ဂ/${i}.pdf`)),
      [{ id: 'f001', path: '၁။ ဂ' }],
    );
    expect(pageCount(many.nodes.get('f001')!)).toBe(2);
    expect(pageCount({ ...many.nodes.get('f001')!, books: [] })).toBe(1);
  });
});

describe('the real library tree', () => {
  const tree = buildFolderTree(files, folders);
  it('has the 18 top-level folders in sequence and every book is counted once', () => {
    expect(tree.roots).toHaveLength(18);
    expect(tree.roots.reduce((sum, node) => sum + node.total, 0)).toBe(
      files.length,
    );
    expect(tree.roots[0]?.name).toBe('ပါဠိတော်');
    expect(tree.roots[17]?.name).toMatch(/^Ashin-Kelasa/);
  });
  it('has consistent totals: direct books plus subfolder totals', () => {
    for (const node of tree.nodes.values()) {
      const nested = node.childIds.reduce(
        (sum, id) => sum + (tree.nodes.get(id)?.total ?? 0),
        0,
      );
      expect(node.books.length + nested).toBe(node.total);
    }
  });
  it('has unique folder ids and every manifest folder has one', () => {
    expect(new Set(folders.map((entry) => entry.id)).size).toBe(folders.length);
    expect(tree.nodes.size).toBeGreaterThan(50);
  });
});
