#!/usr/bin/env node
// One-off, read-only import of the teacher biographies and portraits published on winmetta.org.
// Reads each bio page, keeps headings and paragraphs as written (never rewritten), downloads the
// portrait at the largest available size, and writes src/content/teachers.json and
// src/assets/SOURCES.md. Existing English drafts and the `reviewed` flags in teachers.json are kept.
//   node scripts/import-teachers.mjs
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { teacherSchema } from '../apps/web/src/lib/schemas.ts';
import { hasZawgyiMarker } from '../apps/web/src/lib/zawgyi.ts';

const root = new URL('../apps/web/src/', import.meta.url);
const today = new Date().toISOString().slice(0, 10);
const site = 'https://winmetta.org/';

// Names, places and page slugs are authored here; everything else comes from the pages.
const teachers = [
  {
    id: 'ghositabhivamsa',
    slug: 'sayadaw-u-ghositabhivamsa-bio',
    names: {
      my: 'ဆရာတော် ဦးဃောသိတာဘိဝံသ (မေတ္တာနန္ဒ)',
      en: 'Sayadaw U Ghositābhivaṃsa (Mettānanda)',
    },
    place: { en: 'Oakland, California, USA', my: 'Oakland, California, USA' },
    portrait: '2022/07/U-Ghositabhivamda-profile-1.jpeg',
  },
  {
    id: 'garudhamma',
    slug: 'sayadaw-u-garudhamma-bio',
    names: { my: 'ဆရာတော် ဦးဂရုဓမ္မ', en: 'Sayadaw U Garudhamma' },
    place: { en: 'Fremont, California, USA', my: 'Fremont, California, USA' },
    portrait: '2022/06/ugarudhamma-profile2-1.jpeg',
  },
  {
    id: 'kelasa',
    slug: 'ashin-kelasa-bio',
    names: { my: 'အရှင်ကေလာသ', en: 'Ashin Kelāsa' },
    place: { en: 'Arizona, USA', my: 'Arizona, USA' },
    portrait:
      '2023/06/Ashin-Kelasa-profile-image-for-Pali-Sutta-Reading-Class.png',
  },
  {
    id: 'kovida',
    slug: 'ashin-kovida-bio',
    names: { my: 'အရှင်ကောဝိဒ (ဆိပ်ဖြူ)', en: 'Ashin Kovida (Seikphyu)' },
    place: { en: 'Pa-Auk tradition', my: 'ဖားအောက်' },
    portrait: '2023/11/Ashin-Kovida-bio.jpg',
  },
  {
    id: 'kumarabhivamsa',
    slug: 'sayadaw-kumarabhivamsa-bio',
    names: {
      my: 'ဘဒ္ဒန္တ ကုမာရာဘိဝံသ (ဖားအောက်)',
      en: 'Bhaddanta Kumārābhivaṃsa (Pa-Auk)',
    },
    portrait: '2022/03/Kumarābhivaṃsa-sm.jpg',
  },
  {
    id: 'janakabhivamsa',
    slug: 'sayadaw-janakabhivamsa-bio',
    names: {
      my: 'ဘဒ္ဒန္တ ဇနကာဘိဝံသ (ဖားအောက်)',
      en: 'Bhaddanta Janakābhivaṃsa (Pa-Auk)',
    },
    portrait: '2022/03/ဘဒ္ဒန္တဇနကာဘိဝံသ-sm.jpg',
  },
  {
    id: 'pannadhikalankara',
    slug: 'venerable-pannadhikalankara-bio',
    names: { en: 'Venerable Paññādhikālaṅkāra' },
    portrait: '2022/08/panaadica-4.jpeg',
  },
  {
    id: 'kundadhana',
    slug: 'ashin-kundadhana-bio',
    names: { my: 'အရှင်ကုဏ္ဍဓာန (ထားဝယ်)', en: 'Ashin Kuṇḍadhāna (Dawei)' },
    place: { en: 'Dawei, Myanmar', my: 'ထားဝယ်' },
    portrait: '2025/03/U-Kun_Photo-31-2.jpeg',
  },
];

