/** Search engines may index only when the public production build opts in. */
export const allowIndexing = import.meta.env.PUBLIC_ALLOW_INDEXING === 'true';
/** Public CDN origin for library PDFs (the existing Bunny pull zone until Phase 2 decides). */
export const libraryCdnBase =
  import.meta.env.PUBLIC_LIBRARY_CDN_BASE || 'https://dhamma-library.b-cdn.net';
