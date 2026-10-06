#!/usr/bin/env node
// One-off, read-only import of past retreats published on winmetta.org.
// The event list (dates, format, teacher, venue) is authored below from the retreat list page and
// each event page; the importer reads every event page for the timetable PDF,
// the per-day session posts and the class-notes posts, and writes src/content/retreats.json.
// It never copies phone numbers, e-mail addresses, registration forms, spreadsheets, chat invites
// or flyers that carry contact details.
//   node scripts/import-retreats.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { retreatSchema } from '../apps/web/src/lib/schemas.ts';

const root = new URL('../apps/web/src/', import.meta.url);
const today = new Date().toISOString().slice(0, 10);
const site = 'https://winmetta.org/';
const teachers = JSON.parse(
  readFileSync(new URL('content/teachers.json', root), 'utf8'),
);
const teacherName = (id, lang) =>
  teachers.find((t) => t.id === id)?.names[lang];

const ordinals = [
  ['1st', 'ပထမ'],
  ['2nd', 'ဒုတိယ'],
  ['3rd', 'တတိယ'],
  ['4th', 'စတုတ္ထ'],
  ['5th', 'ပဉ္စမ'],
  ['6th', 'ဆဋ္ဌမ'],
  ['7th', 'သတ္တမ'],
  ['8th', 'အဋ္ဌမ'],
  ['9th', 'နဝမ'],
  ['10th', 'ဒသမ'],
  ['11th', 'ဧကာဒသမ'],
  ['12th', 'ဒွါဒသမ'],
  ['13th', 'တေရသမ'],
];
const oakland = {
  name: { en: 'Mettananda Vihara', my: 'မေတ္တာနန္ဒဝိဟာရကျောင်း' },
  city: 'Oakland, CA, USA',
  address: '2707 Seminary Ave, Oakland, CA',
  mapUrl: 'https://maps.app.goo.gl/PCvzspZTcaEW19QQ6',
};
const fremont = {
  name: { en: 'Kusalakari Monastery', my: 'ကုသလကာရီဘုန်းတော်ကြီးကျောင်း' },
  city: 'Fremont, CA, USA',
  address: '40174 Spady St, Fremont, CA 94538',
};

// [slug, start date, ordinal index]; every Mettānanda retreat is 10 days (end = start + 9).
const series = [
  ['2020-dec-10-days-meditation-retreat', '2020-12-25'],
  ['2021-april-10-days-meditation-retreat', '2021-04-16'],
  ['2021-sep-10-days-meditation-retreat', '2021-09-03'],
  ['2021-dec-10-days-meditation-retreat', '2021-12-24'],
  ['5th-zoom-online-10-days-meditation-retreat', '2022-04-09'],
  ['6th-zoom-online-10-days-meditation-retreat', '2022-09-02'],
  ['2022-dec-23-7th-zoom-online-10-days-meditation-retreat', '2022-12-23'],
  ['2023-may-26-8th-zoom-online-10-days-meditation-retreat', '2023-05-26'],
  ['2023-sep-1-9th-zoom-online-10-days-meditation-retreat', '2023-09-01'],
  ['2023-dec-22-10th-zoom-online-10-days-meditation-retreat', '2023-12-22'],
  ['2024-oct-25-11th-zoom-online-10-days-meditation-retreat', '2024-10-25'],
  ['2025-apr-18-12th-10-days-meditation-retreat', '2025-04-18', oakland],
  [
    '2025-dec-25-retreat-13th',
    '2025-12-25',
    oakland,
    'https://winmetta.org/2025/12/19/2025-dec-25-retreat-13th-news/',
  ],
];
const addDays = (date, n) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + n * 864e5)
    .toISOString()
    .slice(0, 10);

