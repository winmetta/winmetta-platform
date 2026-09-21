# Phase 0 Plan & Local macOS Development Environment

Scope note: per the updated [prd.md](prd.md) (§4.7, §7) and [tech-architecture.md](tech-architecture.md) (§0), v1 is a **single mobile-responsive web app + Fastify backend** — not a simultaneous desktop/mobile build. Phase 0 below scaffolds only `apps/server` and `apps/web`. Desktop (Electron) and mobile (Capacitor) scaffolding is deferred to Future Phase 4 and intentionally not part of this plan.

## 1. Phase 0 Objectives

* Establish the single source of truth: A private GitHub repository under `winmetta` (`winmetta/platform`).
* Build a reproducible, native macOS development environment that runs **without Docker**.
* Configure native Node.js (via `.nvmrc`, pinned to the current Active LTS), PostgreSQL 18 (via official macOS installer/Homebrew), and native developer tooling.
* Initialize the Turborepo workspace structure scoped to `apps/server` (Fastify) and `apps/web` (Astro, with React islands) only — the two things v1 actually needs.
* Configure CI/CD foundations and developer agent configurations (`AGENTS.md` and `CLAUDE.md`).
* Provision baseline Azure resources under the nonprofit grant subscription (Static Web App, Container App, Postgres Flexible Server) and a Cloudflare R2 bucket for media — see [tech-architecture.md](tech-architecture.md) §6 for the full hosting/deployment plan and why media is deliberately kept off Azure.

### Baseline Toolchain Versions (current as of this writing — verify before kickoff if time has passed)

| Tool | Version | Notes |
| --- | --- | --- |
| Node.js | **24.x** ("Krypton", Active LTS) | Node 22 is Maintenance LTS only (EOL April 2027) — don't start new work on it. |
| npm | **11.x** | Bundled with Node 24. |
| TypeScript | **^6.0** | Final JS-compiler-based release line; TS 7 (Go-native) is beta — don't build on it yet. |
| Turborepo | **^2.11** | |
| Fastify | **^5.12** | |
| Astro | **^7.3** | Web app framework — static-first pages, React islands for the interactive lesson engine. Uses Vite ^8 internally. |
| React | **^19.3** | Used for islands within Astro (lesson engine), not for the whole app shell. |
| Tailwind CSS | **^4.3** | |
| PostgreSQL | **18.x** | v19 is beta — not for production. |

---

## 2. Directory Initialization & Monorepo Configuration

### Root `package.json`

```json
{
  "name": "winmetta-platform",
  "private": true,
  "workspaces": [
    "apps/*",
    "packages/*"
  ],
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",
    "clean": "turbo run clean && rm -rf node_modules"
  },
  "devDependencies": {
    "turbo": "^2.11.0",
    "prettier": "^3.9.0",
    "typescript": "^6.0.0"
  },
  "engines": {
    "node": ">=24.0.0",
    "npm": ">=11.0.0"
  }
}

```

### `.nvmrc`

```
24

```

### Root `turbo.json`

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "typecheck": {
      "dependsOn": ["^typecheck"]
    },
    "lint": {}
  }
}

```

---

## 3. macOS Native Setup Script (`scripts/bootstrap-macos.sh`)

This script handles the installation of Homebrew, development utilities, PostgreSQL 18, Claude Code, and sets up project symlinks.

```bash
#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# WinMetta Platform macOS Native Development Bootstrap
# Installs: Homebrew, Shellcheck, shfmt, Node via NVM, PostgreSQL 18, Claude Code
# ==============================================================================

echo "==> [1/7] Checking for Xcode Command Line Tools..."
if ! xcode-select -p >/dev/null 2>&1; then
  echo "Installing Xcode Command Line Tools..."
  xcode-select --install
  echo "Please complete the GUI prompt and re-run this script."
  exit 1
fi

echo "==> [2/7] Checking for Homebrew..."
if ! command -v brew >/dev/null 2>&1; then
  echo "Installing Homebrew..."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  
  # Configure shell env for Homebrew on Apple Silicon or Intel
  if [[ -f "/opt/homebrew/bin/brew" ]]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
  elif [[ -f "/usr/local/bin/brew" ]]; then
    eval "$(/usr/local/bin/brew shellenv)"
  fi
else
  echo "Homebrew already installed. Updating..."
  brew update
fi

echo "==> [3/7] Installing Shell Tooling (shellcheck, shfmt, git)..."
brew install shellcheck shfmt git curl

echo "==> [4/7] Ensuring NVM and Node.js LTS are installed..."
export NVM_DIR="$HOME/.nvm"
if [ ! -d "$NVM_DIR" ]; then
  echo "Installing NVM..."
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
fi

# Load NVM
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

NODE_VERSION=$(cat .nvmrc 2>/dev/null || echo "24")
echo "Installing Node.js $NODE_VERSION via nvm..."
nvm install "$NODE_VERSION"
nvm use "$NODE_VERSION"

echo "==> [5/7] Installing and Configuring PostgreSQL 18..."
# In macOS environments, PostgreSQL 18 can be installed directly via homebrew or official distribution
if ! brew list postgresql@18 >/dev/null 2>&1; then
  echo "Installing postgresql@18..."
  brew install postgresql@18
fi

