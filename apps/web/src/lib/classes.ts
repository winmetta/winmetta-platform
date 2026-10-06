// Build-time view of the weekly classes and study groups.
import classes from '../content/classes.json';
import channels from '../content/channels.json';
import { localizedContent } from '../i18n/content';
import type { Locale } from '../i18n/locales';
import {
  channelsSchema,
  classSchema,
  type ClassRecord,
  type ClassSlot,
} from './schemas';
import { nextOccurrence } from './class-schedule';

export const allClasses: ClassRecord[] = classSchema.array().parse(classes);
export const channelLinks = channelsSchema.parse(channels);

export const classText = (record: ClassRecord, locale: Locale) =>
  localizedContent(record.translations, record.sourceLanguage, locale);

/** The soonest occurrence among a class's weekly slots. */
export function soonest(slots: ClassSlot[], now: Date) {
  return slots
    .map((slot) => nextOccurrence(slot, now))
    .sort((a, b) => a.start.getTime() - b.start.getTime())[0];
}

export const byKind = (kind: ClassRecord['kind']) =>
  allClasses.filter((record) => record.kind === kind);
