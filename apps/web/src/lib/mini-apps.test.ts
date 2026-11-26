import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { messages } from '../i18n/messages';
import { miniAppBySlug, miniApps, hasPage } from './mini-apps';

describe('mini apps registry', () => {
  it('gives every entry both message keys in both locales and an icon file', () => {
    for (const app of miniApps) {
      for (const locale of ['en', 'my'] as const) {
        expect(
          messages[locale][app.name],
          `${app.id} name ${locale}`,
        ).toBeTruthy();
        expect(
          messages[locale][app.description],
          `${app.id} description ${locale}`,
        ).toBeTruthy();
      }
      expect(
        existsSync(
          new URL(`../assets/mini-apps/${app.icon}.svg`, import.meta.url),
        ),
        `${app.id} icon`,
      ).toBe(true);
    }
  });

  it('has unique ids and slugs, and url-safe slugs', () => {
    expect(new Set(miniApps.map((a) => a.id)).size).toBe(miniApps.length);
    expect(new Set(miniApps.map((a) => a.slug)).size).toBe(miniApps.length);
    for (const app of miniApps) expect(app.slug).toMatch(/^[a-z0-9-]+$/);
  });

  it('links only the apps that have a page', () => {
    expect(miniAppBySlug('meditation-bell')).toBeDefined();
    expect(miniAppBySlug('nope')).toBeUndefined();
    expect(
      miniApps.filter((a) => !hasPage(a)).every((a) => a.status === 'coming'),
    ).toBe(true);
  });
});
