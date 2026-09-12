-- Phase 1: EUR default + one wallet row per (user_id, currency)
ALTER TABLE wallets ALTER COLUMN currency SET DEFAULT 'EUR';

-- Collapse duplicate (user_id, currency) rows: keep lowest id, drop rest
DELETE FROM wallets a
USING wallets b
WHERE a.user_id = b.user_id
  AND a.currency = b.currency
  AND a.id > b.id;

CREATE UNIQUE INDEX IF NOT EXISTS wallets_user_currency_uidx ON wallets (user_id, currency);
