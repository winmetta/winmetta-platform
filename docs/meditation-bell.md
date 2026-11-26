# Mini apps and the meditation bell

**Status:** planned 2026-11-25; stage 2 (mini apps foundation, with a placeholder bell page) built 2026-11-25; the bell itself is not built yet. The staged plan is in [implementation-plan.md](implementation-plan.md) §5E. An interactive design mockup was reviewed with the maintainer on 2026-11-25; this document records what it settled.

**Why:** Win Metta's retreats and online sittings use a bell to end a session. Today that is the retreat bell page at `retreat.winmetta.org`, built from the archived `winmetta-retreat-web` repository, with each retreat's bell times written into the code. Meditators also want a simple bell for their own sittings: ring once after 20 minutes, or at 6:00 AM tomorrow, or on a weekly practice schedule. A bell for anyone, with no login and nothing sent to a server, fits the mission and costs almost nothing to host.

This adds two things:

1. **Mini apps:** small, self-contained tools inside this site, listed on one page with app-style icons. The meditation bell is the first; a Burmese font converter (Unicode, Zawgyi, Win Innwa) is a likely second ([myanmar-converter.md](myanmar-converter.md)).
2. **The meditation bell:** a countdown timer, an alarm at a clock time, a manual "Ring bell now" button, and a weekly schedule with CSV import and export. Everything is stored in the browser.

---

## 1. Decisions (2026-11-25)

| Decision              | Choice                                                                                                                       | Notes                                                                                                                                                                   |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Where mini apps live  | **`/<locale>/mini-apps/`** (listing) and **`/<locale>/mini-apps/<slug>/`** (each app), first `meditation-bell`               | Inside `apps/web`, built as static pages like the rest of the site.                                                                                                     |
| Listing page          | **A normal site page** (header and footer) with a grid of app-style icons                                                   | Rounded-square icon, name below, a Beta or "Coming later" note. Driven by one registry file (section 2).                                                                |
| Mini app pages        | **Their own minimal layout:** no site header, footer or logo                                                                  | A slim top bar with **"← Mini apps"** (back to the listing) and the language switch. Section 2.                                                                         |
| Bell modes            | **Two: Timer and Schedule**, switched by a segmented control at the top of the app                                           | Timer covers a countdown and an alarm at a clock time. Daily is not a separate mode: the weekly schedule with "Every day" covers it.                                   |
| One or the other      | **A timer and the weekly schedule never run at the same time**                                                               | Starting a timer while the schedule is on asks first and turns the schedule off; turning the schedule on while a timer runs asks first and stops the timer. Section 4. |
| Turning off           | **Off never deletes.** A schedule that is turned off keeps its bells                                                         | The user turns it back on by hand; it does not come back by itself after a timer.                                                                                     |
| Storage               | **The browser only** (`localStorage`), versioned                                                                             | No account, no server, no sync. CSV export is the backup. Section 6.                                                                                                   |
| Interface language    | **English buttons and labels in both locales; Burmese only for alerts, notices and error messages**                          | Western digits (0–9) for every time, date and number, in both locales. A deliberate exception to the site's fully translated pages; section 7.                         |
| Bell sounds           | **WinMetta bell (short)** and **WinMetta bell (long)**, cut from Win Metta's own recording, plus **public-domain (CC0) bells** as each is cleared | A short bell to start a sitting, a long bell (by default rung 3 times) to end it. Each schedule bell has its own sound and ring count. Section 8.                       |
| Native apps           | **Later, not in this plan.** Bell logic is written so a desktop or mobile app can reuse it                                   | A browser cannot ring reliably with the tab closed or the phone locked. Section 9.                                                                                     |
| Analytics             | **Cookieless usage events for the timer and the schedule**, through the site's existing Umami setup                         | To learn which features are used. Bucketed counts only, never labels, times or schedule contents. Section 11 and [analytics.md](analytics.md) §3.                      |
| Feedback              | **A feedback button in the footer of every mini app**                                                                        | Opens the site's existing feedback dialog. Section 2.                                                                                                                  |
| Icons                 | **Designed in Canva** (through the Canva connector), exported as SVG and committed                                           | One set for every mini app. Section 2.1.                                                                                                                               |