const decode = (text) =>
  text
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;|&#8220;|&#8221;/g, '"')
    .replace(/&#8217;|&#039;|&#8216;/g, "'")
    .replace(/&#8211;|&#8212;/g, '–')
    .replace(/&#(\d+);/g, (_m, n) => String.fromCodePoint(Number(n)));
const clean = (html) =>
  decode(html.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ''))
    .normalize('NFC')
    .replace(/[\u200b-\u200d]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
const isBurmese = (text) => /[က-႟]/.test(text);
const cdnBase =
  'https://bunny-wp-pullzone-vixrt9neqs.b-cdn.net/wp-content/uploads/';

async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  return response.text();
}
async function headOk(url) {
  const response = await fetch(url, { method: 'HEAD' });
  return response.ok;
}

/** Headings and paragraphs of the article, split by script into Burmese and English sections. */
function parseArticle(html) {
  const article = /<article\b[\s\S]*?<\/article>/.exec(html)?.[0] ?? html;
  const out = { my: [], en: [] };
  const current = { my: null, en: null };
  const start = (lang, heading) => {
    current[lang] = { ...(heading ? { heading } : {}), paragraphs: [] };
    out[lang].push(current[lang]);
  };
  let skipping = false;
  for (const match of article.matchAll(
    /<(h[1-6]|p|li|tr)\b[^>]*>([\s\S]*?)<\/\1>/g,
  )) {
    const [, tag, inner] = match;
    const text = clean(inner);
    if (!text) continue;
    if (tag === 'h1') continue; // the page title
    const boldOnly =
      tag === 'p' &&
      /^\s*<(strong|b)\b[^>]*>[\s\S]*<\/\1>\s*$/.test(inner) &&
      text.length <= 60;
    if (/^h[2-6]$/.test(tag) || boldOnly) {
      skipping = /^related sites$/i.test(text); // external link lists are not copied
      start(isBurmese(text) ? 'my' : 'en', text);
      continue;
    }
    if (skipping) continue;
    if (/^(share|like this|related)\b/i.test(text)) continue;
    const lang = isBurmese(text) ? 'my' : 'en';
    if (!current[lang]) start(lang);
    current[lang].paragraphs.push(text);
  }
  for (const lang of ['my', 'en'])
    out[lang] = out[lang].filter((section) => section.paragraphs.length > 0);
  return out;
}

const previous = existsSync(new URL('content/teachers.json', root))
  ? JSON.parse(readFileSync(new URL('content/teachers.json', root), 'utf8'))
  : [];
mkdirSync(new URL('assets/people/', root), { recursive: true });
const sources = [];
const result = [];

for (const teacher of teachers) {
  const url = `${site}${teacher.slug}/`;
  const html = await fetchText(url);
  const parsed = parseArticle(html);
  const old = previous.find((entry) => entry.id === teacher.id);
  const bio = {};
  const count = (lang) =>
    parsed[lang].reduce((sum, section) => sum + section.paragraphs.length, 0);
  for (const lang of ['my', 'en']) {
    if (!parsed[lang].length) continue;
    // A one-line English leftover (a website name, say) next to a Burmese bio is not a translation.
    if (lang === 'en' && parsed.my.length && count('en') < 3) continue;
    // Text published by Win Metta itself in that language counts as reviewed; drafts do not.
    bio[lang] = { sections: parsed[lang], reviewed: true };
  }
  // Keep a hand-written or drafted translation that the source page does not provide.
  for (const lang of Object.keys(old?.bio ?? {}))
    if (!bio[lang]) bio[lang] = old.bio[lang];
  const sourceLanguage = parsed.my.length ? 'my' : 'en';
  for (const lang of Object.keys(bio))
    for (const section of bio[lang].sections)
      for (const text of [section.heading ?? '', ...section.paragraphs])
        if (hasZawgyiMarker(text))
          console.error(
            `zawgyi-suspect in ${teacher.id}: ${text.slice(0, 40)}`,
          );

  // Portrait: the largest published size (try without the -WxH suffix, then as listed).
  let photo;
  if (teacher.portrait) {
    const original = teacher.portrait.replace(/-\d+x\d+(\.\w+)$/, '$1');
    // The CDN path may use composed or decomposed Unicode; try both.
    const variants = [original, teacher.portrait].flatMap((c) => [
      c,
      c.normalize('NFC'),
      c.normalize('NFD'),
    ]);
    for (const candidate of [...new Set(variants)]) {
      const encoded =
        cdnBase + candidate.split('/').map(encodeURIComponent).join('/');
      if (!(await headOk(encoded))) continue;
      const bytes = Buffer.from(await (await fetch(encoded)).arrayBuffer());
      const extension = candidate.split('.').pop().toLowerCase();
      photo = `${teacher.id}.${extension}`;
      writeFileSync(new URL(`assets/people/${photo}`, root), bytes);
      sources.push(`| people/${photo} | ${encoded} | ${today} |`);
      break;
    }
  }
  result.push(
    teacherSchema.parse({
      id: teacher.id,
      sourceLanguage,
      names: teacher.names,
      ...(teacher.place ? { place: teacher.place } : {}),
      ...(photo ? { photo } : {}),
      bio,
      bioSourceUrl: url,
      sourceUrl: url,
      verifiedAt: today,
    }),
  );
  console.error(
    `${teacher.id}: ${Object.keys(bio).join('+')} (${parsed.my.length} my / ${parsed.en.length} en sections), photo ${photo ?? 'none'}`,
  );
}

writeFileSync(
  new URL('content/teachers.json', root),
  `${JSON.stringify(result, null, 2)}\n`,
);
writeFileSync(
  new URL('assets/SOURCES.md', root),
  `# Image sources\n\nImages copied from winmetta.org (the organization's own published content). Run the importers to refresh.\n\n| File | Source URL | Retrieved |\n| --- | --- | --- |\n${sources.join('\n')}\n`,
);
