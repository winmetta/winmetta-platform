// The registry of mini apps (docs/meditation-bell.md §2). The listing page, the sitemap and a
// later desktop or mobile shell read this one file, so adding a mini app is one entry plus its
// page.
import type { MessageKey } from '../i18n/messages';

/**
 * The listing page and the bell are always built but stay unlinked, noindex and out of the
 * sitemap until this is on (docs/implementation-plan.md §5E).
 */
export const miniAppsEnabled = import.meta.env.PUBLIC_MINI_APPS === 'true';

export type MiniAppStatus = 'beta' | 'live' | 'coming';

export interface MiniApp {
  /** Stable id: analytics, storage keys and the icon file name. */
  id: string;
  /** The last URL segment: /<locale>/mini-apps/<slug>/. */
  slug: string;
  /** File name (without .svg) in src/assets/mini-apps/; MiniAppIcon.astro resolves it. */
  icon: string;
  name: MessageKey;
  description: MessageKey;
  status: MiniAppStatus;
}

export const miniApps: readonly MiniApp[] = [
  {
    id: 'meditation-bell',
    slug: 'meditation-bell',
    icon: 'meditation-bell',
    name: 'miniAppBellName',
    description: 'miniAppBellDescription',
    status: 'beta',
  },
  {
    id: 'burmese-text-converter',
    slug: 'burmese-text-converter',
    icon: 'burmese-text-converter',
    name: 'miniAppConverterName',
    description: 'miniAppConverterDescription',
    status: 'coming',
  },
];

export const miniAppBySlug = (slug: string): MiniApp | undefined =>
  miniApps.find((app) => app.slug === slug);

/** A `coming` app has a tile but no page and no link. */
export const hasPage = (app: MiniApp): boolean => app.status !== 'coming';