const events = series.map(([slug, start, venue, url], index) => ({
  id: `ghositabhivamsa-${String(index + 1).padStart(2, '0')}-${start.slice(0, 7)}`,
  url: url ?? `${site}${slug}/`,
  start,
  days: 10,
  format: venue ? 'hybrid' : 'online',
  venue,
  teacherId: 'ghositabhivamsa',
  languages: ['my'],
  ordinal: ordinals[index],
  series: 'ghositabhivamsa-10-day',
}));
events.push(
  {
    id: 'kovida-2024-07',
    url: `${site}2024/06/29/ashin-koivda-10-day-online-meditation-retreat-in-2024/`,
    start: '2024-07-22',
    days: 10,
    format: 'online',
    teacherId: 'kovida',
    languages: ['my', 'en'],
    series: 'kovida-10-day',
  },
  {
    id: 'kundadhana-2025-04',
    url: `${site}2025/03/23/ashin-kunda-dhana-daweis-3-day-meditation-retreat/`,
    start: '2025-04-05',
    days: 3,
    format: 'hybrid',
    venue: fremont,
    teacherId: 'kundadhana',
    languages: ['my'],
    series: 'kundadhana-3-day',
  },
);

const decode = (text) =>
  text
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&amp;|&#038;/g, '&')
    .replace(/&#8211;|&ndash;/g, '–')
    .replace(/&#8217;|&rsquo;/g, '’')
    .replace(/&quot;|&#8220;|&#8221;/g, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)));
const strip = (html) =>
  decode(html.replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
const get = async (url) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response;
};

// Retreat photos are deliberately not imported: the published ones are Zoom gallery screenshots
// and group photos showing many lay participants (faces and names), who have not agreed to a
// permanent public copy in this repository. The schema keeps `bannerImage` for a future,
// consented image.
// Hand-reviewed fixes: post URL -> day, for any session the page order gets wrong.
// 5th retreat: the evening talks are numbered (1), (2)(3), (4), (5) and then a second series
// (1) to (5), so the list position runs one behind from (4) on. Days confirmed by the post dates.
const sessionDayOverrides = {
  'https://winmetta.org/2022/04/11/5th-zoom-online-10-days-meditation-retreat-evening-4/': 4,
  'https://winmetta.org/2022/04/12/5th-zoom-online-10-days-meditation-retreat-evening/': 5,
};

const digitsOf = (text) =>
  text.replace(/[၀-၉]/g, (digit) => String('၀၁၂၃၄၅၆၇၈၉'.indexOf(digit)));

/**
 * Sessions as listed on the retreat page. The day is never taken from the WordPress post date:
 * a recording is often published a day or more after the session. It comes from, in order,
 * a reviewed override, a day number in the title ("နေ့ (၂) – …", "Day 2"), and finally the
 * session's position in the page's own list: the n-th morning talk and the n-th evening talk
 * belong to day n.
 */
function sessions(html, event) {
  const found = new Map();
  for (const match of html.matchAll(
    /<a [^>]*href="(https:\/\/winmetta\.org\/(\d{4})\/(\d{2})\/(\d{2})\/[^"]+)"[^>]*>(.*?)<\/a>/gs,
  )) {
    const [, url, year, month, day, inner] = match;
    const title = strip(inner);
    if (
      !title ||
      /class-notes|news|bio|zoom-help|newsletter|announcement|retreat-schedule/i.test(
        url,
      ) ||
      /မှတ်စု|notes/i.test(title) ||
      found.has(url)
    )
      continue;
    // Membership only: the post must fall in the retreat's window, with room for late uploads.
    const lag =
      (Date.parse(`${year}-${month}-${day}`) - Date.parse(event.start)) / 864e5;
    if (lag < -1 || lag > event.days + 3) continue;
    const text = `${title} ${url}`;
    const part = /closing|ဓမ္မပူဇာ|အောင်ပွဲ/i.test(text)
      ? 'closing'
      : /morning|နံနက်/i.test(text)
        ? 'morning'
        : /evening|ညနေ|ည /i.test(text)
          ? 'evening'
          : 'other';
    const named = digitsOf(title).match(/(?:နေ့|day)\s*\(?\s*(\d{1,2})\s*\)?/i);
    found.set(url, {
      part,
      title,
      postUrl: url,
      named: named ? Number(named[1]) : undefined,
    });
  }
  const seen = { morning: 0, evening: 0 };
  let lastDay = 1;
  const result = [...found.values()].map(({ named, ...session }) => {
    let day = sessionDayOverrides[session.postUrl] ?? named;
    if (day === undefined && session.part in seen) day = ++seen[session.part];
    if (day === undefined)
      day = session.part === 'closing' ? event.days : lastDay;
    day = Math.min(Math.max(day, 1), event.days);
    if (session.part in seen)
      seen[session.part] = Math.max(seen[session.part], day);
    lastDay = day;
    return { day, ...session };
  });
  const order = ['morning', 'evening', 'other', 'closing'];
  return result.sort(
    (x, y) => x.day - y.day || order.indexOf(x.part) - order.indexOf(y.part),
  );
}

function documents(html) {
  const timetables = new Map();
  const notes = new Map();
  for (const match of html.matchAll(
    /<a [^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gs,
  )) {
    const url = match[1].replace(/^http:/, 'https:');
    const label = strip(match[2]);
    const generic = /^(download|click|ဒေါင်း)|click here|ဒေါင်းယူ/i.test(label);
    if (
      /\.pdf($|\?)/i.test(url) &&
      /time\s*-?table|schedule|ဇယား/i.test(`${label} ${url}`) &&
      !/invit|ဖိတ်/i.test(`${label} ${url}`)
    ) {
      if (label && !generic && label !== 'Download')
        timetables.set(url, { label, url });
      else if (!timetables.has(url))
        timetables.set(url, {
          label: decodeURIComponent(url.split('/').pop())
            .replace(/\.pdf$/i, '')
            .replace(/[-_]+/g, ' '),
          url,
        });
    }
    if (
      /^https:\/\/winmetta\.org\/\d{4}\/\d{2}\/\d{2}\//i.test(url) &&
      (/class-notes/i.test(url) || /မှတ်စု|notes/i.test(label)) &&
      label
    )
      notes.set(url, { label, url });
  }
  return { timetables: [...timetables.values()], notes: [...notes.values()] };
}

const records = [];
for (const event of events) {
  const html = await (await get(event.url)).text();
  const content =
    html.match(/<div class="entry-content[\s\S]*?<\/article>/)?.[0] ??
    html.match(/<article[\s\S]*?<\/article>/)?.[0] ??
    html;
  const end = addDays(event.start, event.days - 1);
  const nameEn = teacherName(event.teacherId, 'en');
  const nameMy = teacherName(event.teacherId, 'my');
  const ordinal = event.ordinal;
  const titleEn = `${ordinal ? `${ordinal[0]} ` : ''}${event.days}-day retreat`;
  const titleMy = `${ordinal ? `${ordinal[1]}အကြိမ် ` : ''}${event.days} ရက် တရားစခန်း`;
  const record = {
    id: event.id,
    status: 'past',
    format: event.format,
    days: event.days,
    startDate: event.start,
    endDate: end,
    timezone: 'America/Los_Angeles',
    teacherIds: [event.teacherId],
    languages: event.languages,
    sourceLanguage: 'my',
    translations: {
      my: {
        title: titleMy,
        description: `${nameMy} ဦးဆောင်သော ${event.days} ရက် တရားစခန်း`,
      },
      en: {
        title: titleEn,
        description: `A ${event.days}-day meditation retreat led by ${nameEn}.`,
      },
    },
    series: event.series,
    ...(event.venue ? { venue: event.venue } : {}),
    sessions: sessions(content, event),
    ...documents(content),
    sourceUrl: event.url,
    verifiedAt: today,
  };
  records.push(retreatSchema.parse(record));
  console.log(
    `${event.id}: ${record.sessions.length} sessions, ${record.timetables.length} timetables, ${record.notes.length} notes`,
  );
}

records.sort((a, b) => b.startDate.localeCompare(a.startDate));
writeFileSync(
  new URL('content/retreats.json', root),
  `${JSON.stringify(records, null, 2)}\n`,
);
