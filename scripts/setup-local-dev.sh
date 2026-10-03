#!/usr/bin/env bash
# Sets up winmetta-platform for local development. Safe to re-run.
#
# Installs the Node version from .nvmrc, the npm version pinned in package.json,
# locked dependencies and the Playwright browser. Shared tools (nvm, git, gh,
# editor, AI CLIs, linters) come from the org bootstrap script first:
#   ../.github/bootstrap-dev-env.sh
#
# Usage: ./scripts/setup-local-dev.sh   (from anywhere; it runs from the repo root)
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

if [[ -t 1 ]]; then
	c_blue=$'\033[34m' c_green=$'\033[32m' c_red=$'\033[31m' c_off=$'\033[0m'
else
	c_blue="" c_green="" c_red="" c_off=""
fi
step=0
log_step() {
	step=$((step + 1))
	printf '\n%s==> [%d] %s%s\n' "$c_blue" "$step" "$*" "$c_off"
}
log_info() { printf '    %s\n' "$*"; }
log_ok() { printf '    %s✔ %s%s\n' "$c_green" "$*" "$c_off"; }
die() {
	printf '    %s✖ %s%s\n' "$c_red" "$*" "$c_off" >&2
	exit 1
}
trap 'printf "%s✖ setup failed at line %s (exit %s)%s\n" "$c_red" "$LINENO" "$?" "$c_off" >&2' ERR

load_nvm() {
	log_step "Loading nvm"
	export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
	[[ -s "$NVM_DIR/nvm.sh" ]] || die "nvm not found. Run ../.github/bootstrap-dev-env.sh first."
	# nvm is third-party shell code and may reference unset variables.
	set +u
	# shellcheck disable=SC1091
	source "$NVM_DIR/nvm.sh" --no-use
	set -u
	log_ok "nvm found at $NVM_DIR"
}

install_node() {
	log_step "Node $(<.nvmrc)"
	set +u
	nvm install
	nvm use
	set -u
	log_ok "node $(node -v)"
}

install_package_manager() {
	log_step "Pinned npm"
	local pm
	pm="$(node -p "require('./package.json').packageManager || ''")"
	if [[ -n "$pm" ]]; then
		log_info "installing $pm"
		npm install --global "$pm"
	fi
	log_ok "npm $(npm -v)"
}

install_dependencies() {
	log_step "Dependencies (npm ci)"
	npm ci
	log_ok "dependencies installed"
}

install_playwright_browser() {
	log_step "Playwright Chromium (browser smoke tests)"
	npx playwright install chromium
	log_ok "chromium installed"
}

print_summary() {
	printf '\n%sReady.%s\n' "$c_green" "$c_off"
	log_info "Run: npm run dev | lint | typecheck | test | build | test:smoke"
}

main() {
	load_nvm
	install_node
	install_package_manager
	install_dependencies
	install_playwright_browser
	print_summary
}

main "$@"
