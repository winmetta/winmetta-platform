import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { FTS_TOKENIZE, ftsTokens, normalizeSearch } from './index.ts';

const tokens = (text: string) => ftsTokens(normalizeSearch(text));

describe('ftsTokens', () => {
  it('splits Burmese into syllables, a stacked consonant stays in its syllable', () => {
    expect(tokens('ဓမ္မ ဒေသနာ').my).toEqual(['ဓမ္မ', 'ဒေ', 'သ', 'နာ']);
  });
  it('gives spaced and unspaced Burmese the same tokens', () => {
    expect(tokens('ဓမ္မဒေသနာ')).toEqual(tokens('ဓမ္မ ဒေသနာ'));
  });
  it('folds ဥ/ဉ and Burmese digits like catalog search', () => {
    expect(tokens('ဥပဒေ').my).toEqual(tokens('ဉပဒေ').my);
    expect(tokens('၁၂').latin).toEqual(['12']);
  });
  it('drops Myanmar punctuation and keeps Latin words, folded', () => {
    expect(tokens('ဓမ္မ။ Pāḷi dhammā 2026')).toEqual({
      my: ['ဓမ္မ'],
      latin: ['pali', 'dhamma', '2026'],
    });
  });
  it('returns Chinese characters one by one as latin tokens', () => {
    expect(tokens('贪欲').latin).toEqual(['贪', '欲']);
  });
  it('is empty for empty text', () => {
    expect(tokens('')).toEqual({ my: [], latin: [] });
  });
});

describe('FTS5 with ftsTokens', () => {
  const vocab = (tokenize: string): string[] => {
    const db = new DatabaseSync(':memory:');
    db.exec(`create virtual table t using fts5(a, tokenize="${tokenize}")`);
    db.exec("create virtual table v using fts5vocab(t, 'row')");
    db.prepare('insert into t values (?)').run(
      tokens('ဓမ္မ ဒေသနာ').my.join(' '),
    );
    return db
      .prepare('select term from v order by term')
      .all()
      .map((r) => String(r.term));
  };
  it('the default unicode61 tokenizer cuts syllables at vowel signs and virama', () => {
    expect(vocab('unicode61')).not.toContain('ဓမ္မ');
  });
  it('FTS_TOKENIZE keeps every syllable as one token', () => {
    expect(vocab(FTS_TOKENIZE).sort()).toEqual(
      ['ဒေ', 'ဓမ္မ', 'နာ', 'သ'].sort(),
    );
  });
  it('finds a syllable phrase whatever spacing the book used', () => {
    const db = new DatabaseSync(':memory:');
    db.exec(
      `create virtual table t using fts5(my_tokens, tokenize="${FTS_TOKENIZE}")`,
    );
    const insert = db.prepare('insert into t values (?)');
    insert.run(tokens('ဓမ္မဒေသနာ တော်').my.join(' '));
    insert.run(tokens('သီလ သမာဓိ').my.join(' '));
    const phrase = `"${tokens('ဓမ္မ ဒေသနာ').my.join(' ')}"`;
    expect(
      db.prepare('select count(*) n from t where t match ?').get(phrase),
    ).toMatchObject({ n: 1 });
  });
});
