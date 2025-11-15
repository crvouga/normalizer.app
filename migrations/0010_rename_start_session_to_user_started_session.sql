-- First, normalize all events to ensure they're proper JSONB (handle double-encoded JSON)
-- This converts any text-encoded JSON strings to proper JSONB by casting through text
UPDATE normalization_session_events
SET event = (event::text)::jsonb;--> statement-breakpoint

-- Then, migrate existing events from 'start-session' to 'user-started-session'
UPDATE normalization_session_events
SET event = jsonb_set(event, '{type}', '"user-started-session"')
WHERE event->>'type' = 'start-session';--> statement-breakpoint
