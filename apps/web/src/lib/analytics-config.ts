/**
 * Build-time analytics settings (docs/analytics.md, implementation-plan.md §5A stage 3).
 *
 * The tracker is OFF unless the build sets PUBLIC_ANALYTICS=true, so dev, tests, PR builds and
 * previews never load it. Stage 4 turns it on for production in the same PR as the Privacy page
 * change. The Umami website id is public by design (it is visible in every tracker request).
 */
export const analyticsEnabled =
  import.meta.env.PUBLIC_ANALYTICS === 'true' &&
  Boolean(import.meta.env.PUBLIC_ANALYTICS_WEBSITE_ID);
export const analyticsHost = (
  import.meta.env.PUBLIC_ANALYTICS_HOST || 'https://stats.app.winmetta.org'
).replace(/\/$/, '');
export const analyticsWebsiteId: string =
  import.meta.env.PUBLIC_ANALYTICS_WEBSITE_ID || '';
