// The origin the built pages put in canonical and hreflang links. A deployed site is
// built with SITE_URL set to its own address, so with BASE_URL (the post-deploy check)
// the expected origin is that address; otherwise it is the build's SITE_URL or the
// astro.config.mjs default.
export const siteOrigin = (
  process.env.BASE_URL
    ? new URL(process.env.BASE_URL).origin
    : (process.env.SITE_URL ?? 'http://localhost:4321')
).replace(/\/$/, '');