Out of scope: accounts or sync between devices, uploading your own bell sounds, sharing a schedule by link, interval bells during a countdown, statistics shown to the user of any kind (minutes meditated, streaks), and the Burmese text converter itself (only its tile on the listing page).

---

## 2. Mini apps: listing page, registry and layout

**Registry.** One typed file, `apps/web/src/lib/mini-apps.ts`, lists every mini app: `id`, `slug`, icon, name and description message keys, and `status` (`beta`, `live` or `coming`). The listing page, the sitemap and later a desktop or mobile shell read it, so adding a mini app is one entry plus its page. A `coming` entry shows its tile with "Coming later" and no link.

**Listing page** (`/<locale>/mini-apps/`): uses the normal page layout (`layouts/Shell.astro`) with the header, footer and language switcher. A short intro ("Small tools for practice and study. Free, no sign-in, and your data stays on this device."), then a grid of tiles: a rounded-square icon (64 px on screen) and the name below, wrapping on phones. The icons are described in section 2.1.

**Mini app layout** (a new `layouts/MiniAppShell.astro`):

- **Keeps** what the main layout provides that every page needs: global styles and fonts (Noto Sans Myanmar), `<html lang>`, the title, canonical and `hreflang` alternates, the analytics component (it sends only page views unless an event is added), and the Beta label.
- **Drops** the site header, navigation, footer and logo, so the app gets the whole screen.
- **Top bar:** "← Mini apps" on the start side, a real link to `/<locale>/mini-apps/` (not `history.back()`, which goes nowhere when the app is opened from a shared link or a home-screen shortcut), and the language switch **EN | ကခဂ** on the end side. The ကခဂ button has `lang="my"` and the accessible name "Myanmar", and its text is vertically centred: Burmese glyphs are taller than Latin ones, so the button sets its own line height and is checked in a screenshot (the 2026-11-25 mockup clipped it). Switching language follows the site rule: only the locale segment of the address changes (AGENTS.md §6).
- **Leaving while a bell is set:** if a timer is running or paused, or the schedule is on, following "← Mini apps" or switching language asks first, and closing the tab triggers the browser's own leave warning. Timer and schedule state are saved anyway, so coming back resumes them (section 4).
- **Footer with a feedback button:** every mini app ends with a slim footer holding a **Feedback** button (an outline speech-bubble icon and the word, an icon-only button on narrow phones with the accessible name "Send feedback"). It opens the site's existing feedback dialog ([feedback.md](feedback.md)) with the `general` context, the mini app's name filled in as the item, and the "suggestion", "website" and "other" problem types, so reports reach the team without a new endpoint or context. It follows the site's other feedback links: shown only when `PUBLIC_FEEDBACK` is on (it is in production), and a `mailto:` message without JavaScript (`feedbackMailto` in `lib/feedback.ts`). The footer stays below the app's content and never covers it; it is the only footer content (no site links or logo).

**Navigation.** The listing page needs a menu link with an icon in `NavIcon.astro`. Where it goes, and its Burmese name, are open questions (section 12): the Dhamma Library menu already has "Dhamma Apps" (`studyApps`), a list of outside study apps, and the two names must not be confused.

**Design rules** for the listing page and every mini app are summarized in [design-guide.md](design-guide.md) §9, so later mini apps look and behave the same.

### 2.1 Icons (designed in Canva)

- **One set for all mini apps:** a rounded square, one flat background colour from the site palette per app, and one simple white or dark symbol in the middle (a bell for the meditation bell, Burmese letters for the text converter). No gradients, shadows, text or tiny detail, so it reads at 32 px.
- **Made in Canva** through the Canva connector, from basic shapes and lines drawn for this icon, not from Canva's stock elements, photos or illustrations, whose licence limits their use in logos and app icons (check Canva's current content licence when the icons are made). Win Metta's own artwork may be used.
- **Sizes:** designed on a 1024 × 1024 canvas so the same art can later be an installable-app, desktop or mobile app icon; exported as SVG for the site (and PNG at 1024 px for later app stores).
- **In the repo:** the cleaned SVG in `apps/web/src/assets/mini-apps/<id>.svg` (no embedded fonts or raster images, small enough to inline), named in the registry, and a line in `apps/web/src/assets/SOURCES.md` saying it was designed for Win Metta in Canva. The link to the Canva design is kept in the private repository, not here.
- **Checked** at 64 px and 32 px, in light and dark, next to the other tiles; a Burmese speaker checks any Burmese letters in an icon.

