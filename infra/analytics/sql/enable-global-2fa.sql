-- Requires two-factor sign-in for every dashboard account (Umami's global setting, the
-- same one as Admin > Security). install.sh runs it before Caddy opens the ports, so the
-- generated administrator password never works without a second factor. Idempotent.
-- Umami 3.4.1: table app_setting, key twoFactorRequiredGlobal (src/app/api/admin/2fa/global).
\set ON_ERROR_STOP on
INSERT INTO app_setting (key, value) VALUES ('twoFactorRequiredGlobal', 'true')
ON CONFLICT (key) DO UPDATE SET value = 'true';
