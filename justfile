# Task runner for winmetta-platform (https://just.systems; installed by the org bootstrap).
# Run `just` with no arguments to list every recipe. Recipes wrap the npm scripts and
# scripts/ helpers described in README.md, CONTRIBUTING.md and AGENTS.md; they run from the
# repo root whatever directory you call them from.
#
# Deliberately NOT here: anything that changes live systems (`pulumi up`, `pulumi refresh`,
# deploys, rollbacks). Those follow the private operations runbook and need explicit approval.

set quiet

# Show this help (the default when you type `just`).
[private]
default:
    echo "winmetta-platform: common tasks"
    echo
    echo "Usage: just <recipe> [args]      Example: just new-post \"Title of the post\""
    echo "       just --show <recipe>      Show what a recipe runs"
    echo
    just --list --unsorted --list-heading '' --list-prefix '  '

# ---------------------------------------------------------------- Setup

# Install Node (via mise), pinned npm, locked dependencies and the Playwright browser. Safe to re-run.
[group('setup')]
setup:
    ./scripts/setup-local-dev.sh

# Install locked dependencies only (npm ci).
[group('setup')]
install:
    npm ci

# ---------------------------------------------------------------- Develop

# Start the web dev server at http://localhost:4321 (add --force to replace a running one).
[group('develop')]
dev *args:
    npm run dev -- {{ args }}

# Stop the running dev server.
[group('develop')]
dev-stop:
    npm run dev:stop

# Build every workspace (Astro site included).
[group('develop')]
build:
    npm run build

# Serve the production build locally (run `just build` first).
[group('develop')]
preview:
    npm run preview --workspace @winmetta/web

# ---------------------------------------------------------------- Quality

# Run lint, typecheck, unit tests and build: the core of what CI runs on every pull request (CI also validates posts and runs the feedback, Pulumi and Playwright checks).
[group('quality')]
check: lint typecheck test build

# ESLint and Prettier check.
[group('quality')]
lint:
    npm run lint

# Format the whole repo with Prettier.
[group('quality')]
format:
    npm run format

# Type-check every workspace (astro check, tsc).
[group('quality')]
typecheck:
    npm run typecheck

# Unit tests (Vitest) across workspaces.
[group('quality')]
test:
    npm test

# Playwright smoke tests (needs the browser from `just setup`, or `npx playwright install chromium`).
[group('quality')]
smoke:
    npm run test:smoke

# Lint shell scripts with shellcheck and shfmt (the same tools the pre-commit hook uses).
[group('quality')]
lint-sh:
    git ls-files -z '*.sh' | xargs -0 shellcheck -s bash -x
    git ls-files -z '*.sh' | xargs -0 shfmt -d

# Scan the working tree for secrets with gitleaks.
[group('quality')]
secrets:
    gitleaks dir --redact

# ---------------------------------------------------------------- Content

# Start a Dhamma post from its English title: just new-post "Meaning of Vidhi and Anuvāda"
[group('content')]
new-post +title:
    npm run posts:new -- {{ quote(title) }}

# Validate Dhamma post files and the tag registry (optionally only the given files).
[group('content')]
validate-posts *files:
    npm run posts:validate -- {{ files }}

# Regenerate the Dhamma Library manifest from S3 (read-only; needs AWS_PROFILE signed in, see the private runbook).
[group('content')]
library-manifest:
    npm run library:manifest

# ---------------------------------------------------------------- Infrastructure (checks only)

# Test the whole feedback feature locally, no AWS: Lambda checks, then the browser tests with the flags on and off.
[group('feedback')]
feedback: feedback-lambda feedback-e2e

# Type-check, test and bundle the feedback Lambda (infra/feedback; synthetic requests, no credentials or email).
[group('feedback')]
feedback-lambda: feedback-typecheck feedback-test feedback-build

# Browser tests (Playwright) for the dialog, links and Sādhu: build with the flags on, then off. The AWS call is mocked. Always ends by rebuilding apps/web/dist with the flags off, even when a test fails.
[group('feedback')]
[script('bash')]
feedback-e2e:
    set -euo pipefail
    trap 'PUBLIC_FEEDBACK=false PUBLIC_FEEDBACK_POSTS_REVIEWED=false npm run build --workspace @winmetta/web' EXIT
    for flag in true false; do
        export PUBLIC_FEEDBACK="$flag" PUBLIC_FEEDBACK_POSTS_REVIEWED="$flag"
        npm run build --workspace @winmetta/web
        npm run test:smoke --workspace @winmetta/web -- feedback.spec.ts
    done

# Dev server with the feedback dialog and Sādhu on, plus a local endpoint stub (the real handler; prints each report here instead of sending email).
[group('feedback')]
[script('bash')]
feedback-dev *args:
    set -euo pipefail
    port="${FEEDBACK_STUB_PORT:-4322}"
    node scripts/feedback-stub.mjs &
    stub=$!
    trap 'kill "$stub" 2>/dev/null || true' EXIT
    PUBLIC_FEEDBACK=true PUBLIC_FEEDBACK_POSTS_REVIEWED=true \
        FEEDBACK_STUB_URL="http://127.0.0.1:$port" npm run dev -- {{ args }}

# Install the feedback Lambda's own dependencies when missing (setup only installs the root ones).
[private]
feedback-deps:
    [ -d infra/feedback/node_modules ] || npm ci --prefix infra/feedback

# Build the feedback Lambda bundle.
[group('feedback')]
feedback-build: feedback-deps
    npm run feedback:build

# Run the feedback Lambda tests.
[group('feedback')]
feedback-test: feedback-deps
    npm run feedback:test

# Type-check the feedback Lambda.
[group('feedback')]
feedback-typecheck: feedback-deps
    npm run feedback:typecheck

# Type-check and test the Pulumi program and its Lambda functions (no AWS access, changes nothing). Builds the feedback bundle first: its tests need it.
[group('infra')]
pulumi-check: feedback-build
    [ -d infra/pulumi/node_modules ] || npm ci --prefix infra/pulumi
    npm --prefix infra/pulumi run typecheck
    npm --prefix infra/pulumi test

# ---------------------------------------------------------------- Housekeeping

# Remove build output and caches (dist, .astro, .turbo); keeps node_modules.
[confirm('Delete build output and caches?')]
[group('housekeeping')]
clean:
    rm -rf .turbo apps/web/dist apps/web/.astro infra/feedback/dist
