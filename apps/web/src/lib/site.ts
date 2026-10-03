/** Search engines may index only when the public production build opts in. */
export const allowIndexing = import.meta.env.PUBLIC_ALLOW_INDEXING === 'true';