# Start PostgreSQL service locally
echo "Starting PostgreSQL background service..."
brew services start postgresql@18

# Ensure local development database exists
createdb winmetta_dev 2>/dev/null || true

echo "==> [6/7] Installing Claude Code CLI..."
npm install -g @anthropic-ai/claude-code

echo "==> [7/7] Configuring Agent symlinks..."
if [ -f "AGENTS.md" ]; then
  ln -sf AGENTS.md CLAUDE.md
  echo "Linked CLAUDE.md -> AGENTS.md"
fi

echo "==> Installing Node dependencies across monorepo..."
npm install

echo "=========================================================="
echo " WinMetta Development Environment setup complete! "
echo " Run 'npm run dev' to start the local development server. "
echo "=========================================================="

```

---

## 4. Agent Guidelines & Specification (`AGENTS.md`)

This file guides automated coding agents and engineers working in the codebase.

```markdown
# AGENTS.md: Developer & AI Agent Context for WinMetta

## 1. Project Mission & Identity
Win Metta is a 501(c)(3) nonprofit continuing an existing Burmese Theravada Buddhist teaching community online: digitizing a proven Burmese/Pali literacy curriculum, and organizing an existing Dhamma Library and weekly Zoom class archive, for both Myanmar-based and diaspora learners.
- Core visual principle: High legibility, tranquil aesthetic, zero vanity metrics (no streaks/leaderboards), zero algorithmic distraction.
- Technical principle: Native execution without Docker, offline-first reliability, strictly typed TypeScript, Unicode-only Burmese text (see tech-architecture.md §5 for the Zawgyi note).
- Scope principle: v1 is a single web app. Do not add apps/desktop or apps/mobile — those are Future Phase 4 (see prd.md §4.7, §7).
- Hosting principle: Azure (Static Web Apps, Container Apps, Postgres Flexible Server) for compute/hosting under the nonprofit grant; Cloudflare R2 for all media (audio/video/PDF), deliberately kept off Azure for cost and portability reasons — see tech-architecture.md §6. Avoid Azure-specific SDKs in application code so the stack stays portable.

## 2. Monorepo Architecture & Structure
- Package Manager: npm workspaces
- Monorepo Orchestration: Turborepo
- Layout (v1):
  - `apps/server`: Fastify + PostgreSQL backend service
  - `apps/web`: Astro web application (static-first pages for the Dhamma Library/class directory, React islands for the interactive lesson engine) — the only v1 client, mobile-responsive, not a separate native app
  - `packages/ui`: Shared Tailwind + shadcn/ui components, usable from both Astro pages and React islands
  - `packages/shared-types`: TypeBox / TypeScript schemas shared across client & server
  - `packages/audio-core`: Web Audio API playback for class recordings and reading-practice audio
- Deferred to Future Phase 4 (do not scaffold yet): `apps/desktop` (Electron), `apps/mobile` (Capacitor)

## 3. Strict Coding Conventions
- **TypeScript:** Strict mode enabled everywhere (`"strict": true`). Do not use `any`; use `unknown` with type guards.
- **Text encoding:** All Burmese text is Unicode (Myanmar block). No Zawgyi handling in v1.
- **Access:** Core content (lessons, library, class directory) must work with no login. Accounts are optional and only needed for cross-device progress sync (Future Phase 3).
- **Database & Services:** Local development runs natively on macOS without Docker. Connect to the local Postgres instance at `localhost:5432/winmetta_dev`.
- **Styling:** Follow Tailwind CSS utility patterns and standard Radix/shadcn design primitives. Keep components quiet, accessible, and responsive — and support both Burmese-first and English-first UI copy per the adaptive onboarding spec (prd.md §4.1).

## 4. Key CLI Commands
- `npm run dev`: Starts all workspace development services concurrently.
- `npm run build`: Builds all apps and shared libraries.
- `npm run typecheck`: Validates TypeScript across all projects.
- `npm run lint`: Runs linter across all packages.

```

---

## 5. Phase 0 Deliverable Checklist

* [ ] Create the private GitHub repository `winmetta/platform`.
* [ ] Commit `.nvmrc` (pinned to Node 24), root `package.json`, and `turbo.json`.
* [ ] Add `scripts/bootstrap-macos.sh` (executable permissions: `chmod +x scripts/bootstrap-macos.sh`).
* [ ] Add `AGENTS.md` and generate the symlink `ln -s AGENTS.md CLAUDE.md`.
* [ ] Initialize `apps/server` with Fastify, TypeScript, and a healthcheck endpoint (`/healthz`).
* [ ] Initialize `apps/web` with Astro (`npm create astro@latest`, React integration added for islands), mobile-responsive baseline layout, and Unicode Burmese font loading.
* [ ] Setup `.github/workflows/ci.yml` verifying linting, type-checking, and build pass on all pull requests.
* [ ] Provision Azure Static Web App, Container App, and Postgres Flexible Server under the nonprofit grant subscription; provision a Cloudflare R2 bucket for media (see tech-architecture.md §6).

Not in scope for Phase 0 (Future Phase 4 — see prd.md §4.7): `apps/desktop` (electron-vite/electron-updater scaffolding), `apps/mobile` (Capacitor scaffolding), `release-desktop.yml` CI workflow.
