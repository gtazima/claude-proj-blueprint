-- Remove integração com Google Calendar.
-- Mantém apenas integração com Google Tasks.
-- Aplicar no Supabase SQL Editor antes de fazer deploy.

ALTER TABLE task DROP COLUMN IF EXISTS calendar_event_id;
ALTER TABLE property_settings DROP COLUMN IF EXISTS google_last_poll_token;
