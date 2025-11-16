-- Ensure NOTIFY payload is text by explicitly casting UUID to text
-- Recreate trigger function and trigger with correct payload casting

-- Drop existing trigger if it exists
DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'normalization_session_projection_update_trigger'
  ) THEN
    DROP TRIGGER normalization_session_projection_update_trigger ON normalization_session_projections;
  END IF;
END $$;

-- Drop existing function if it exists
DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE proname = 'notify_normalization_session_projection_update'
  ) THEN
    DROP FUNCTION notify_normalization_session_projection_update();
  END IF;
END $$;

-- Create trigger function to send NOTIFY when normalization_session_projections is updated
CREATE OR REPLACE FUNCTION notify_normalization_session_projection_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Explicitly cast UUID to text for pg_notify payload
  PERFORM pg_notify('normalization_session_projection_update', NEW.normalization_session_id::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on normalization_session_projections table
CREATE TRIGGER normalization_session_projection_update_trigger
AFTER INSERT OR UPDATE ON normalization_session_projections
FOR EACH ROW
EXECUTE FUNCTION notify_normalization_session_projection_update();


