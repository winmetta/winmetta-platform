#!/usr/bin/env bash
# Cut bell sounds from one source recording with ffmpeg (docs/meditation-bell.md §8.2).
#
# Usage: make-bell-sounds.sh [FLAGS] <SOURCE> <CUT>...
set -euo pipefail

readonly SCRIPT_NAME="${0##*/}"
# One loudness target for every sound, so switching sounds never changes the volume (EBU R128).
readonly LOUDNESS_FILTER="loudnorm=I=-20:TP=-2:LRA=7"
readonly BITRATE="96k"
readonly SILENCE_FILTER="silenceremove=start_periods=1:start_threshold=-50dB"
# Size budgets from §8.2, in bytes: a short bell under 100 KB, a long one under 300 KB.
readonly SHORT_LIMIT=102400
readonly LONG_LIMIT=307200

# Help layout: see references/usage-help.md in the bash-scripting skill.
usage() {
    cat <<USAGE
Cut and normalize bell sounds from a source recording

Each CUT is ID:START:LENGTH:FADE in seconds, measured after leading silence is
trimmed. Every sound is cut, faded out, mixed to mono, loudness-normalized and
encoded as MP3 at about 96 kbps, then named <ID>.<hash>.mp3.

Usage: ${SCRIPT_NAME} [FLAGS] <SOURCE> <CUT>...

Arguments:
  <SOURCE>  The source recording (any file ffmpeg reads)
  <CUT>...  A sound to make, as ID:START:LENGTH:FADE

Flags:
  -o, --out-dir <DIR>  Write the sounds to DIR [default: apps/web/public/audio]
  -h, --help           Print help

Examples:
    \$ ${SCRIPT_NAME} apps/web/src/assets/audio-src/WinMetta_Meditation_Timer.mp3 \\
        winmetta-short:0:4:1.5 winmetta-long:0:12:3
USAGE
}

log() { printf '%s\n' "$*" >&2; }

die() {
    log "${SCRIPT_NAME}: error: $*"
    exit 1
}

# Report a usage error on stderr and exit 2, like clap-based CLIs.
usage_error() {
    log "${SCRIPT_NAME}: error: $*"
    log ""
    log "Usage: ${SCRIPT_NAME} [FLAGS] <SOURCE> <CUT>..."
    log ""
    log "For more information, try '--help'."
    exit 2
}

require_cmd() {
    command -v "$1" >/dev/null 2>&1 ||
        die "$1 is required. Install it with: mise use ffmpeg"
}

# Print the first 8 hex characters of a file's SHA-256, for a cache-busting file name.
content_hash() {
    shasum -a 256 "$1" | cut -c1-8
}

# True when the argument is a number like 4 or 1.5.
is_number() {
    [[ $1 =~ ^[0-9]+([.][0-9]+)?$ ]]
}

# Split ID:START:LENGTH:FADE into the four named variables of the caller.
parse_cut() {
    local spec="$1"
    IFS=: read -r CUT_ID CUT_START CUT_LENGTH CUT_FADE <<<"${spec}"
    [[ -n ${CUT_ID:-} && ${CUT_ID} =~ ^[a-z0-9-]+$ ]] ||
        usage_error "bad cut '${spec}': the id must be lowercase letters, digits and dashes"
    if ! is_number "${CUT_START:-}" || ! is_number "${CUT_LENGTH:-}" || ! is_number "${CUT_FADE:-}"; then
        usage_error "bad cut '${spec}': expected ID:START:LENGTH:FADE with numbers in seconds"
    fi
}

# Build the ffmpeg audio filter chain for one cut.
build_filter() {
    local start="$1" length="$2" fade="$3"
    local fade_start
    fade_start="$(awk -v l="${length}" -v f="${fade}" 'BEGIN { printf "%.3f", (l > f) ? l - f : 0 }')"
    printf '%s,atrim=start=%s:duration=%s,asetpts=PTS-STARTPTS,afade=t=out:st=%s:d=%s,%s' \
        "${SILENCE_FILTER}" "${start}" "${length}" "${fade_start}" "${fade}" "${LOUDNESS_FILTER}"
}

# Warn when a prepared sound is over its size budget; "short" is recognised by the id.
check_size() {
    local id="$1" file="$2" size limit
    size="$(wc -c <"${file}" | tr -d ' ')"
    limit="${LONG_LIMIT}"
    [[ ${id} == *short* ]] && limit="${SHORT_LIMIT}"
    if ((size > limit)); then
        log "warning: ${id} is ${size} bytes, over its ${limit} byte budget"
    fi
}

make_sound() {
    local source="$1" out_dir="$2" spec="$3"
    local CUT_ID CUT_START CUT_LENGTH CUT_FADE tmp final
    parse_cut "${spec}"
    tmp="$(mktemp "${TMPDIR:-/tmp}/${CUT_ID}.XXXXXX.mp3")"
    ffmpeg -nostdin -loglevel error -y -i "${source}" \
        -af "$(build_filter "${CUT_START}" "${CUT_LENGTH}" "${CUT_FADE}")" \
        -ac 1 -b:a "${BITRATE}" -f mp3 "${tmp}" ||
        die "ffmpeg failed for ${CUT_ID}"
    final="${out_dir}/${CUT_ID}.$(content_hash "${tmp}").mp3"
    mv "${tmp}" "${final}"
    chmod 644 "${final}"
    check_size "${CUT_ID}" "${final}"
    printf '%s\n' "${final}"
}

parse_args() {
    OUT_DIR="apps/web/public/audio"
    ARGS=()
    while (($# > 0)); do
        case "$1" in
        -h | --help)
            usage
            exit 0
            ;;
        -o | --out-dir)
            [[ $# -ge 2 ]] || usage_error "$1 needs a value"
            OUT_DIR="$2"
            shift 2
            ;;
        -*) usage_error "unknown flag: $1" ;;
        *)
            ARGS+=("$1")
            shift
            ;;
        esac
    done
    ((${#ARGS[@]} >= 2)) || usage_error "give a source recording and at least one cut"
}

main() {
    local OUT_DIR ARGS source spec
    parse_args "$@"
    require_cmd ffmpeg
    require_cmd shasum
    source="${ARGS[0]}"
    [[ -f ${source} ]] || die "source recording not found: ${source}"
    mkdir -p "${OUT_DIR}"
    for spec in "${ARGS[@]:1}"; do
        make_sound "${source}" "${OUT_DIR}" "${spec}"
    done
}

if [[ ${BASH_SOURCE[0]} == "$0" ]]; then
    main "$@"
fi