**Feature flag.** Like the Dāna page ([donations.md](donations.md)), the listing page and the bell are always built but stay unlinked, `noindex` and out of the sitemap until `PUBLIC_MINI_APPS=true`; the flag adds the menu link.

---

## 3. Timer mode

The Timer page has, from top to bottom: the bell settings button and the Countdown/Set alarm switch, the display, the minute presets, the custom-minutes field (countdown) or the "Ring at" time field (alarm), Start/Pause and Reset/Clear, and **Ring bell now**.

### 3.1 Countdown

- **Display:** a progress ring with the time left as `mm:ss`, or `mmm:ss` once the timer is 100 minutes or longer (for example `09:00`, `120:00`), and a status line (Ready, Sitting, Paused, Bell rang).
- **Presets:** 3, 5, 10, 15 (first row) and 30, 60, 90, 120 minutes (second row).
- **Custom minutes:** whole minutes from 1 to **960** (16 hours). Anything else shows an error under the field and changes nothing.
- **Start / Pause / Resume** and **Reset** (back to the chosen length). Choosing a preset stops a running timer and sets the new length.

### 3.2 Alarm

"Set alarm" replaces the ring with a **large clock**.

- **Presets** become "+N minutes from now" (the same eight values) and set the clock to now plus N, rounded to the minute.
- **Ring at:** a time field. The alarm is the next time that clock time occurs: a time that has already passed today means tomorrow, and the line under the clock says **"Rings tomorrow"** (or "Rings today") and how long until then.
- **Limit:** at most **16 hours** ahead. A time further away (for example 2:00 PM when it is now 7:00 PM) shows "Pick a time within the next 16 hours" and sets nothing.
- **Start / Pause / Resume** and **Clear** (removes the alarm). "Countdown" switches back.

### 3.3 Sound and the manual bell

- **Bell settings button** (top left, "🔔 Bells ▾"): opens a small panel with two rows, each sound with a play button to preview it:
  - **Start bell:** Off, or a sound (default: WinMetta bell (short), rung once). It rings when Start is pressed (not on Resume), so a sitting opens with one short ring.
  - **End bell:** a sound and 1x, 2x or 3x (default: WinMetta bell (long), 3x). It rings when the countdown or alarm ends.
  Choosing plays the choice once, shows a notice, and saves it. The end bell is also the default for new schedule bells.
- **Ring bell now:** plays the end bell's sound once, immediately, in both modes, whether or not a timer or schedule is active.

### 3.4 How the timer keeps time

- A running timer stores its **end as an absolute moment** (milliseconds since the epoch), never a count of ticks, so a slowed-down background tab, a reload or a closed and reopened tab cannot make it drift. Pausing stores the time left; resuming computes a new end.
- The page checks "has the end passed?" (about once a second when visible; on `visibilitychange` and `focus`). Browsers slow timers in hidden tabs, so a bell can be up to about a minute late in a background tab; that is accepted and stated in the help text.
- **Asleep or closed when the bell was due:** on return, a bell missed by **two minutes or less** still rings; an older one does not ring and shows a notice ("Your 6:00 AM bell was missed while this page was closed").
- **Audio needs a first tap:** browsers only allow sound after the user has interacted with the page. Start, a preset and "Ring bell now" all count; the audio is unlocked on the first of them. If the schedule is on and the page was just opened, a notice asks for one tap to enable sound.
- **Screen:** while a timer runs and the page is visible, the app asks the browser to keep the screen on (Screen Wake Lock API, where supported) and releases it when the timer stops.

---

## 4. Schedule mode

### 4.1 Weekly schedule

