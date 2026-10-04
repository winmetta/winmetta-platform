// Time zones offered by the weekly schedule. Pacific is the default (Win Metta's home zone).
export const scheduleZones = [
  { id: 'pacific', zone: 'America/Los_Angeles' },
  { id: 'mountain', zone: 'America/Denver' },
  { id: 'arizona', zone: 'America/Phoenix' },
  { id: 'central', zone: 'America/Chicago' },
  { id: 'eastern', zone: 'America/New_York' },
  { id: 'london', zone: 'Europe/London' },
  { id: 'europe', zone: 'Europe/Paris' },
  { id: 'india', zone: 'Asia/Kolkata' },
  { id: 'myanmar', zone: 'Asia/Yangon' },
  { id: 'singapore', zone: 'Asia/Singapore' },
  { id: 'japan', zone: 'Asia/Tokyo' },
  { id: 'sydney', zone: 'Australia/Sydney' },
] as const;
export type ZoneId = (typeof scheduleZones)[number]['id'];
export const defaultZone: ZoneId = 'pacific';

export const isZoneId = (value: string | null): value is ZoneId =>
  scheduleZones.some((entry) => entry.id === value);

export const ianaOf = (id: ZoneId): string =>
  scheduleZones.find((entry) => entry.id === id)?.zone ?? 'America/Los_Angeles';

/** `?tz=` in the URL, so a chosen zone survives sharing and the language switch. */
export function readZone(search: string): ZoneId {
  const value = new URLSearchParams(search).get('tz');
  return isZoneId(value) ? value : defaultZone;
}
export function writeZone(
  id: ZoneId,
  location: { pathname: string; search: string; hash: string },
): string {
  const params = new URLSearchParams(location.search);
  if (id === defaultZone) params.delete('tz');
  else params.set('tz', id);
  const query = params.toString();
  return `${location.pathname}${query ? `?${query}` : ''}${location.hash}`;
}
