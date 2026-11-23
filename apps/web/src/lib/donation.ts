// Build-time view of the donation page data (docs/donations.md).
import donation from '../content/donation.json';
import type { MessageKey } from '../i18n/messages';
import { donationSchema, type Donation } from './schemas';
import { teacherById } from './teachers';

/**
 * The page is built always, but stays unlinked, noindex and out of the sitemap until its wording
 * (tax note, discretion over designated gifts, Burmese text, payee listings) is approved.
 */
export const donateEnabled = import.meta.env.PUBLIC_DONATE === 'true';

export const donationData: Donation = donationSchema.parse(donation);

for (const payee of donationData.otherPayees) {
  for (const teacher of payee.teachers) {
    if (!teacherById(teacher)) {
      throw new Error(`Donation payee ${payee.id}: unknown teacher ${teacher}`);
    }
  }
}

/** Zelle takes a phone number as digits only; an email address is copied as it is. */
export const zelleCopyValue = (address: string): string =>
  address.includes('@') ? address : address.replace(/\D/g, '');

/** What dāna pays for, in page order: a title and a body message key each. */
export const donationSupports = [
  {
    id: 'classes',
    title: 'donateSupportClassesTitle',
    body: 'donateSupportClasses',
  },
  {
    id: 'materials',
    title: 'donateSupportMaterialsTitle',
    body: 'donateSupportMaterials',
  },
  {
    id: 'website',
    title: 'donateSupportWebsiteTitle',
    body: 'donateSupportWebsite',
  },
  {
    id: 'volunteers',
    title: 'donateSupportVolunteersTitle',
    body: 'donateSupportVolunteers',
  },
  {
    id: 'monastics',
    title: 'donateSupportMonasticsTitle',
    body: 'donateSupportMonastics',
  },
] as const satisfies readonly {
  id: string;
  title: MessageKey;
  body: MessageKey;
}[];

/** Purposes a donor can write in the Zelle or check memo, in page order. */
export const donationPurposes = [
  'donatePurposeGeneral',
  'donatePurposeMonastic',
  'donatePurposeClasses',
  'donatePurposeBooks',
  'donatePurposeRetreats',
  'donatePurposeForeignTeachers',
] as const satisfies readonly MessageKey[];
