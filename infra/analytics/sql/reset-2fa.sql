-- Server-level 2FA reset for one dashboard user, for the case where every administrator
-- has lost their authenticator and backup codes (docs/runbook.md, analytics section).
-- Run it with bin/reset-2fa.sh <username>, which checks that the user exists. Schema of
-- Umami 3.4.1. Never change TWO_FACTOR_ENCRYPTION_KEY. TO BE TESTED on a clean instance in
-- stage 2 before it is relied on.
\set ON_ERROR_STOP on
BEGIN;
DELETE FROM two_factor_backup_code WHERE user_id IN (SELECT user_id FROM "user" WHERE username = :'target_user' AND deleted_at IS NULL);
DELETE FROM two_factor_otp_used WHERE user_id IN (SELECT user_id FROM "user" WHERE username = :'target_user' AND deleted_at IS NULL);
DELETE FROM two_factor_rate_limit WHERE user_id IN (SELECT user_id FROM "user" WHERE username = :'target_user' AND deleted_at IS NULL);
DELETE FROM two_factor_auth WHERE user_id IN (SELECT user_id FROM "user" WHERE username = :'target_user' AND deleted_at IS NULL);
COMMIT;
