# Win Metta Platform

An interactive Burmese & Pāḷi literacy platform for [Win Metta](https://winmetta.org/about/), a California 501(c)(3) nonprofit continuing an existing Burmese Theravāda Buddhist teaching community online — for both Myanmar-based and diaspora learners.

The flagship goal (v1) is to digitize **"Let's Learn Burmese" (LLB)**, an existing, proven Burmese-literacy course currently taught by Ven. U Garudhamma, into an interactive self-paced app — and to reorganize Win Metta's existing Dhamma Library and weekly Zoom class archive into a coherent, searchable structure. Full reasoning and scope live in the docs below.

## Status

This repo currently contains **planning documentation only** — architecture and product decisions are recorded ahead of implementation. `apps/` and `packages/` haven't been scaffolded yet (see [docs/phase-0-plan.md](docs/phase-0-plan.md) for the Phase 0 setup plan).

## Docs

| Doc | Covers |
| --- | --- |
| [docs/prd.md](docs/prd.md) | Product scope, target audience, feature specs, funding plan, success metrics, phased roadmap |
| [docs/tech-architecture.md](docs/tech-architecture.md) | Stack, hosting/domains, environments & CI/CD, infrastructure provisioning, auth, experimentation |
| [docs/phase-0-plan.md](docs/phase-0-plan.md) | Local macOS dev environment setup and the Phase 0 bootstrap script |
| [AGENTS.md](AGENTS.md) | Quick-reference conventions for contributors and AI coding agents working in this repo — **read this before making changes**, especially §2 on this repo being public |

## Core Principles

- **Free and open access** — teaching content and the literacy curriculum are never paywalled or gated behind a required login.
- **Calm by default** — no streaks, leaderboards, badges, ads, or engagement-optimized patterns.
- **Bilingual** — Burmese (Unicode only) and English, with users choosing their interface language rather than one being hardcoded.
- **Low cost, low maintenance** — this is a volunteer-run nonprofit; infrastructure choices favor simple and portable over complex.

## Tech Stack (planned)

Astro (with React islands) · Fastify · PostgreSQL · Cloudflare R2 · Turborepo/npm workspaces, hosted on Azure. See [docs/tech-architecture.md](docs/tech-architecture.md) for versions and the reasoning behind each choice.

## Contributing

This project relies on volunteer contributors from the Win Metta congregation and diaspora. If you'd like to help, reach out at [contact@winmetta.org](mailto:contact@winmetta.org). If you're an AI coding agent, start with [AGENTS.md](AGENTS.md).

## License

Not yet finalized — a `LICENSE` file will be added before the first code lands.
