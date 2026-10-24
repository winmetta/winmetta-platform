// The Dhamma post tag registry (src/content/post-tags.json). Every tag has a fixed `slug` and a
// name in each post language. The slug is the tag page URL (/<locale>/dhamma-posts/tags/<slug>/),
// so a tag clicked in Burmese, English or Chinese opens the same page. It is set once from the
// English name when the tag is added and then never changes, even if a name is edited, so tag
// links keep working. The English name is the main tag; the Burmese and Chinese names are
// aliases: posts may list a tag by any of its names or its slug. No name may belong to two tags
// (compared with the search normalization, so `Pali terms` equals `Pāḷi terms` and ဥ equals ဉ).
import { normalizeSearch } from '../normalize.ts';
import { postTagSchema } from '../schemas.ts';
import { hasZawgyiMarker } from '../zawgyi.ts';
import { postLanguages, type PostLanguage } from './languages.ts';
import { slugifyTitle } from './slug.ts';

export type TagNames = Record<PostLanguage, string>;

export interface PostTag {
  /** Permanent URL slug. */
  slug: string;
  names: TagNames;
}

/** One post-tags.json entry. */
export type TagRecord = { slug: string } & TagNames;

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export interface TagRegistry {
  tags: PostTag[];
  /** Problems with the registry itself; empty when it is valid. */
  issues: string[];
  /** The tag a name (in any language) or slug refers to. */
  resolve: (name: string) => PostTag | undefined;
}

const myanmar = /[\u1000-\u109F]/;
const han = /\p{Script=Han}/u;
const tagKey = (name: string): string =>
  normalizeSearch(name).replace(/\s+/g, ' ').trim();

export function buildTagRegistry(
  records: readonly TagRecord[],
  toSimplified: (text: string) => string,
): TagRegistry {
  const issues: string[] = [];
  const tags: PostTag[] = [];
  const byKey = new Map<string, PostTag>();
  const bySlug = new Map<string, PostTag>();
  const claim = (key: string, tag: PostTag, name: string) => {
    const owner = byKey.get(key);
    if (owner && owner !== tag)
      issues.push(
        `"${name}" is a name of two tags ("${owner.names.en}" and "${tag.names.en}"); every name and slug must belong to one tag`,
      );
    else byKey.set(key, tag);
  };
  records.forEach(({ slug, ...names }, index) => {
    const label = `tag ${index + 1} ("${names.en}")`;
    if (!slugPattern.test(slug))
      issues.push(
        `${label}: slug "${slug}" must be lowercase a-z, 0-9 and single dashes, e.g. "${slugifyTitle(names.en)}"`,
      );
    const taken = bySlug.get(slug);
    if (taken)
      issues.push(
        `${label}: slug "${slug}" is already used by "${taken.names.en}"`,
      );
    if (!slugifyTitle(names.en))
      issues.push(`${label}: the English name needs Latin letters or digits`);
    if (!myanmar.test(names.my))
      issues.push(`${label}: the Burmese name has no Burmese text`);
    if (hasZawgyiMarker(names.my))
      issues.push(`${label}: the Burmese name looks like Zawgyi; use Unicode`);
    if (!han.test(names['zh-Hans']))
      issues.push(`${label}: the Chinese name has no Chinese text`);
    else if (toSimplified(names['zh-Hans']) !== names['zh-Hans'])
      issues.push(
        `${label}: the Chinese name "${names['zh-Hans']}" is Traditional; use "${toSimplified(names['zh-Hans'])}"`,
      );
    const tag: PostTag = { slug, names };
    tags.push(tag);
    if (!taken) bySlug.set(slug, tag);
    claim(tagKey(slug), tag, slug);
    for (const lang of postLanguages)
      claim(tagKey(names[lang]), tag, names[lang]);
  });
  return {
    tags,
    issues,
    resolve: (name) => bySlug.get(name) ?? byKey.get(tagKey(name)),
  };
}

/** Reads post-tags.json (already JSON-parsed); a wrong shape throws with the zod error. */
export const parseTagRegistry = (
  json: unknown,
  toSimplified: (text: string) => string,
): TagRegistry =>
  buildTagRegistry(postTagSchema.array().parse(json), toSimplified);

/** The tag's name in a post language (an interface locale is also a post language). */
export const tagName = (tag: PostTag, lang: PostLanguage): string =>
  tag.names[lang];
