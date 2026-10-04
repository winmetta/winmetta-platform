/// <reference types="vitest/config" />
import { getViteConfig } from 'astro/config';
// getViteConfig compiles .astro files, so component tests can render them with the Astro container.
export default getViteConfig({ test: { include: ['src/**/*.test.ts'] } });
