#!/usr/bin/env bash
set -euo pipefail

if [[ "$(uname -s)" != Darwin ]]; then
	echo "This bootstrap is for macOS. Use Node from .nvmrc and npm ci on other systems." >&2
	exit 1
fi
if [[ ! -f .nvmrc || ! -f package.json ]]; then
	echo "Run from the repository root." >&2
	exit 1
fi
if ! xcode-select -p >/dev/null 2>&1; then
	xcode-select --install
	echo "Complete the Command Line Tools installer, then rerun this script."
	exit 1
fi
# Existing Homebrew may not yet be in this shell's PATH.
if ! command -v brew >/dev/null 2>&1; then
	if [[ -x /opt/homebrew/bin/brew ]]; then
		eval "$(/opt/homebrew/bin/brew shellenv)"
	elif [[ -x /usr/local/bin/brew ]]; then
		eval "$(/usr/local/bin/brew shellenv)"
	else
		installer="$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
		/bin/bash -c "$installer"
		if [[ -x /opt/homebrew/bin/brew ]]; then
			eval "$(/opt/homebrew/bin/brew shellenv)"
		else
			eval "$(/usr/local/bin/brew shellenv)"
		fi
	fi
fi
for tool in shellcheck shfmt git curl; do
	if ! command -v "$tool" >/dev/null 2>&1; then
		brew install "$tool"
	fi
done
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [[ ! -s "$NVM_DIR/nvm.sh" ]]; then
	mkdir -p "$NVM_DIR"
	installer="$(curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh)"
	bash -c "$installer"
fi
if [[ ! -s "$NVM_DIR/nvm.sh" ]]; then
	echo "nvm installation did not produce nvm.sh." >&2
	exit 1
fi
# nvm is third-party shell code and may reference unset variables.
set +u
# shellcheck disable=SC1091
source "$NVM_DIR/nvm.sh" --no-use
nvm install
nvm use
set -u
npm install --global "$(node -p "require('./package.json').packageManager")"
npm ci
echo "Ready. Run npm run dev; npm run lint; npm run typecheck; npm test; npm run build."
