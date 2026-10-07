/** Search engines may index only when the public production build opts in. */
export const allowIndexing = import.meta.env.PUBLIC_ALLOW_INDEXING === 'true';
/** Shows the Beta pill in the header and its explanation on About. Set to false to remove the beta label. */
export const isBeta = true;
/** Public CDN origin for library PDFs (the existing Bunny pull zone; Phase 2 leaves it as is). */
export const libraryCdnBase =
  import.meta.env.PUBLIC_LIBRARY_CDN_BASE || 'https://dhamma-library.b-cdn.net';
