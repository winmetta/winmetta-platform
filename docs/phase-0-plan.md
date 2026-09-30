# Phase 0 Plan: Foundations & Local macOS Development Environment

Scope: per [prd.md](prd.md) (§4.7, §7) and [tech-architecture.md](tech-architecture.md) (§0), v1 is a **single static Astro web app designed for mobile and desktop**. Phase 0 scaffolds only `apps/web` plus the tooling around it — no backend, no database, no desktop/mobile apps. Those are future work and intentionally not part of this plan.

## 1. Objectives

* Use the public GitHub repo [`winmetta/winmetta-platform`](https://github.com/winmetta/winmetta-platform) (already created) as the single source of truth, under the MIT License.
* Build a reproducible native macOS development environment (no Docker, no database needed).
* Initialize the Turborepo/npm workspace with `apps/web` (Astro + React islands + Tailwind).
* Set up CI (lint, typecheck, build) and agent docs (`AGENTS.md`, `CLAUDE.md` symlink).
* Deploy an empty-but-real site to `app.winmetta.org` via Azure Static Web Apps, and create private Cloudflare R2 media storage with public delivery through Bunny CDN — see [tech-architecture.md](tech-architecture.md) §6.

### Baseline toolchain (as of September 2026 — verify before kickoff)

| Tool | Version | Notes |
| --- | --- | --- |
| Node.js | 24.x (Active LTS) | Node 22 is Maintenance LTS only (EOL April 2027). |
| npm | 11.x | Bundled with Node 24. |
| TypeScript | ^6.0 | TS 7 is beta — don't build on it yet. |
| Turborepo | ^2.11 | |
| Astro | ^7.3 | Static-first pages, React islands. |
| React | ^19.3 | Islands only, not the whole app shell. |
| Tailwind CSS | ^4.3 | |

PostgreSQL and Fastify are **not** part of Phase 0 (see [tech-architecture.md](tech-architecture.md) §10).

---

## 2. Monorepo Configuration

### Root `package.json`

```json
{
  "name": "winmetta-platform",
  "private": true,
  "packageManager": "npm@11.20.0",
  "license": "MIT",
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

Pin npm consistently in local setup and CI using the root `packageManager` declaration; `engines.npm` alone is not the Turborepo package-manager declaration. The example uses npm 11.20.0; re-verify at kickoff. Commit the generated lockfile and use `npm ci` for repeat installs.

### `.nvmrc`

```
24
```

### `turbo.json`

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

## 3. macOS Setup Script (`scripts/bootstrap-macos.sh`)

Installs Homebrew, shell tooling and Node (via nvm), then project dependencies. Run it from the repo root.

```bash
#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Win Metta Platform: macOS native development bootstrap
# Installs: Homebrew, shellcheck, shfmt, Node via nvm, npm dependencies.
# Run from the repository root.
# ==============================================================================

if [ ! -f .nvmrc ]; then
  echo "Run this script from the repository root (where .nvmrc lives)." >&2
  exit 1
fi

echo "==> [1/5] Checking for Xcode Command Line Tools..."
if ! xcode-select -p >/dev/null 2>&1; then
  echo "Installing Xcode Command Line Tools..."
  xcode-select --install
  echo "Complete the GUI prompt, then re-run this script."
  exit 1
fi

echo "==> [2/5] Checking for Homebrew..."
if ! command -v brew >/dev/null 2>&1; then
  echo "Installing Homebrew..."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  if [[ -x /opt/homebrew/bin/brew ]]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
  elif [[ -x /usr/local/bin/brew ]]; then
    eval "$(/usr/local/bin/brew shellenv)"
  fi
else
  echo "Homebrew already installed. Updating..."
  brew update
fi

echo "==> [3/5] Installing shell tooling (shellcheck, shfmt, git, curl)..."
brew install shellcheck shfmt git curl

echo "==> [4/5] Ensuring nvm and Node.js are installed..."
export NVM_DIR="$HOME/.nvm"
if [ ! -d "$NVM_DIR" ]; then
  echo "Installing nvm..."
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
fi
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

NODE_VERSION="$(cat .nvmrc)"
echo "Installing Node.js $NODE_VERSION via nvm..."
nvm install "$NODE_VERSION"
nvm use "$NODE_VERSION"

echo "==> [5/5] Installing npm dependencies..."
NPM_VERSION="$(node -p "require('./package.json').packageManager.split('@')[1]")"
npm install --global "npm@$NPM_VERSION"
if [ -f package-lock.json ]; then
  npm ci
else
  npm install
fi

echo "=========================================================="
echo " Win Metta development environment is ready."
echo " Run 'npm run dev' to start the local dev server."
echo "=========================================================="
```

Optional, personal choices (not part of the script): install an AI coding tool of your choice; `AGENTS.md` and the `CLAUDE.md` symlink are already committed in the repo.

---

## 4. Agent & Contributor Docs

[AGENTS.md](../AGENTS.md) is the single source of truth for conventions used by contributors and AI coding agents. It is not duplicated here — read that file rather than a copy in this plan. `CLAUDE.md` is a symlink to it (`ln -s AGENTS.md CLAUDE.md`).

---

## 5. Phase 0 Deliverable Checklist

Repository & governance
* [x] Public GitHub repo `winmetta/winmetta-platform` created.
* [x] Add `LICENSE` (MIT License).
* [ ] Add `.gitignore` covering `node_modules`, build output, `.env*`, `*.tfvars` (but not `*.tfvars.example`) **before** any such file exists.
* [ ] Enable GitHub secret scanning and push protection.
* [ ] Add a short `CONTRIBUTING.md` (how to propose content or code changes; contact@winmetta.org).

Tooling
* [ ] Commit `.nvmrc`, root `package.json`, `turbo.json`, base `tsconfig`, Prettier and ESLint config.
* [ ] Add `scripts/bootstrap-macos.sh` (`chmod +x`).

Web app
* [ ] Initialize `apps/web` with Astro (`npm create astro@latest`), add React, Tailwind and shadcn/ui.
* [ ] Responsive mobile and desktop layouts with touch and keyboard support, supported-browser checks, Unicode Burmese font loading (e.g. Noto Sans Myanmar), and both Burmese-first and English-first UI copy scaffolding.
* [ ] Content collections (Zod schemas) for curricula, library index and class schedule, seeded with **synthetic** placeholder data only.
* [ ] Class schedule schema stores source IANA timezone and local recurrence; display dated occurrences in Pacific and Myanmar time, including daylight-saving and day-rollover checks.

CI/CD & hosting
* [ ] `.github/workflows/ci.yml`: lint, typecheck, build on every PR.
* [ ] Provision Azure Static Web App and connect `app.winmetta.org` (CNAME); `deploy-web.yml` for production and PR previews; `noindex` on non-production.
* [ ] Create a private Cloudflare R2 bucket and Bunny CDN Pull Zone; validate S3 origin authentication with bucket-scoped read-only credentials.
* [ ] Configure the proposed `cdn.app.winmetta.org` hostname, DNS CNAME and TLS. Verify public CDN access, denied unsigned origin access, cache hits/misses, CORS, MIME types and media seeking (tech-architecture.md §6).
* [ ] Set up Terraform for the above (or record manual steps, then codify) — see [tech-architecture.md](tech-architecture.md) §8.

Out of scope for Phase 0 (future work): product analytics/metric collection, profile timezone preferences, backend API, database, accounts, offline/PWA, `apps/desktop`, `apps/mobile`.
