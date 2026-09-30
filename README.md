# Win Metta Platform

A bilingual (English and Burmese) web platform for [Win Metta](https://winmetta.org/about/), a California 501(c)(3) nonprofit continuing an existing Burmese Theravāda Buddhist teaching community online. It helps online class students and independent learners worldwide find classes and Dhamma resources, and will grow into interactive Burmese literacy lessons.

The first phases deliver a foundation app (Phase 0), five bilingual pages — Home, About, Privacy, Classes and Dhamma Library (Phase 1) — plus a non-public review deployment (Phase 1), then public staging/production infrastructure (Phase 2). After that, the plan is to digitize **"Let's Learn Burmese" (LLB)**, an existing, proven Burmese-literacy course currently taught by Ven. U Garudhamma, into an interactive self-paced app, and to expand the Dhamma Library and class archive. Full reasoning and scope live in the docs below.

## Status

This public repo currently contains **planning documentation only** — decisions are recorded ahead of implementation, and future-phase notes are tentative. `apps/` hasn't been scaffolded yet (see [docs/implementation-plan.md](docs/implementation-plan.md) for the Phase 0–2 plan).

## Docs

| Doc | Covers |
| --- | --- |
| [docs/prd.md](docs/prd.md) | Product scope, target audience, feature specs, funding plan, success metrics, phased roadmap |
| [docs/tech-architecture.md](docs/tech-architecture.md) | Stack, hosting/domains, environments & CI/CD, infrastructure provisioning; deferred analytics and tentative future directions (backend, accounts, offline) |
| [docs/implementation-plan.md](docs/implementation-plan.md) | Phases 0–2: foundation code, five bilingual pages, infrastructure & deployment; checklists and macOS setup |
| [AGENTS.md](AGENTS.md) | Quick-reference conventions for contributors and AI coding agents working in this repo — **read this before making changes**, especially §2 on this repo being public |

Phase 1 will introduce Home, About, Privacy, Classes and Dhamma Library for online Zoom students and anonymous independent learners worldwide. Content will be concise and curated from the existing site, with an original mobile/desktop design. Classes and Dhamma Library are the two main page groups; the library includes curated resources across media types, including blog-post links, with basic search.

## Core Principles

- **Free and open access** — teaching content and the literacy curriculum are never paywalled or gated behind a required login.
- **Mobile and desktop** — responsive layouts for both, targeting modern browsers and lightweight pages for slow connections.
- **Calm by default** — no streaks, leaderboards, badges, ads, or engagement-optimized patterns.
- **Bilingual** — Burmese (Unicode only) and English, with users choosing their interface language and an extensible localization structure for future languages/locales.
- **Low cost, low maintenance** — this is a volunteer-run nonprofit; v1 is a static site with no server to run. We prefer free nonprofit programs but will pay for tools when worthwhile.
- **Popular, well-supported tools** — widely used stacks with strong communities, so volunteers can learn them easily.

## Tech Stack (planned)

Astro (with React islands) · TypeScript · Tailwind · Turborepo/npm workspaces · Azure Static Web Apps · AWS S3 + bunny.net CDN · Cloudflare DNS. A Fastify/PostgreSQL backend is a possible future addition. See [docs/tech-architecture.md](docs/tech-architecture.md) for versions and the reasoning behind each choice.

## Contributing

This project relies on volunteer contributors from the Win Metta congregation and diaspora. If you'd like to help, reach out at [contact@winmetta.org](mailto:contact@winmetta.org). If you're an AI coding agent, start with [AGENTS.md](AGENTS.md).

## License

Code is released under the [MIT License](LICENSE). Teaching content (recordings, texts, curriculum materials) remains the work of its teachers and Win Metta and is not covered by the MIT License unless stated otherwise.