- **Header:** "Weekly schedule" and an **On/Off** switch.
- **Days:** a row of seven day buttons that always fits the screen (section 7.2); the selected day's bells are listed below, sorted by time, with the time, the label and "3x" when a bell rings more than once. Tapping a bell opens it for editing.
- **Buttons:** Add, Import, Export, and **Ring bell now**.
- **Help line:** "Bells ring only while this page is open", because that is true of every browser (section 9).
- There is no "Back to timer" button: the Timer/Schedule switch at the top is always visible.

### 4.2 Add or edit a bell

A full screen inside the app, with a back arrow.

- **Time** (required), **Label** (optional, up to 40 characters, for example "Walking meditation"), **Days** (one or more, with "Every day" and "Weekdays" shortcuts; the day being viewed is preselected), **Sound** (default: the Timer page's end bell sound), **Rings** (1x, 2x or 3x; default: the end bell's count), and **Test sound**.
- **Save / Cancel**, and **Delete** when editing.
- **Errors:** no time, no day, or a time that already has a bell on one of the chosen days ("A bell at 6:00 AM is already set on Tuesday").
- Editing a bell may move it to other days; it is saved on every chosen day.

### 4.3 One or the other

- **Schedule on, user presses Start on the Timer page:** a confirmation at the top: "Starting a timer turns off your weekly schedule. Your schedule is kept and you can turn it back on later." [Turn off and start] [Cancel].
- **Timer running or paused, user turns the schedule on:** "Turning on the schedule stops the running timer." [Stop timer and turn on] [Cancel].
- Switching between the Timer and Schedule tabs changes nothing by itself; only Start and the On switch do.

### 4.4 How the schedule keeps time

- Bell times are **local wall-clock times** in the device's time zone, so 6:00 AM stays 6:00 AM across daylight-saving changes and when the device moves zones. The next bell is computed with Luxon, already a dependency. A time skipped by a daylight-saving change rings at the next valid minute; a time that occurs twice rings once.
- The same checks as the timer apply (section 3.4): absolute next-bell moment, checks on visibility, the two-minute rule for missed bells, and the first-tap audio unlock.
- **Keep screen on:** the schedule page offers a "Keep screen on" switch (off by default) for a retreat-room display, using the same Wake Lock API.

---

## 5. Alerts and notices

All alerts and notices appear **at the top of the app, just under the Timer/Schedule switch**, never at the bottom, so they are seen without scrolling.

- **Confirmations** (amber, with buttons, `role="alertdialog"`): the two "one or the other" questions (section 4.3) and "This replaces your whole weekly schedule. Export it first if you may want it back." before an import that replaces it.
- **Notices** (green, `role="status"`, close after 4 seconds or with ✕): bell saved or deleted, imported, exported, bell settings changed, schedule turned on or off, a missed bell.
- **Errors** appear next to the field they are about (custom minutes, the alarm time, the add-bell form, the import screen) as well as in the screen reader's live region.
- Messages name days in full ("Monday", never "Mo" or "Mon") and use Western digits, in both locales.

---

## 6. Storage and CSV

### 6.1 Browser storage

One `localStorage` key, `winmetta.meditationBell`, holds a JSON object with a `version` field, validated with a Zod schema on read. An unknown or broken value is not deleted: the app starts empty, keeps the old value under a backup key and shows a notice. Contents: the start and end bell settings, the weekly schedule (bells per day) and whether it is on, and the running or paused timer or alarm (mode, end moment or time left, length).

- **No IndexedDB:** the data is a few kilobytes. IndexedDB becomes worth it only if users can store their own sounds, which is out of scope.
- **Storage can be wiped:** Safari may delete a site's storage after about seven days without a visit, and private windows forget it. Export is the backup, and the help on the schedule page says so. The app also calls `navigator.storage.persist()` when the schedule is first saved, where supported.
- **Blocked storage:** the bell still works for the visit (timer and manual bell) and says that the schedule can't be saved.
- **Settings and Privacy:** the Settings page Reset does **not** clear the bell's data, because it is the user's own content, not a preference. A separate Settings row, "Meditation bell data", with a red Clear button and a confirmation, removes it. The bilingual Privacy page gets a paragraph: the schedule, sound choice and timer stay on the device and are never sent anywhere.

### 6.2 CSV format

