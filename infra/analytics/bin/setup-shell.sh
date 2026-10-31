#!/usr/bin/env bash
# Sets up the working environment on the analytics server: troubleshooting and network tools,
# the psql client, vim (with ShellCheck and shfmt through the ALE plugin), screen, the a-
# aliases, and vi/sudo editor settings. Run as root by install.sh; safe to repeat.
# Nothing here is needed for the analytics service itself, so install.sh carries on if this
# fails. Not yet run on a real instance (stage 2 acceptance).
set -euo pipefail

VERSIONS=/opt/analytics/versions.env
SHELL_DIR=/opt/analytics/shell
CONF_DIR=/etc/analytics
ALE_DIR=/usr/share/vim/vimfiles/pack/analytics/start/ale

log() { printf '[analytics-setup-shell] %s\n' "$*"; }

die() {
    log "$*" >&2
    exit 1
}

require_root() {
    [[ $EUID -eq 0 ]] || die "run as root"
}

# All of these exist in the Amazon Linux 2023 repository (checked 2026-10-30). If one is ever
# dropped, install the rest one by one rather than failing the whole set.
install_packages() {
    local packages=(
        vim-enhanced screen git tar xz unzip jq bc tree rsync
        htop iotop sysstat psmisc lsof strace ethtool iftop nethogs
        net-tools bind-utils nmap-ncat traceroute tcpdump mtr telnet
        "$POSTGRES_CLIENT_PACKAGE"
    )
    if dnf install -y "${packages[@]}"; then
        return 0
    fi
    log "one package set failed; retrying one by one"
    local pkg
    for pkg in "${packages[@]}"; do
        dnf install -y "$pkg" || log "package not installed: $pkg"
    done
}

# Prints the value of a variable named like SHELLCHECK_SHA256_AARCH64 for this CPU.
arch_value() {
    local prefix=$1 suffix=$2
    local name="${prefix}_${suffix}"
    printf '%s' "${!name}"
}

download_verified() {
    local url=$1 sha=$2 dest=$3
    curl -fsSL --retry 3 --max-time 120 -o "$dest" "$url"
    printf '%s  %s\n' "$sha" "$dest" | sha256sum -c - >/dev/null || die "checksum mismatch for $url"
}

install_shellcheck() {
    local arch=$1 tmp
    tmp=$(mktemp -d)
    local suffix=${arch^^}
    download_verified \
        "https://github.com/koalaman/shellcheck/releases/download/v${SHELLCHECK_VERSION}/shellcheck-v${SHELLCHECK_VERSION}.linux.${arch}.tar.xz" \
        "$(arch_value SHELLCHECK_SHA256 "$suffix")" "$tmp/shellcheck.tar.xz"
    tar -xJf "$tmp/shellcheck.tar.xz" -C "$tmp"
    install -m 0755 "$tmp/shellcheck-v${SHELLCHECK_VERSION}/shellcheck" /usr/local/bin/shellcheck
    rm -rf "$tmp"
}

install_shfmt() {
    local arch=$1 tmp go_arch
    tmp=$(mktemp -d)
    case $arch in
    aarch64) go_arch=arm64 ;;
    x86_64) go_arch=amd64 ;;
    *) die "unsupported CPU: $arch" ;;
    esac
    download_verified \
        "https://github.com/mvdan/sh/releases/download/v${SHFMT_VERSION}/shfmt_v${SHFMT_VERSION}_linux_${go_arch}" \
        "$(arch_value SHFMT_SHA256 "${go_arch^^}")" "$tmp/shfmt"
    install -m 0755 "$tmp/shfmt" /usr/local/bin/shfmt
    rm -rf "$tmp"
}

# ALE runs ShellCheck while you edit and shfmt on request. It goes in vim's system-wide
# package directory, so every user gets it.
install_ale() {
    local tmp
    tmp=$(mktemp -d)
    download_verified "https://github.com/dense-analysis/ale/archive/refs/tags/v${ALE_VERSION}.tar.gz" \
        "$ALE_SHA256" "$tmp/ale.tar.gz"
    rm -rf "$ALE_DIR"
    mkdir -p "$ALE_DIR"
    tar -xzf "$tmp/ale.tar.gz" -C "$ALE_DIR" --strip-components=1
    vim -es -u NONE -c "helptags $ALE_DIR/doc" -c q || log "could not build the ALE help tags"
    rm -rf "$tmp"
}

# Append one line to a file, once.
add_line_once() {
    local file=$1 line=$2
    touch "$file"
    grep -qxF "$line" "$file" || printf '%s\n' "$line" >>"$file"
}

# vim and screen read /etc/vimrc and /etc/screenrc; ours are loaded from there.
install_configs() {
    install -d -m 0755 "$CONF_DIR"
    install -m 0644 "$SHELL_DIR/vimrc" "$CONF_DIR/vimrc"
    install -m 0644 "$SHELL_DIR/screenrc" "$CONF_DIR/screenrc"
    install -m 0644 "$SHELL_DIR/analytics.sh" /etc/profile.d/analytics.sh
    add_line_once /etc/vimrc 'source /etc/analytics/vimrc'
    add_line_once /etc/screenrc 'source /etc/analytics/screenrc'
}

# `vi` (and sudo's vi) should be the full vim, not the tiny vim-minimal that ships with
# Amazon Linux: a link in /usr/local/bin, which sudo is told to search too. sudo keeps the
# editor variables so `sudoedit` and `crontab -e` use it.
install_editor() {
    ln -sf /usr/bin/vim /usr/local/bin/vi
    local tmp
    tmp=$(mktemp)
    cat >"$tmp" <<'SUDOERS'
Defaults env_keep += "EDITOR VISUAL SUDO_EDITOR"
Defaults secure_path = "/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin"
SUDOERS
    if visudo -cf "$tmp" >/dev/null; then
        install -m 0440 "$tmp" /etc/sudoers.d/90-analytics-editor
    else
        log "sudoers snippet rejected; sudo editor settings not installed"
    fi
    rm -f "$tmp"
}

main() {
    require_root
    # shellcheck source=/dev/null
    source "$VERSIONS"
    local arch
    arch=$(uname -m)
    install_packages
    install_shellcheck "$arch"
    install_shfmt "$arch"
    install_ale
    install_configs
    install_editor
    log "done: open a new shell (or run bash) and type a-help"
}

if [[ ${BASH_SOURCE[0]} == "$0" ]]; then
    main "$@"
fi
