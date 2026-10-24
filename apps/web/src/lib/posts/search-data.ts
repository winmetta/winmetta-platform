// Build-time only (imports node:crypto): the posts search index and result records, written
// by pages/post-data/*.[version].json.ts and loaded lazily by the posts index on first search.
import { createHash } from 'node:crypto';
import { loadPosts, loadPostTags } from './catalog.ts';
import { PostSearch } from './search.ts';
import { searchDocs, searchRecords } from './search-docs.ts';
import { toSimplified } from './simplified.ts';

export interface PostSearchData {
  recordsJson: string;
  indexJson: string;
  /** Content hash in the file names, so the CDN can cache them forever. */
  version: string;
}

let cached: Promise<PostSearchData> | undefined;

export function postSearchData(): Promise<PostSearchData> {
  cached ??= (async () => {
    const posts = await loadPosts(); // newest first: the search tie-breaker
    const recordsJson = JSON.stringify(searchRecords(posts));
    const indexJson = PostSearch.build(
      searchRecords(posts),
      searchDocs(posts, loadPostTags()),
      toSimplified,
    ).serialize();
    const version = createHash('sha256')
      .update(recordsJson)
      .update(indexJson)
      .digest('hex')
      .slice(0, 12);
    return { recordsJson, indexJson, version };
  })();
  return cached;
}