```text
day,time,label,sound,rings
Mon,06:00,Morning sitting,winmetta-long,3
Mon,09:00,Dhamma talk,winmetta-short,1
Sun,19:00,Evening chanting,winmetta-long,1
```

- **Columns:** `day` (`Mon` to `Sun`), `time` (24-hour `HH:MM`, `00:00` to `23:59`), `label` (optional, up to 40 characters), `sound` (a sound id from section 8, for example `winmetta-long`; an unknown or missing id falls back to the end bell's sound, and the preview says so), `rings` (1 to 3, default 1). The header row is required. Quoted fields follow RFC 4180, so a label may contain a comma.
- **Export** downloads `winmetta-bell-schedule.csv`, UTF-8 **with a byte-order mark**, so Excel shows Burmese labels correctly; Google Sheets and Numbers ignore the mark. Export never includes the timer.
- **Import** opens a screen with "Choose CSV file", reads the file in the browser (it is never uploaded), and shows a **preview**: how many bells are ready per day, and every row that will be skipped with its row number and reason (unknown day, invalid time, rings out of range). The user picks **Replace the whole schedule** (asks first, section 5) or **Add to the current schedule** (a time that already has a bell on that day is skipped). A file with no valid rows imports nothing.
- **Size limit:** files over 100 KB or with more than 700 bells (100 a day) are refused with a message, to keep a mistaken file from freezing the page.
- This lets organizers publish a retreat's bell schedule as a CSV that participants import, instead of times written into code as in the old retreat page.

---

## 7. Language and layout

### 7.1 Language (decided 2026-11-25)

The mini app's buttons and labels are **English in both locales**; only alerts, notices and error messages are translated into Burmese. Days, times, dates and numbers use English day names and Western digits in both locales.

- **Why:** the maintainer's choice for this app. Short English control words (Start, Reset, Schedule) are widely understood by the bell's users, and Burmese digits and day names make dense controls harder to read. The messages that explain a consequence ("this turns off your schedule") are the ones where a misunderstanding costs something, so they are translated.
- **How:** every string is still a message key in `en.json` and `my.json`, as the site requires (AGENTS.md §6). For the button and label keys, the `my` value is the English text, so a later change of mind is a content change only. A comment in the bell's code and this section explain why, so nobody "fixes" it.
- **Every button has an icon** next to its word, to help readers who read little English.
- Burmese messages keep common technical words in English (Timer, Schedule, import, export), as other pages do. All Burmese text needs a Burmese speaker's review before go-live.
- This exception covers the mini app pages only. The mini-apps listing page is fully translated, like every other site page.

### 7.2 Day names and narrow screens

- **Day buttons** use the longest form that fits: **"Monday"** on desktop and wide screens, **"Mon"** on tablets and wide phones, **"Mo"** only on narrow phones. The choice is made by the width available to the row (a container query), not by the device.
- The seven buttons share the row equally and may shrink (`minmax(0, 1fr)` grid columns), so Sunday is never cut off; this was a bug in the 2026-11-25 mockup at narrow widths. The same applies to the preset grid, the Add/Import/Export row and long bell labels, which are cut with an ellipsis.
- **Messages, alerts, notices and the CSV import preview always use full day names** ("Monday"), whatever the width. The CSV file itself uses `Mon` to `Sun`.
- Checked at 320 px, 375 px and desktop, in both locales, light and dark (AGENTS.md §6 asks for desktop and 375 px; the bell adds 320 px because of the seven-button row).

### 7.3 Design guide

The mockup is not the final styling. In stages 4 and 5 (implementation-plan §5E) the controls are mapped onto [design-guide.md](design-guide.md): the Timer/Schedule switch, the countdown/alarm switch and the rings choice are segmented choices; Start is the page's single primary button; Reset, Clear and Ring bell now are outline buttons; the guide reserves `.chip` for post topics, so the presets and day buttons need their own pattern (a toggle-button group). The shared mini app rules (layout, alerts at the top, day names, narrow screens) are already in [design-guide.md](design-guide.md) §9; component patterns it does not have yet (the preset grid, the day row, the countdown ring) are added there in the same PR.

---

## 8. Sounds

Decided 2026-11-25: the sounds come from **Win Metta's own bell recording** (section 8.1) and from **public-domain (CC0) recordings** (section 8.3), all prepared the same way (section 8.2). Canva is not used for sounds: its connector makes designs, not audio, and its audio library is licensed for use inside Canva designs, not as files given away on their own.

### 8.1 WinMetta bell, short and long

The source is `WinMetta_Meditation_Timer.mp3` from the archived `winmetta-retreat-web` repository (818 KB). **Confirm that Win Metta owns the recording before committing it or anything cut from it.** Two sounds are cut from it:

| Id               | Name                  | What it is                                                         | Default use                    |
| ---------------- | --------------------- | ------------------------------------------------------------------ | ------------------------------ |
| `winmetta-short` | WinMetta bell (short) | One strike, faded out after about 3–5 seconds                      | Start bell, rung once          |
| `winmetta-long`  | WinMetta bell (long)  | One strike with its whole natural decay, leading silence trimmed   | End bell, rung 3 times         |

Three rings are **not** a separate file: a bell set to 2x or 3x plays one strike that many times, each strike starting about 5 seconds after the one before (long enough to hear each, short enough to feel like one bell), so every sound works with every ring count.

### 8.2 Preparing a sound

- **One script, so it can be repeated:** `scripts/make-bell-sounds.sh` (written with the `bash-scripting` skill, macOS bash 3.2 compatible, checked with `shellcheck` and `shfmt`) takes a source recording and a short description of each cut (start, length, fade) and writes the sounds with `ffmpeg`. `ffmpeg` is installed with mise (`mise use ffmpeg` pins it in the repo's `mise.toml`); the script checks for it and says how to install it.
- **Same treatment for every sound:** trim leading silence, cut, fade out, mix to mono, normalize loudness (EBU R128, the same target for every sound, so switching sounds never changes the volume), and encode as MP3 at about 96 kbps. A short bell should come out well under 100 KB and a long one under 300 KB.
- **Where:** the source recordings in `apps/web/src/assets/audio-src/` (not served), the prepared files in `apps/web/public/audio/` with a content hash in the name, and every sound listed once in a sound registry in `lib/meditation-bell/` (id, name message key, file, length, licence). The registry is the fixed list the app, the CSV and the analytics events use.
- **Listening check:** the maintainer listens to every new sound on a phone speaker and on headphones, rung 1x and 3x, before it is added.

### 8.3 Public-domain (CC0) bells

To give more choice (a singing bowl, a deeper temple bell, a lighter chime), recordings released under **CC0** (public domain), for example on Freesound with its licence filter set to CC0, can be added.

- **CC0 only.** Not CC BY or other licences, so nothing needs on-screen credit and nothing can stop us using a sound later. Check the licence on each recording's own page (a site's filter is not proof) and save a copy of the page or its licence text with the date.
- **Recorded in `apps/web/src/assets/SOURCES.md`:** the sound id, title, author as given, source page address, licence, the date it was checked, and what was cut.
- **Prepared with the same script** (section 8.2), each as a short and/or long variant like the WinMetta bell, with ids such as `bowl-short` and `bowl-long`.
- **Few and calm:** at most about six sounds in the list in total, real bells and bowls only, no music, voices or nature sounds. A teacher or class host listens to a candidate before it is added.
- The three other sounds in `winmetta-retreat-web` (from insightmeditationcenter.org, onlinemeditationtimer.com and a Daniel Simon recording) are **not** copied: they are not CC0.

### 8.4 Loading and playing

- Sounds load when the user first opens the bell settings, presses Start or "Ring bell now", or turns the schedule on, not on page load, so opening the app downloads no audio. Only the sounds in use are loaded.
- The app ships with the two WinMetta sounds; CC0 sounds join the list as each one is cleared, with no change to the app beyond the registry.

---

## 9. Platform limits and the native apps

What a browser can and cannot do decides what the web version promises.

| Where                         | Timer and alarm                                    | Weekly schedule                                    |
| ----------------------------- | -------------------------------------------------- | -------------------------------------------------- |
| Desktop browser, tab open     | Works; up to about a minute late in a hidden tab   | Works while the tab is open and the computer awake |
| Desktop, computer asleep      | Does not ring; the two-minute rule on wake         | Same                                               |
| Phone browser, screen on      | Works while the page is visible                    | Works while the page is visible                    |
| Phone browser, screen locked  | **Does not ring** (the page is suspended)          | **Does not ring**                                  |

The web version says this plainly in its help text and does not try to work around it (no silent audio loops, no push notifications).

**Later, native apps** (not part of this plan; each needs its own plan and the maintainer's go-ahead, and AGENTS.md §9 lists native apps as deferred):

- **Code shape now, so reuse is cheap later:** the bell logic (section 10, `lib/meditation-bell/`) has no DOM, browser or audio calls. A small "bell player" interface (`ring(sound, times)`, `schedule(nextBells)`, `cancel()`) has a web implementation now; a desktop or mobile implementation can follow without changing the logic. The logic moves to a package under `packages/` only when a second app actually uses it (AGENTS.md §4).
- **Desktop (Electron):** the main process can ring on time with the window hidden and can keep the computer awake during a retreat.
- **Mobile (for example Capacitor):** the phone's operating system must ring the bells, as scheduled local notifications with a bundled sound. iOS keeps at most 64 pending local notifications, so a full weekly schedule must be scheduled a few days at a time; the silent switch and Focus modes may mute them, and iOS 26's AlarmKit is the stronger option to evaluate. Android needs exact alarms and Google Play's policy on them. Verify all of this against current platform documentation when that plan is written.
- **Installable web app (PWA):** each mini app could be installed on its own from its address. This is the deferred offline/PWA work and is not part of this plan.

---

## 10. Code layout and tests

- `apps/web/src/lib/mini-apps.ts`: the registry (section 2), with a test that every entry has both message keys and an icon.
- `apps/web/src/lib/meditation-bell/`: pure TypeScript, no DOM.
  - `schema.ts`: the Zod schema and version migration for the stored state.
  - `timer.ts`: the countdown and alarm state machine (start, pause, resume, reset, clear, finished, missed), driven by a clock passed in, so tests control time.
  - `alarm.ts`: "next occurrence of a clock time within 16 hours", including "Rings tomorrow" and the 16-hour limit.
  - `schedule.ts`: next bell across the week, duplicates, add, edit and delete, daylight-saving cases.
  - `csv.ts`: parse (with per-row errors) and serialize (with the byte-order mark).
  - `sounds.ts`: the sound registry (id, name key, file, length, licence; section 8.2).
  - `format.ts`: `mm:ss` / `mmm:ss`, 12-hour times, day names in their three lengths.
  - `days.ts`: the seven day ids (`Mon` to `Sun`) and their Luxon weekday numbers.
  - `player.ts`: the `BellPlayer` interface (`ring`, `schedule`, `cancel`) that a platform implements (section 9).
- `apps/web/src/components/meditation-bell/`: the React island (Timer, Schedule, edit and import screens, the alert area) and the web bell player (Web Audio API, Wake Lock).
- `apps/web/src/pages/[locale]/mini-apps/index.astro` and `[locale]/mini-apps/meditation-bell/index.astro`.
- **Unit tests (Vitest):** every module in `lib/meditation-bell/`, with fixed clocks and time zones (including a spring-forward and a fall-back day in `America/Los_Angeles`).
- **Analytics:** a unit test that every bell event's properties come from the fixed lists and buckets in section 11 (no free text can reach the tracker), as the site's existing analytics tests do.
- **Browser tests (Playwright):** the listing page; the back link; the footer Feedback button opening the dialog with the mini app filled in; the language switch keeping the page; a countdown finishing (with a fake clock); the alarm "Rings tomorrow" and 16-hour cases; both "one or the other" confirmations; add, edit and delete a bell; import with the sample file (preview, skipped rows, replace and add); export; the seven day buttons fitting at 320 px; screenshots in both locales.
- **Manual checks before go-live:** desktop Chrome, Firefox and Safari, and iPhone Safari and Android Chrome: sound after the first tap, a background tab, sleep and wake, the screen staying on.

---

## 11. Analytics

**Why:** to learn which parts of the bell people use (the countdown or the alarm, which lengths, the weekly schedule, CSV, the manual bell), so volunteer time goes to what helps. It uses the site's existing cookieless Umami setup and its rules ([analytics.md](analytics.md) §3–§4): no cookies or storage keys for tracking, no visitor ID, nothing typed, counts bucketed, nothing sent with Do Not Track. The events and the questions they answer are added to [analytics.md](analytics.md) §3 and §3.1 first (done in this plan's docs PR).

**Events** (names and properties; buckets for lengths are 1–5, 6–15, 16–30, 31–60, 61–120 and more than 120 minutes, and for bell counts 0, 1–5, 6–20 and more):

| Event                  | Properties                                                                                                        | Sent when                                                        |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `bell_timer_start`     | `mode` (`countdown`, `alarm`), `length` (bucket; for an alarm, the time until it rings), `from` (`preset`, `custom`, `time`), `start_bell` (true or false) | Start, not Resume                                                 |
| `bell_timer_end`       | `mode`, `how` (`rang`, `reset`, `cleared`, `missed`)                                                              | A started timer ends                                             |
| `bell_ring_now`        | `view` (`timer`, `schedule`)                                                                                      | Ring bell now                                                    |
| `bell_sound_change`    | `role` (`start`, `end`), `sound` (the sound's id from the fixed list, or `off` for the start bell), `rings` (1–3, end bell only) | The start or end bell setting is changed                         |
| `bell_schedule_switch` | `on` (true or false), `bells` (bucket of all bells in the week)                                                    | The schedule is turned on or off                                 |
| `bell_schedule_edit`   | `action` (`add`, `edit`, `delete`), `days` (`1`, `2-6`, `7`)                                                       | A bell is saved or deleted                                       |
| `bell_schedule_ring`   | none                                                                                                              | A scheduled bell rings                                           |
| `bell_conflict`        | `kind` (`start_timer`, `schedule_on`), `choice` (`confirm`, `cancel`)                                              | The "one or the other" confirmation is answered                  |
| `bell_csv`             | `action` (`import`, `export`), `ok` (true or false), `bells` (bucket), `skipped` (true or false), `how` (`replace`, `add`; import only) | An import or export finishes or fails                            |

Opening the listing page or a mini app is already counted as a page view, so there is no "open" event. The footer Feedback button uses the existing `feedback_open` and `feedback_submit` events (`ctx=general`; the page path tells the mini apps apart).

**Never sent:** bell labels, bell times or days of particular bells, the alarm's clock time, CSV contents or file names, the exact timer length, and anything from storage. Umami records the hour of every event, as it does for all events on the site, so `bell_schedule_ring` shows at which hours schedules ring in total; it is reported only in aggregate under the §3.1 rules (no group under 10).

**Privacy page:** its analytics paragraph lists what is counted; at go-live it adds "which mini app features, such as the timer and the schedule, are used (never your schedule or labels)" in both languages.

**Questions** these answer (added to [analytics.md](analytics.md) §3.1): Is the bell used, and which mode? Which timer lengths, and presets or custom? Do timers run to the bell? Do people keep a weekly schedule, and does it actually ring (is the page left open)? Does the "one or the other" rule get in the way (cancel rate)? Are CSV import and export used, and do imports fail? Is "Ring bell now" used, and which sound do people choose?

---

## 12. Open questions

- **Menu and name:** where the "Mini apps" link goes, and the Burmese name of the listing page. Stage 2 built it as its own first-level menu item after Dhamma Posts (shown only with `PUBLIC_MINI_APPS`), with the drafted Burmese name "အက်ပ်ငယ်များ" for a Burmese speaker to review; the alternative is a link under Dhamma Library next to "Dhamma Apps".
- **Confirmation that Win Metta owns the WinMetta bell recording** (section 8), before any file cut from it is committed.
- **Which CC0 bells to add** (section 8.3): a short list of candidates for the maintainer and a teacher to listen to.
- **The old retreat bell page:** whether `retreat.winmetta.org` should later point to the new bell, and how retreat organizers share their schedule CSV. Changing that host is a production change and needs its own approval.
