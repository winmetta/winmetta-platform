-- Daily maintenance for the Umami database (run by bin/maintenance.sh).
-- Table and column names are those of Umami 3.4.1 (prisma/schema.prisma); re-check them
-- when upgrading Umami (docs/analytics.md section 9).
\set ON_ERROR_STOP on
BEGIN;

-- 1. Retention: live events are kept 12 months; dumps expire after 21 days and snapshots
--    after 14, so no copy of an event outlives 13 months (docs/analytics.md section 4).
--    Children are deleted THROUGH their parents, not by their own created_at: event_data
--    and session_data have foreign keys to website_event and session, and a child row
--    that is a few milliseconds newer than its parent would otherwise make the whole
--    transaction fail every night.
CREATE TEMP TABLE old_events ON COMMIT DROP AS
  SELECT event_id FROM website_event WHERE created_at < now() - interval '12 months';
CREATE TEMP TABLE old_sessions ON COMMIT DROP AS
  SELECT s.session_id FROM session s
   WHERE s.created_at < now() - interval '12 months'
     AND NOT EXISTS (
       SELECT 1 FROM website_event e
        WHERE e.session_id = s.session_id
          AND e.created_at >= now() - interval '12 months');

DELETE FROM event_data WHERE website_event_id IN (SELECT event_id FROM old_events);
DELETE FROM event_data WHERE created_at < now() - interval '12 months';
DELETE FROM session_data WHERE session_id IN (SELECT session_id FROM old_sessions);
DELETE FROM session_data WHERE created_at < now() - interval '12 months';
DELETE FROM website_event WHERE event_id IN (SELECT event_id FROM old_events);
DELETE FROM session WHERE session_id IN (SELECT session_id FROM old_sessions);

-- 2. Backstop scrub: fields we never want to keep, whatever the tracker sent
--    (docs/analytics.md section 4 rules 4 and 8, section 9 item 15).
UPDATE session
   SET screen = NULL, region = NULL, city = NULL, distinct_id = NULL
 WHERE screen IS NOT NULL OR region IS NOT NULL OR city IS NOT NULL OR distinct_id IS NOT NULL;
UPDATE website_event
   SET url_query = NULL, referrer_query = NULL, page_title = NULL,
       utm_source = NULL, utm_medium = NULL, utm_campaign = NULL, utm_content = NULL, utm_term = NULL,
       gclid = NULL, fbclid = NULL, msclkid = NULL, ttclid = NULL, li_fat_id = NULL, twclid = NULL
 WHERE url_query IS NOT NULL OR referrer_query IS NOT NULL OR page_title IS NOT NULL
    OR utm_source IS NOT NULL OR utm_medium IS NOT NULL OR utm_campaign IS NOT NULL
    OR utm_content IS NOT NULL OR utm_term IS NOT NULL OR gclid IS NOT NULL OR fbclid IS NOT NULL
    OR msclkid IS NOT NULL OR ttclid IS NOT NULL OR li_fat_id IS NOT NULL OR twclid IS NOT NULL;
UPDATE session_data SET distinct_id = NULL WHERE distinct_id IS NOT NULL;

COMMIT;
