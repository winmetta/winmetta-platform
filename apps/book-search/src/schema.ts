import { FTS_TOKENIZE } from '@winmetta/search-text';

/** Bump when the table layout changes; the search API refuses a file with another version. */
export const SCHEMA_VERSION = 1;

/** The book-search SQLite schema (docs/book-search.md §5). */
export const SCHEMA_SQL = `
CREATE TABLE meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
) WITHOUT ROWID;

CREATE TABLE books (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL,
  title TEXT NOT NULL,
  author TEXT NOT NULL DEFAULT '',
  language TEXT NOT NULL,
  pages INTEGER NOT NULL,
  sha256 TEXT NOT NULL
) WITHOUT ROWID;

CREATE TABLE pages (
  book_id TEXT NOT NULL REFERENCES books(id),
  page INTEGER NOT NULL,
  method TEXT NOT NULL,
  status TEXT NOT NULL,
  confidence REAL,
  PRIMARY KEY (book_id, page)
) WITHOUT ROWID;

CREATE TABLE passages (
  id INTEGER PRIMARY KEY,
  book_id TEXT NOT NULL REFERENCES books(id),
  page INTEGER NOT NULL,
  ordinal INTEGER NOT NULL,
  language TEXT NOT NULL,
  script TEXT NOT NULL,
  display_text TEXT NOT NULL,
  UNIQUE (book_id, page, ordinal)
);

CREATE VIRTUAL TABLE passages_fts USING fts5(
  my_tokens,
  latin_tokens,
  content='',
  tokenize="${FTS_TOKENIZE}"
);
`;
