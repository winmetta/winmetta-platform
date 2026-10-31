#!/usr/bin/env bash
# Daily: delete events past the retention limit and scrub fields we never keep
# (sql/maintenance.sql). Records success (for the daily health report) when it finishes.
set -euo pipefail
docker exec -i analytics-postgres psql -U umami -d umami <"/opt/analytics/sql/maintenance.sql"
install -d /var/lib/analytics/status
date +%s >/var/lib/analytics/status/maintenance.ok
