/**
 * Build-time analytics settings (docs/analytics.md, implementation-plan.md §5A stage 3).
 *
 * The tracker is off by default. CI enables it in a separate browser-test build with a mocked
 * endpoint. The production deploy workflow enables it through the `production` environment
 * variables, in step with the Privacy page text. The Umami website id is visible in tracker requests.
 */
export const analyticsEnabled =
  import.meta.env.PUBLIC_ANALYTICS === 'true' &&
  Boolean(import.meta.env.PUBLIC_ANALYTICS_WEBSITE_ID);
export const analyticsHost = (
  import.meta.env.PUBLIC_ANALYTICS_HOST || 'https://stats.app.winmetta.org'
).replace(/\/$/, '');
export const analyticsWebsiteId: string =
  import.meta.env.PUBLIC_ANALYTICS_WEBSITE_ID || '';
