# Meditation bell: Burmese text review

This is a review package for a native Burmese reader. It collects every Burmese message of the meditation bell mini app (`/my/mini-apps/meditation-bell/`) exactly as it is in `apps/web/src/i18n/messages/my.json` today, next to the English text. Nothing here has been rewritten; the Burmese is Unicode and is copied as is.

## What the app does

The meditation bell rings a bell for a sitting. In **Timer** mode it counts down a number of minutes or rings at a chosen clock time. In **Schedule** mode it rings bells on a weekly timetable. It only rings while the page is open, and everything stays on the reader's own device.

## How to review

Fill in the **Review** column of each row with one of:

- **OK**: the Burmese is correct and natural.
- **change to ...**: write the Burmese you would use instead.
- **unclear**: you cannot tell what the sentence is meant to say; add a note.

Please check meaning, spelling, politeness level and whether a reader who knows little English would understand it. Everything marked **AI** in the *Written in* column was written by an AI assistant and has never been checked by a Burmese speaker (pull requests #74 and #76). Rows marked **Earlier PR** were written before and are included only so that every key is covered; they need a look only if something bothers you.

## How to read the tables

- `{day}`, `{time}`, `{count}`, `{added}`, `{skipped}`, `{row}`, `{reason}`, `{n}` are placeholders the app fills in (a day name such as Monday, a time such as 06:30, a number). Keep them in the Burmese text.
- **Type** is *Translated* when the Burmese differs from the English, and *English by design* when the Burmese is the English word or phrase on purpose. The app keeps button and label words in English in both languages (Start, Reset, Schedule, Import and so on) and translates only alerts, notices, errors and explanatory text. If a row is *English by design* you only need to say whether you agree, or give a Burmese alternative.
- Day names (Mon to Sun) and times in the app are English with Western digits 0-9 in both languages, on purpose. In messages the day is written with its full English name (for example Monday) and followed by နေ့.
- The CSV file the app exports uses English column names and day names (`Mon` to `Sun`).

## 1. Header and page shell (every bell screen)

| Key | Where shown | English | Burmese (current) | Type | Written in | Review |
| --- | --- | --- | --- | --- | --- | --- |
| `miniAppBackText` | Visible back link at the start of the bell header (goes to the Mini Apps list) | Mini Apps | Mini Apps | English by design | AI, #76 |  |
| `miniAppBack` | Back link text in the mini app page shell | Mini Apps | အက်ပ်ငယ်များ | Translated | Earlier PR |  |
| `miniAppBackLabel` | Screen-reader label of the back link (not visible) | Back to Mini Apps | အက်ပ်ငယ်များသို့ ပြန်သွားရန် | Translated | Earlier PR |  |
| `miniAppFeedback` | Feedback link in the header (text is hidden on phones, icon only) | Feedback | Feedback | English by design | Earlier PR |  |
| `miniAppLanguageEnglish` | Language switch button, name of English | English | English | English by design | Earlier PR |  |
| `miniAppLanguageMyanmar` | Language switch button, name of Myanmar | Myanmar | Myanmar | English by design | Earlier PR |  |
| `miniAppLeaveConfirm` | Browser dialog when you leave or close the page while a timer or the weekly schedule is running | Your timer or weekly schedule is still running. Bells ring only while this page is open, so leaving stops them. Your settings stay saved on this device. Leave this page? | သင့် Timer သို့မဟုတ် အပတ်စဉ် Schedule ကို ဆက်လည်ပတ်နေပါသည်။ ခေါင်းလောင်းသည် ဤစာမျက်နှာ ဖွင့်ထားစဉ်တွင်သာ မြည်သဖြင့် ထွက်ပါက ရပ်သွားပါမည်။ သတ်မှတ်ချက်များကို ဤစက်ထဲတွင် ဆက်သိမ်းထားပါမည်။ ဤစာမျက်နှာမှ ထွက်မလား။ | Translated | AI, rewritten in #76 |  |

## 2. Timer: view switch, modes and controls

| Key | Where shown | English | Burmese (current) | Type | Written in | Review |
| --- | --- | --- | --- | --- | --- | --- |
| `bellViewLabel` | Screen-reader label of the Timer / Schedule switch (not visible) | Meditation Bell view | Meditation Bell view | English by design | AI, #76 |  |
| `bellTimerHeading` | Timer / Schedule switch, first tab | Timer | Timer | English by design | AI, #74 |  |
| `bellScheduleHeading` | Timer / Schedule switch, second tab; also the Schedule screen heading | Schedule | Schedule | English by design | AI, #76 |  |
| `bellModeCountdown` | Timer mode choice | Countdown | Countdown | English by design | AI, #74 |  |
| `bellModeAlarm` | Timer mode choice | Set alarm | Set alarm | English by design | AI, #74 |  |
| `bellPresets` | Heading of the minute buttons in Countdown mode | Minutes | Minutes | English by design | AI, #74 |  |
| `bellAlarmPresets` | Heading of the preset buttons in Alarm mode | Minutes from now | Minutes from now | English by design | AI, #76 |  |
| `bellPresetMinutes` | Countdown preset button, for example "10 min" | {n} min | {n} min | English by design | AI, #74 |  |
| `bellPresetPlus` | Alarm preset button, for example "+30 min" | +{n} min | +{n} min | English by design | AI, #74 |  |
| `bellCustomMinutes` | Label of the custom minutes box | Custom minutes | Custom minutes | English by design | AI, #74 |  |
| `bellRingAt` | Label of the alarm time picker | Ring at | Ring at | English by design | AI, #74 |  |
| `bellAlarmPrompt` | Hint under the alarm time picker before a time is chosen | Pick a time or a preset | အချိန်တစ်ခု သို့မဟုတ် ကြိုတင်သတ်မှတ်ထားသော မိနစ်ကို ရွေးပါ။ | Translated | AI, #76 |  |
| `bellTimeLeft` | Not read by the code (the countdown ring uses `bellRingAria`) | Time left | Time left | English by design | AI, #74 |  |
| `bellRingAria` | Screen-reader label of the countdown ring (not visible) | Time left | Time left | English by design | AI, #74 |  |
| `bellStart` | Start button | Start | Start | English by design | AI, #74 |  |
| `bellPause` | Pause button | Pause | Pause | English by design | AI, #74 |  |
| `bellResume` | Resume button | Resume | Resume | English by design | AI, #74 |  |
| `bellReset` | Reset button | Reset | Reset | English by design | AI, #74 |  |
| `bellRingNow` | Ring now button (manual bell) | Ring now | Ring now | English by design | AI, #74 |  |
| `bellHelp` | Short help line under the Timer controls | Bells ring only while this page is open. | ခေါင်းလောင်းသည် ဤစာမျက်နှာ ဖွင့်ထားစဉ်တွင်သာ မြည်ပါမည်။ | Translated | AI, #74 |  |

## 3. Timer: status line

| Key | Where shown | English | Burmese (current) | Type | Written in | Review |
| --- | --- | --- | --- | --- | --- | --- |
| `bellStatusReady` | Status under the countdown | Ready | Ready | English by design | AI, #74 |  |
| `bellStatusPaused` | Status under the countdown | Paused | Paused | English by design | AI, #74 |  |
| `bellStatusRang` | Status after the bell has rung | Bell rang | Bell rang | English by design | AI, #74 |  |
| `bellStatusMissed` | Status after a bell was missed | Bell missed | Bell missed | English by design | AI, #74 |  |
| `bellRunning` | Shown while the timer or schedule is running (also on the Schedule tab) | Running | Running | English by design | AI, #76 |  |
| `bellDismiss` | Close button of a notice (screen-reader label) | Close | Close | English by design | AI, #74 |  |

## 4. Timer: Bells Settings

| Key | Where shown | English | Burmese (current) | Type | Written in | Review |
| --- | --- | --- | --- | --- | --- | --- |
| `bellBells` | Heading of the Bells Settings section | Bells Settings | Bells Settings | English by design | AI, #74 |  |
| `bellStartBell` | Label of the start bell choice | Start button bell | Start button bell | English by design | AI, #74 |  |
| `bellStartBellHelp` | Help line under the start bell choice | Rings once when you press Start on the Timer (not on Resume). | Timer တွင် Start ကို နှိပ်သောအခါ တစ်ကြိမ် မြည်ပါသည်။ (Resume တွင် မမြည်ပါ။) | Translated | AI, #76 |  |
| `bellEndBell` | Label of the alarm bell choice | Alarm bell | Alarm bell | English by design | AI, #74 |  |
| `bellEndBellHelp` | Help line under the alarm bell choice | Rings when the countdown or alarm ends. Also the starting sound for new schedule bells and for Ring now. | Countdown သို့မဟုတ် Alarm ပြီးဆုံးသောအခါ မြည်ပါသည်။ အချိန်ဇယားထဲ ခေါင်းလောင်းအသစ်များနှင့် Ring now အတွက်လည်း ပထမဆုံး အသံအဖြစ် သုံးပါသည်။ | Translated | AI, #76 |  |
| `bellOff` | "Off" choice for a sound (also in the Schedule form) | Off | Off | English by design | AI, #74 |  |
| `bellRings` | Label of the ring count choice (also in the Schedule form) | Rings | Rings | English by design | AI, #74 |  |
| `bellRingsHelp` | Help line under the ring count choice | How many times the alarm bell strikes each time it rings. Choosing a sound or a count does not play it: press Play to listen. | ခေါင်းလောင်းသံ တစ်ကြိမ်မြည်တိုင်း ထိုးသည့် အကြိမ်အရေအတွက်။ အသံ သို့မဟုတ် အကြိမ်ရေ ရွေးရုံဖြင့် မမြည်ပါ။ နားထောင်ရန် Play ကို နှိပ်ပါ။ | Translated | AI, #76 |  |
| `bellPlay` | Play button to hear the chosen sound | Play | Play | English by design | AI, #74 |  |
| `bellStop` | Stop button (also on the Schedule tab) | Stop | Stop | English by design | AI, #76 |  |
| `bellSoundSoftChime` | Sound name in the sound lists | Soft chime (synth) | Soft chime (synth) | English by design | AI, #76 |  |
| `bellSoundDeepChime` | Sound name in the sound lists | Deep chime (synth) | Deep chime (synth) | English by design | AI, #76 |  |
| `bellSoundLongChime` | Sound name in the sound lists | Long chime (synth) | Long chime (synth) | English by design | AI, #76 |  |
| `bellNoticeSaved` | Notice after Bells Settings are saved | Bell settings saved. | ခေါင်းလောင်း သတ်မှတ်ချက်ကို သိမ်းပြီးပါပြီ။ | Translated | AI, #74 |  |

## 5. Dialogs and conflict prompts

| Key | Where shown | English | Burmese (current) | Type | Written in | Review |
| --- | --- | --- | --- | --- | --- | --- |
| `bellScheduleEnableSound` | Button of the enable-sound prompt (browsers need a tap before sound can play) | Enable sound | Enable sound | English by design | AI, #76 |  |
| `bellScheduleAudioPrompt` | Text of the enable-sound prompt, shown when the schedule is on but sound is not yet allowed | Enable sound so your scheduled bells can ring. | အချိန်ဇယားအတိုင်း ခေါင်းလောင်းမြည်ရန် အသံဖွင့်ပါ။ | Translated | AI, #76 |  |
| `bellConflictStart` | Prompt when you press Start while the weekly schedule is on | Starting a timer turns off your weekly schedule. Your schedule is kept and you can turn it back on later. | Timer စတင်ပါက အပတ်စဉ် အချိန်ဇယား ပိတ်သွားပါမည်။ အချိန်ဇယားကို သိမ်းထားပြီး နောက်မှ ပြန်ဖွင့်နိုင်ပါသည်။ | Translated | AI, #76 |  |
| `bellConflictStartAction` | Button of that prompt | Turn off and start | Turn off and start | English by design | AI, #76 |  |
| `bellConflictSchedule` | Prompt when you turn the schedule on while a timer is running | Turning on the schedule stops the running timer. | အချိန်ဇယား ဖွင့်ပါက လက်ရှိ Timer ရပ်သွားပါမည်။ | Translated | AI, #76 |  |
| `bellConflictScheduleAction` | Button of that prompt | Stop timer and turn on | Stop timer and turn on | English by design | AI, #76 |  |
| `bellScheduleCancel` | Cancel button in prompts and the bell form | Cancel | Cancel | English by design | AI, #76 |  |

## 6. Timer: errors and notices

| Key | Where shown | English | Burmese (current) | Type | Written in | Review |
| --- | --- | --- | --- | --- | --- | --- |
| `bellErrMinutes` | Error under the custom minutes box | Enter whole minutes from 1 to 960. | 1 မှ 960 အတွင်း မိနစ်အပြည့်ကို ထည့်ပါ။ | Translated | AI, #74 |  |
| `bellErrAlarmNone` | Error when Set alarm is used without a time | Choose a time. | အချိန်ကို ရွေးပါ။ | Translated | AI, #74 |  |
| `bellErrAlarmFar` | Error when the alarm time is more than 16 hours away | Pick a time within the next 16 hours. | နောက် 16 နာရီအတွင်း အချိန်ကို ရွေးပါ။ | Translated | AI, #74 |  |
| `bellNoticeMissed` | Notice after returning to the page when a bell time passed while it was closed | Your {time} bell was missed while this page was closed. | ဤစာမျက်နှာ ပိတ်ထားစဉ် {time} ခေါင်းလောင်း မမြည်လိုက်ပါ။ | Translated | AI, #74 |  |
| `bellNoticeBroken` | Notice when saved settings could not be read | Your saved bell settings could not be read. They were kept aside and the bell started fresh. | သိမ်းထားသော ခေါင်းလောင်း သတ်မှတ်ချက်များကို ဖတ်၍မရပါ။ ဘေးချထားပြီး အသစ်ပြန်စပါမည်။ | Translated | AI, #74 |  |
| `bellNoticeBlocked` | Notice when the browser blocks storage | This browser is blocking storage, so your bell settings will not be saved. | ဤဘရောက်ဆာက သိမ်းဆည်းခွင့်ကို ပိတ်ထားသဖြင့် သတ်မှတ်ချက်များ မသိမ်းနိုင်ပါ။ | Translated | AI, #74 |  |

## 7. Schedule: weekly list and next bell

| Key | Where shown | English | Burmese (current) | Type | Written in | Review |
| --- | --- | --- | --- | --- | --- | --- |
| `bellWeeklySchedule` | Heading and on/off switch of the weekly schedule | Weekly schedule | Weekly schedule | English by design | AI, #76 |  |
| `bellScheduleOn` | Label of the schedule on/off switch | On | On | English by design | AI, #76 |  |
| `bellScheduleEnabled` | Status line when the schedule is on | Weekly schedule is on. | အပတ်စဉ် အချိန်ဇယား ဖွင့်ထားပါသည်။ | Translated | AI, #76 |  |
| `bellScheduleDisabled` | Status line when the schedule is off | Weekly schedule is off. Your bells are saved. | အပတ်စဉ် အချိန်ဇယား ပိတ်ထားပါသည်။ ခေါင်းလောင်းများကို သိမ်းထားပါသည်။ | Translated | AI, #76 |  |
| `bellScheduleOffNote` | Note on the Next bell card when the schedule is off | Schedule is off. Bells will not ring. | Schedule is off. Bells will not ring. | English by design | AI, #76 |  |
| `bellNextBell` | Heading of the Next bell card | Next bell | Next bell | English by design | AI, #76 |  |
| `bellNextToday` | Next bell card, day word | Today | Today | English by design | AI, #76 |  |
| `bellNextTomorrow` | Next bell card, day word | Tomorrow | Tomorrow | English by design | AI, #76 |  |
| `bellNextIn` | Next bell card, for example "in 2 h 5 min" | in {time} | in {time} | English by design | AI, #76 |  |
| `bellNextNone` | Next bell card when there are no bells | No bells yet. Add one. | No bells yet. Add one. | English by design | AI, #76 |  |
| `bellNextTag` | Small "Next" tag on the next bell row | Next | Next | English by design | AI, #76 |  |
| `bellScheduleEmpty` | Empty day list | No bells on {day}. | {day} နေ့အတွက် ခေါင်းလောင်း မရှိပါ။ | Translated | AI, #76 |  |
| `bellScheduleMissed` | Notice when a scheduled bell was missed (uses the full day name) | Your {day} {time} bell was missed. | {day} နေ့ {time} ခေါင်းလောင်း မမြည်လိုက်ပါ။ | Translated | AI, #76 |  |
| `bellScheduleBackup` | Help line near Import / Export | Export a CSV to back up or share this schedule. | အချိန်ဇယားကို မိတ္တူသိမ်းရန် သို့မဟုတ် မျှဝေရန် CSV ဖိုင် ထုတ်ယူပါ။ | Translated | AI, #76 |  |
| `bellScheduleAdd` | Add bell button / form heading | Add bell | Add bell | English by design | AI, #76 |  |
| `bellScheduleAddShort` | Short Add button on narrow screens | Add | Add | English by design | AI, #76 |  |
| `bellScheduleEdit` | Form heading when editing a bell | Edit bell | Edit bell | English by design | AI, #76 |  |

## 8. Schedule: add or edit a bell

| Key | Where shown | English | Burmese (current) | Type | Written in | Review |
| --- | --- | --- | --- | --- | --- | --- |
| `bellScheduleBack` | Back button from the form (also from the CSV import) | Back to weekly schedule | Back to weekly schedule | English by design | AI, #76 |  |
| `bellScheduleTime` | Form label | Time | Time | English by design | AI, #76 |  |
| `bellScheduleLabel` | Form label | Label (optional) | Label (optional) | English by design | AI, #76 |  |
| `bellScheduleDays` | Form label | Days | Days | English by design | AI, #76 |  |
| `bellScheduleEveryDay` | Day shortcut button | Every day | Every day | English by design | AI, #76 |  |
| `bellScheduleWeekdays` | Day shortcut button | Weekdays | Weekdays | English by design | AI, #76 |  |
| `bellScheduleSound` | Form label | Sound | Sound | English by design | AI, #76 |  |
| `bellScheduleTest` | Button to hear the sound | Test sound | Test sound | English by design | AI, #76 |  |
| `bellScheduleSave` | Save button | Save | Save | English by design | AI, #76 |  |
| `bellScheduleDelete` | Delete button | Delete | Delete | English by design | AI, #76 |  |
| `bellScheduleConfirmDelete` | Confirmation before deleting a bell | Delete this bell from all of its days? | ဤခေါင်းလောင်းကို သတ်မှတ်ထားသည့် ရက်အားလုံးမှ ဖျက်မည်လား။ | Translated | AI, #76 |  |
| `bellScheduleSaved` | Notice after saving | Bell saved. | ခေါင်းလောင်းကို သိမ်းပြီးပါပြီ။ | Translated | AI, #76 |  |
| `bellScheduleDeleted` | Notice after deleting | Bell deleted. | ခေါင်းလောင်းကို ဖျက်ပြီးပါပြီ။ | Translated | AI, #76 |  |
| `bellScheduleDuplicate` | Form error: same time already on that day (uses the full day name) | A bell at {time} is already set on {day}. | {day} နေ့ {time} တွင် ခေါင်းလောင်း သတ်မှတ်ထားပြီး ဖြစ်ပါသည်။ | Translated | AI, #76 |  |
| `bellScheduleNeedsDay` | Form error | Choose at least one day. | အနည်းဆုံး တစ်ရက် ရွေးပါ။ | Translated | AI, #76 |  |
| `bellScheduleLongLabel` | Form error (also in the CSV preview) | Use at most 40 characters for the label. | အမည်ကို စာလုံး 40 ထက် မပိုစေပါနှင့်။ | Translated | AI, #76 |  |
| `bellScheduleInvalidRings` | Form error (also in the CSV preview) | Rings must be 1 to 6. | ခေါင်းလောင်းအကြိမ်ရေ 1 မှ 6 အထိ ဖြစ်ရပါမည်။ | Translated | AI, #76 |  |
| `bellScheduleDayLimit` | Form error | A day can have up to 100 bells. | တစ်ရက်တွင် ခေါင်းလောင်း 100 အထိ သတ်မှတ်နိုင်ပါသည်။ | Translated | AI, #76 |  |

## 9. Schedule: keep the screen on

| Key | Where shown | English | Burmese (current) | Type | Written in | Review |
| --- | --- | --- | --- | --- | --- | --- |
| `bellScheduleWake` | Label of the keep-screen-on switch | Keep screen on so bells can ring | Keep screen on so bells can ring | English by design | AI, #76 |  |
| `bellWakeWarning` | Disclaimer shown before turning it on (battery use) | The screen will not dim or lock while this page is open, which uses more battery. This is needed for bells to ring on schedule. | ဤစာမျက်နှာကို ဖွင့်ထားစဉ် ဖန်သားပြင် မမှိန်ဘဲ မလော့ခ်ကျဘဲ ရှိနေမည်ဖြစ်ပြီး ဘက်ထရီ ပိုမိုကုန်ခမ်းစေပါသည်။ သို့သော် ခေါင်းလောင်းများ အချိန်ဇယားအတိုင်း မြည်နိုင်ရန်အတွက် ၎င်းလိုအပ်ပါသည်။ | Translated | AI, #76 |  |
| `bellWakeNeedsSchedule` | Note when it is used while the schedule is off | Turn the schedule on to use this. | ဤအချက်ကို အသုံးပြုရန် အချိန်ဇယားကို ဖွင့်ပါ။ | Translated | AI, #76 |  |
| `bellWakeConfirm` | Button that confirms keeping the screen on | Keep screen on | Keep screen on | English by design | AI, #76 |  |

## 10. CSV import and export

| Key | Where shown | English | Burmese (current) | Type | Written in | Review |
| --- | --- | --- | --- | --- | --- | --- |
| `bellCsvImport` | Import button | Import | Import | English by design | AI, #76 |  |
| `bellCsvExport` | Export button | Export | Export | English by design | AI, #76 |  |
| `bellCsvImportHeading` | Heading of the import screen | Import schedule | Import schedule | English by design | AI, #76 |  |
| `bellCsvChoose` | File chooser button | Choose CSV file | Choose CSV file | English by design | AI, #76 |  |
| `bellCsvPreview` | Heading of the preview | Import preview | Import preview | English by design | AI, #76 |  |
| `bellCsvAdd` | Import choice | Add to the current schedule | Add to the current schedule | English by design | AI, #76 |  |
| `bellCsvReplace` | Import choice | Replace the whole schedule | Replace the whole schedule | English by design | AI, #76 |  |
| `bellCsvConfirmReplace` | Confirmation before replacing the whole schedule | This replaces your whole weekly schedule. Export it first if you may want it back. | အပတ်စဉ် အချိန်ဇယားတစ်ခုလုံးကို အစားထိုးပါမည်။ ပြန်သုံးလိုပါက အရင် ထုတ်ယူပါ။ | Translated | AI, #76 |  |
| `bellCsvExported` | Notice after export | Schedule exported. | အချိန်ဇယားကို ထုတ်ယူပြီးပါပြီ။ | Translated | AI, #76 |  |
| `bellCsvExportFailed` | Notice when export fails | The schedule could not be exported. | အချိန်ဇယားကို ထုတ်ယူ၍ မရပါ။ | Translated | AI, #76 |  |
| `bellCsvReading` | Shown while the file is read | Reading the CSV file… | CSV ဖိုင်ကို ဖတ်နေပါသည်… | Translated | AI, #76 |  |
| `bellCsvImported` | Notice after import | Imported {added}. Skipped {skipped}. | {added} ခု ထည့်သွင်းပြီး {skipped} ခု ကျော်သွားပါသည်။ | Translated | AI, #76 |  |
| `bellCsvFallback` | Preview line about bells with no sound in the file | {count} will use your alarm bell sound. | {count} ခုတွင် Alarm bell အသံကို သုံးပါမည်။ | Translated | AI, #76 |  |
| `bellCsvSkipped` | Preview heading of skipped rows | Skipped rows ({count}) | ကျော်သွားသော အတန်းများ ({count}) | Translated | AI, #76 |  |
| `bellCsvRow` | Preview line for one skipped row | Row {row}: {reason} | အတန်း {row}။ {reason} | Translated | AI, #76 |  |
| `bellCsvUnknownDay` | Skipped-row reason | Unknown day. Use Mon through Sun. | ရက်အမည် မမှန်ပါ။ Mon မှ Sun အထိ သုံးပါ။ | Translated | AI, #76 |  |
| `bellCsvInvalidTime` | Skipped-row reason | Invalid time. Use HH:MM in 24-hour format. | အချိန် မမှန်ပါ။ 24 နာရီပုံစံ HH:MM ကို သုံးပါ။ | Translated | AI, #76 |  |
| `bellCsvDuplicate` | Skipped-row reason | A bell is already listed for this day and time. | ဤရက်နှင့် အချိန်အတွက် ခေါင်းလောင်း ပါရှိပြီး ဖြစ်ပါသည်။ | Translated | AI, #76 |  |
| `bellCsvTooBig` | File error | Choose a CSV file no larger than 128 KiB. | 128 KiB ထက် မကြီးသော CSV ဖိုင်ကို ရွေးပါ။ | Translated | AI, #76 |  |
| `bellCsvTooMany` | File error | A schedule can have up to 100 bells per day and 700 per week. | တစ်ရက်တွင် ခေါင်းလောင်း 100 နှင့် တစ်ပတ်တွင် 700 အထိ သတ်မှတ်နိုင်ပါသည်။ | Translated | AI, #76 |  |
| `bellCsvHeader` | File error | The CSV needs a header row with day and time columns. | CSV ခေါင်းစီးတွင် day နှင့် time ကော်လံများ ပါရပါမည်။ | Translated | AI, #76 |  |
| `bellCsvMalformed` | File error | The CSV has an incorrectly quoted field. Fix the file and try again. | CSV ဖိုင်ထဲတွင် ကိုးကားအမှတ်အသား မှားနေပါသည်။ ဖိုင်ကို ပြင်ပြီး ထပ်စမ်းပါ။ | Translated | AI, #76 |  |
| `bellCsvEmpty` | File error | The CSV file is empty. | CSV ဖိုင်ထဲတွင် အချက်အလက် မရှိပါ။ | Translated | AI, #76 |  |
| `bellCsvNoBells` | File error | There are no valid bells to import. | ထည့်သွင်းနိုင်သော ခေါင်းလောင်း မရှိပါ။ | Translated | AI, #76 |  |
| `bellCsvReadFailed` | File error | The file could not be read. Choose it again. | ဖိုင်ကို ဖတ်၍ မရပါ။ ဖိုင်ကို ထပ်ရွေးပါ။ | Translated | AI, #76 |  |

## 11. Keys the code does not read

Present in `my.json` but not used by name in the bell code (the ring count buttons are built as "1x", "2x", "3x" in code). `bellTimeLeft` in section 2 is also unused. Nothing to review in the app, but the Burmese is the same as the English.

| Key | Where shown | English | Burmese (current) | Type | Written in | Review |
| --- | --- | --- | --- | --- | --- | --- |
| `bellRingsOnce` | Not shown | 1x | 1x | English by design | AI, #74 |  |
| `bellRingsTwice` | Not shown | 2x | 2x | English by design | AI, #74 |  |
| `bellRingsThrice` | Not shown | 3x | 3x | English by design | AI, #74 |  |

## 12. Mini Apps list page (bell card and page text)

Not bell-specific, and written in earlier pull requests. Included so every `miniApp*` key is covered. The bell card is `miniAppBellName` and `miniAppBellDescription`.

| Key | Where shown | English | Burmese (current) | Type | Written in | Review |
| --- | --- | --- | --- | --- | --- | --- |
| `miniAppsTitle` | Page title and header link | Mini Apps | အက်ပ်ငယ်များ | Translated | Earlier PR |  |
| `miniAppsPageTitle` | Title and heading of the Mini Apps listing page (the home page and menu keep `miniAppsTitle`) | Mini Apps | အက်ပ်ငယ်များ (Mini Apps) |
| `miniAppsIntro` | Introduction under the title | Small tools for practice and study. Free, no sign-in, and your data stays on this device. | ကျင့်စဉ်နှင့် လေ့လာမှုအတွက် ကိရိယာငယ်များ။ အခမဲ့ဖြစ်ပြီး အကောင့်ဝင်ရန် မလိုပါ။ သင့်အချက်အလက်များသည် ဤစက်ထဲတွင်သာ ရှိနေပါမည်။ | Translated | Earlier PR |  |
| `miniAppsList` | Screen-reader label of the list | Mini Apps | အက်ပ်ငယ်များ | Translated | Earlier PR |  |
| `miniAppBellName` | Name on the bell card | Meditation Bell | တရားထိုင်ခေါင်းလောင်း | Translated | Earlier PR |  |
| `miniAppBellDescription` | Text on the bell card | A timer, an alarm and a weekly schedule that ring a bell for your sittings. | ထိုင်ချိန်များအတွက် ခေါင်းလောင်းတီးပေးသော အချိန်ကိုက်နာရီ၊ နှိုးစက်နှင့် အပတ်စဉ် အချိန်ဇယား။ | Translated | Earlier PR |  |
| `miniAppConverterName` | Name on the Burmese text converter card | Burmese Text Converter | မြန်မာစာ ပြောင်းလဲကိရိယာ | Translated | Earlier PR |  |
| `miniAppConverterDescription` | Text on the converter card | Convert between Unicode, Zawgyi and Win Innwa. | ယူနီကုဒ်၊ ဇော်ဂျီနှင့် ဝင်းအင်းဝ စာလုံးများကြား ပြောင်းလဲပေးသည်။ | Translated | Earlier PR |  |
| `miniAppComing` | Label on a card that is not ready | Coming later | နောက်ပိုင်းတွင် ထည့်သွင်းမည် | Translated | Earlier PR |  |
## Questions about words and style

Please answer these in a few lines, or mark them in the tables.

1. **Bell.** The app uses ခေါင်းလောင်း for "bell" (the app name is တရားထိုင်ခေါင်းလောင်း). Is that the word you would use for the sound at a sitting? Is there a better word for the single strike and for the "bell" as a timetable entry?
2. **Timer, alarm and schedule.** The Burmese text writes Timer, Schedule and Alarm in English letters inside sentences, and uses အချိန်ဇယား (schedule), နှိုးစက် (alarm) and အချိန်ကိုက်နာရီ (timer) in some places. Should the same word be used everywhere? Which words do you prefer?
3. **Screen.** ဖန်သားပြင် is used for the phone or computer screen in the keep-screen-on text. Is it the usual word? Are မမှိန်ဘဲ and မလော့ခ်ကျဘဲ natural for "will not dim or lock"?
4. **English words inside Burmese sentences.** Words such as Start, Play, Stop, Pause, Resume, Reset, Import, Export, Timer and Schedule are written in English letters inside Burmese sentences (for example `Timer တွင် Start ကို နှိပ်သောအခါ`). Is this acceptable for your readers, or should the sentences use a Burmese word for the control? If a Burmese word is better, which one for each of these?
5. **Two sentences left in English.** `bellNextNone` ("No bells yet. Add one.") and `bellScheduleOffNote` ("Schedule is off. Bells will not ring.") are still in English although they are explanatory text. Should they be translated? Please suggest the Burmese.
6. **Numerals.** The app writes numbers with Western digits (0-9) in Burmese sentences, for example `စာလုံး 40 ထက်`, `1 မှ 960`, `နောက် 16 နာရီအတွင်း`, because the time controls and limits use them everywhere. Is this acceptable, or would Burmese digits read better in sentences? (Time controls stay in Western digits either way.)
7. **Tone.** The messages end in ပါသည်, ပါမည် and ပါ. Is this formal register right for a meditation tool, or would a softer spoken-style ending (ပါတယ်, ပါမယ်) suit the readers better?
8. **Sentences to check closely.** The longest and most important are `miniAppLeaveConfirm` (leaving stops the bells), `bellWakeWarning` (battery use), `bellConflictStart` and `bellConflictSchedule` (the timer and the schedule cannot run together), `bellCsvConfirmReplace` (replacing the whole schedule) and `bellNoticeBroken` (saved settings could not be read). A misunderstanding here costs the reader something.
9. **Words for file and data terms.** CSV, ကော်လံ (column), ခေါင်းစီး (header), အတန်း (row), ဘရောက်ဆာ (browser) and ထုတ်ယူ (export) appear in the CSV messages. Are these the words your readers know?

## After the review

Send the filled-in tables (or just the changed rows with their keys, for example `bellWakeWarning: change to ...`) back to Win Metta. The keys in the first column let a volunteer apply each change to `apps/web/src/i18n/messages/my.json` without searching.
