-- Create trigger function to send NOTIFY when normalization_session_projections is updated
CREATE OR REPLACE FUNCTION notify_normalization_session_projection_update()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify('normalization_session_projection_update', NEW.normalization_session_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

-- Create trigger on normalization_session_projections table
CREATE TRIGGER normalization_session_projection_update_trigger
AFTER INSERT OR UPDATE ON normalization_session_projections
FOR EACH ROW
EXECUTE FUNCTION notify_normalization_session_projection_update();

