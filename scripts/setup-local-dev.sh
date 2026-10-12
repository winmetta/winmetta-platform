#!/usr/bin/env bash
# Sets up winmetta-platform for local development. Safe to re-run.
#
# Installs the Node version from mise.toml (through mise), the npm version pinned
# in package.json, locked dependencies and the Playwright browser. Shared tools
# (mise, git, gh, editor, AI CLIs, linters) come from the org bootstrap script first:
#   ../bootstrap-dev-env/bootstrap.sh
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

load_mise() {
	log_step "Loading mise"
	# A fresh bootstrap puts mise in ~/.local/bin before a new terminal activates it.
	if ! command -v mise >/dev/null 2>&1 && [[ -x "$HOME/.local/bin/mise" ]]; then
		PATH="$HOME/.local/bin:$PATH"
	fi
	command -v mise >/dev/null 2>&1 || die "mise not found. Run ../bootstrap-dev-env/bootstrap.sh first, then open a new terminal."
	log_ok "mise $(mise --version | awk '{print $1}')"
}

install_node() {
	log_step "Node (from mise.toml)"
	mise trust --quiet mise.toml
	mise install
	# Put the tools mise.toml pins on PATH for the rest of this script.
	eval "$(mise env -s bash)"
	local want have
	want="$(<.nvmrc)"
	have="$(node -p "process.versions.node.split('.')[0]")"
	[[ "$have" == "${want#v}" ]] || die "node $have from mise.toml does not match .nvmrc ($want); update one to match the other."
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

install_git_hooks() {
	log_step "Git hooks (lefthook)"
	if command -v lefthook >/dev/null 2>&1; then
		lefthook install
		log_ok "hooks installed (config in lefthook.yml)"
	else
		log_info "lefthook not found; run ../bootstrap-dev-env/bootstrap.sh, then: lefthook install"
	fi
}

print_summary() {
	printf '\n%sReady.%s\n' "$c_green" "$c_off"
	log_info "Run: npm run dev | lint | typecheck | test | build | test:smoke"
}

main() {
	load_mise
	install_node
	install_package_manager
	install_dependencies
	install_playwright_browser
	install_git_hooks
	print_summary
}

main "$@"
