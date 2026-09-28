# AGENTS.md: Developer & AI Agent Context for Win Metta

Full detail and reasoning for everything below lives in [docs/prd.md](docs/prd.md) and [docs/tech-architecture.md](docs/tech-architecture.md). This file is the quick-reference summary — when it and a doc disagree, the doc is authoritative and this file is stale and should be updated.

## 1. Project Mission & Identity

Win Metta is a California 501(c)(3) nonprofit continuing an existing Burmese Theravāda Buddhist teaching community online. The flagship v1 product digitizes a proven, already-taught Burmese-literacy curriculum into an interactive self-paced app, and reorganizes an existing Dhamma Library and weekly Zoom class archive — serving both Myanmar-based and diaspora learners of any age (docs/prd.md §1–§2).

- Core visual principle: high legibility, tranquil aesthetic, zero vanity metrics (no streaks/leaderboards/badges), zero algorithmic distraction.
- Core technical principle: native execution without Docker locally, offline-first reliability, strictly typed TypeScript, Unicode-only Burmese text.
- Core scope principle: v1 is a single web app. Do not scaffold `apps/desktop` or `apps/mobile` — those are Future Phase 4 (prd.md §4.7, §7).

## 2. This Repo Is Public — Secrets & Privacy Discipline

This repo is **public** (org default per the workspace-root AGENTS.md §3, since it's product code, not an internal-ops/credentials repo). That makes the following non-optional, and it applies equally to AI agents and human contributors:

- **Never commit secrets.** Database connection strings, R2/S3 access keys, the Better Auth secret, OAuth client secrets (Google/Facebook/Apple), Azure Service Principal credentials — these come from environment variables or GitHub Actions/Azure secrets only, never hardcoded or checked in "temporarily to test."
- **`.gitignore` must cover env files** (`.env`, `.env.local`, etc.) *before* such a file is ever created, not added after the fact.
- **Terraform:** only commit `.tfvars.example` files with placeholder values. Real `.tfvars`, or anything containing actual subscription/tenant IDs or connection strings, must stay untracked. State itself lives in Terraform Cloud, never in git (tech-architecture.md §8).
- **No real personal data, ever — including in fixtures or seed data.** No real student/teacher names tied to emails, phone numbers, enrollment/roster exports (e.g. from the "Let's Learn Burmese" signup form), or real Zoom credentials. Use synthetic placeholder data for anything checked into the repo. This matters more than usual here given the Myanmar-based-user surveillance risk already documented in prd.md §4.6 — a real name or email address in public commit history is effectively permanent, even if later deleted from the working tree.
- **Check the actual diff before staging or committing anything** — don't rely on `.gitignore` alone (a file can still be force-added), and git history is very hard to truly scrub after a push. If something sensitive looks like it's about to be committed, stop and ask rather than proceeding.
- **Enable GitHub secret scanning + push protection** on this repo (free for public repos) as a backstop — not a substitute for the discipline above.

## 3. Curriculum Naming — read before touching lesson content

Never use the bare word "lesson" or group content by subject (e.g. a generic "Pāḷi" bucket). Organize by the **actual class name Win Metta already uses** — every curriculum gets a short `curriculum` code, and `teacher` is always a separate field (a curriculum is never modeled as belonging to its current teacher personally, since teachers can be joined or succeeded). Known curricula (tech-architecture.md §3):

| `curriculum` code | Class name (as taught today) | Current teacher |
| --- | --- | --- |
| `llb` | Let's Learn Burmese (flagship v1 curriculum) | Ven. U Garudhamma |
| `pgtp` | Pāḷi Saddā & Tipiṭaka Pāḷi (ပါဠိသဒ္ဒါ နှင့် တိပိဋကပါဠိ သင်တန်း) | Ven. U Garudhamma |
| *(unassigned)* | Sutta Piṭaka Study (မူရင်းသုတ္တန်ပိဋကတ်ပါဠိတော်ကို လေ့လာခြင်း သင်တန်း) | Ven. Kelāsa |

`llb` and `pgtp` share a teacher today but are still separate curricula. Add any new class to this table with its own code *before* digitizing its content — never reuse an existing code loosely.

## 4. Monorepo Architecture & Structure (v1)

- Package manager: npm workspaces. Orchestration: Turborepo.
- `apps/server`: Fastify + PostgreSQL backend API (no login required for public routes; see §7).
- `apps/web`: Astro web app — static-first pages (Dhamma Library, class directory) + React islands for the interactive lesson engine. The only v1 client, mobile-responsive.
- `packages/ui`: shared Tailwind + shadcn/ui components, usable from both Astro pages and React islands.
- `packages/shared-types`: shared TypeBox/TypeScript schemas (`lesson.ts`, `dhamma.ts`, `user.ts`).
- `packages/audio-core`: Web Audio API playback for class recordings and reading-practice audio (`audio-player.ts` — this product has no "playlists" feature, don't reintroduce that naming).
- Deferred to Future Phase 4, do not scaffold yet: `apps/desktop` (Electron), `apps/mobile` (Capacitor).

## 5. Tech Stack & Versions

Baseline as of September 2026 — re-verify current versions before using if significant time has passed (tech-architecture.md §2).

| Layer | Choice |
| --- | --- |
| Runtime / package manager | Node.js 24.x (Active LTS) / npm 11.x |
| Language | TypeScript ^6.0 (strict mode everywhere) |
| Monorepo | Turborepo ^2.11 |
| Backend | Fastify ^5.12 |
| Database | PostgreSQL 18.x |
| Web app | Astro ^7.3, React ^19.3 for islands, Tailwind ^4.3 |
| Media storage | Cloudflare R2 (not Azure Blob — see §7 below) |

## 6. Strict Coding Conventions

- **TypeScript:** strict mode, no `any` — use `unknown` with type guards.
- **Text encoding:** all Burmese text is Unicode (Myanmar block, U+1000–U+109F). No Zawgyi handling in v1 (tech-architecture.md §5).
- **Access:** core content (LLB lessons, Dhamma Library, class directory) must work with no login, ever. Accounts are optional and only needed for cross-device progress sync (Future Phase 3).
- **No vanity metrics:** no streaks, leaderboards, badges, or engagement-optimized UI patterns anywhere.
- **Adaptive UI:** support both Burmese-first and English-first UI copy, and a simplified/standard density mode, per the onboarding profile (prd.md §4.1) — don't hardcode one language or one information density.
- **Styling:** Tailwind utility patterns + Radix/shadcn primitives, shared via `packages/ui`.
- **Database:** local dev connects natively to Postgres at `localhost:5432/winmetta_dev`, no Docker.

## 7. Hosting, Domains & Environments

- `winmetta.org` (WordPress) is untouched by this repo. This platform lives at `app.winmetta.org` (Astro frontend, Azure Static Web Apps) and `api.winmetta.org` (Fastify, Azure Container Apps). Staging mirrors this at `staging.app.winmetta.org` / `staging.api.winmetta.org`, `noindex`'d and access-restricted (tech-architecture.md §6–§7).
- Media (audio/video/PDF) is deliberately on **Cloudflare R2, not Azure Blob Storage** — zero egress cost and S3-compatible portability, and it's outside the scope of Win Metta's Azure for Nonprofits grant anyway (which only covers first-party Azure services and doesn't roll over annually).
- Portability principle: avoid Azure-specific SDKs in application code — plain Docker container for the API, vanilla Postgres, secrets from env vars, S3-compatible storage client. The stack should be movable to AWS/VPS without a rewrite if the grant situation changes.
- Infrastructure provisioning: Terraform (`infra/modules/platform` + per-environment folders), not manual Portal clicks — same portability reasoning as above (tech-architecture.md §8).

## 8. Deferred / Future Plan — do not build these in v1

See prd.md §4.7 for full reasoning. Summary: monastic-facing content upload tooling, cross-device account sync (Future Phase 3 — see tech-architecture.md §10 for the planned Better Auth approach when it arrives), community submissions/moderation, native mobile apps, Zawgyi legacy encoding support, and A/B testing/experimentation tooling (planned approach: self-hosted GrowthBook, tech-architecture.md §9 — only for learning-outcome questions, never engagement optimization).

## 9. Key CLI Commands

- `npm run dev` — starts all workspace dev services concurrently.
- `npm run build` — builds all apps and shared packages.
- `npm run typecheck` — validates TypeScript across all projects.
- `npm run lint` — runs the linter across all packages.

## 10. Where to Find More Detail

| Question | Read |
| --- | --- |
| Product scope, personas, feature specs, funding, success metrics | [docs/prd.md](docs/prd.md) |
| Architecture, hosting, environments, provisioning, auth, experimentation | [docs/tech-architecture.md](docs/tech-architecture.md) |
| Local macOS dev environment setup, bootstrap script | [docs/phase-0-plan.md](docs/phase-0-plan.md) |
