-- Synthetic data for test/smoke.sh: old and new rows, including the awkward cases the
-- retention job must survive (a child row newer than its parent, an old session that still
-- has a recent event) and fields the scrub must clear. Umami 3.4.1 schema.
\set ON_ERROR_STOP on
INSERT INTO website (website_id, name, domain, created_at)
VALUES ('00000000-0000-0000-0000-0000000000a1', 'test', 'app.example.test', now());

INSERT INTO session (session_id, website_id, browser, os, device, screen, language, country, region, city, distinct_id, created_at) VALUES
 -- b1: old, unwanted fields, old events
 ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', 'firefox', 'Linux', 'desktop', '1920x1080', 'en', 'US', 'CA', 'Fresno', 'who', now() - interval '13 months'),
 -- b2: new, unwanted fields, one new event
 ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000a1', 'chrome', 'Android', 'mobile', '412x915', 'my', 'MM', 'YG', 'Yangon', 'who', now() - interval '1 hour'),
 -- b3: old session that still has a recent event, so it must stay
 ('00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-0000000000a1', 'safari', 'iOS', 'mobile', NULL, 'en', 'US', NULL, NULL, NULL, now() - interval '14 months'),
 -- b4: old session with no events and a session_data row newer than itself
 ('00000000-0000-0000-0000-0000000000b4', '00000000-0000-0000-0000-0000000000a1', 'edge', 'Windows', 'desktop', NULL, 'en', 'GB', NULL, NULL, NULL, now() - interval '13 months');

INSERT INTO website_event (event_id, website_id, session_id, visit_id, created_at, url_path, url_query, referrer_path, referrer_query, referrer_domain, page_title, utm_source, event_type, event_name, hostname) VALUES
 ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', gen_random_uuid(), now() - interval '13 months', '/en/', NULL, NULL, NULL, NULL, NULL, NULL, 1, NULL, 'app.example.test'),
 ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', gen_random_uuid(), now() - interval '12 months 1 day', '/en/classes/', NULL, NULL, NULL, NULL, NULL, NULL, 1, NULL, 'app.example.test'),
 ('00000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b3', gen_random_uuid(), now() - interval '13 months', '/en/', NULL, NULL, NULL, NULL, NULL, NULL, 1, NULL, 'app.example.test'),
 ('00000000-0000-0000-0000-0000000000c4', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b2', gen_random_uuid(), now() - interval '1 hour', '/en/dhamma-library/', 'q=secret', '/en/', 'q=also-secret', 'app.example.test', 'A title', 'newsletter', 1, NULL, 'app.example.test'),
 ('00000000-0000-0000-0000-0000000000c5', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b3', gen_random_uuid(), now() - interval '2 hours', '/en/classes/', NULL, NULL, NULL, NULL, NULL, NULL, 2, 'class_zoom_join_click', 'app.example.test');

INSERT INTO event_data (event_data_id, website_id, website_event_id, data_key, string_value, data_type, created_at) VALUES
 -- d1: a few milliseconds after its old parent
 (gen_random_uuid(), '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c1', 'k', 'v', 1, now() - interval '13 months' + interval '5 milliseconds'),
 -- d2: newer than the cutoff although its parent is older (the case that broke the first version)
 (gen_random_uuid(), '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c2', 'k', 'v', 1, now()),
 -- d3: new row on a new event, must stay
 (gen_random_uuid(), '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c5', 'class', 'x', 1, now());

INSERT INTO session_data (session_data_id, website_id, session_id, data_key, string_value, data_type, distinct_id, created_at) VALUES
 (gen_random_uuid(), '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', 'k', 'v', 1, 'who', now()),
 (gen_random_uuid(), '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b4', 'k', 'v', 1, NULL, now()),
 (gen_random_uuid(), '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b2', 'k', 'v', 1, 'who', now());
