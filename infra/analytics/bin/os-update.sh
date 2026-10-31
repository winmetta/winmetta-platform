#!/usr/bin/env bash
# Weekly: apply all updates of the LATEST Amazon Linux 2023 repository release. An AL2023
# instance only sees the repository version of its launch image until told otherwise, so a
# plain `dnf upgrade` (or dnf-automatic) would never fetch new security fixes; AWS documents
# `--releasever=latest` for this and recommends applying all updates of a release, not a
# subset (https://docs.aws.amazon.com/linux/al2023/ug/managing-repos-os-updates.html).
# Records success for the daily health report. A kernel update needs a reboot (the report asks).
set -euo pipefail
dnf -y --releasever=latest upgrade
install -d /var/lib/analytics/status
date +%s >/var/lib/analytics/status/os-update.ok
