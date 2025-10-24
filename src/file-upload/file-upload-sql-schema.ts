export const FILE_UPLOAD_SQL_SCHEMA = `
CREATE OR REPLACE FUNCTION update_files_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TABLE IF NOT EXISTS files();

ALTER TABLE files ADD COLUMN IF NOT EXISTS data JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE files ADD COLUMN IF NOT EXISTS key text GENERATED ALWAYS AS ((data->>'key')::text) STORED;
ALTER TABLE files ADD COLUMN IF NOT EXISTS filename text GENERATED ALWAYS AS ((data->>'filename')::text) STORED;
ALTER TABLE files ADD COLUMN IF NOT EXISTS content_type text GENERATED ALWAYS AS ((data->>'content_type')::text) STORED;
ALTER TABLE files ADD COLUMN IF NOT EXISTS size integer GENERATED ALWAYS AS ((data->>'size')::integer) STORED;
ALTER TABLE files ADD COLUMN IF NOT EXISTS file_type text GENERATED ALWAYS AS ((data->>'file_type')::text) STORED;
ALTER TABLE files ADD COLUMN IF NOT EXISTS user_id text GENERATED ALWAYS AS ((data->>'user_id')::text) STORED;
ALTER TABLE files ADD COLUMN IF NOT EXISTS status text GENERATED ALWAYS AS ((data->>'status')::text) STORED;
ALTER TABLE files ADD COLUMN IF NOT EXISTS s3_bucket text GENERATED ALWAYS AS ((data->>'s3_bucket')::text) STORED;
ALTER TABLE files ADD COLUMN IF NOT EXISTS s3_region text GENERATED ALWAYS AS ((data->>'s3_region')::text) STORED;
ALTER TABLE files ADD COLUMN IF NOT EXISTS s3_key text GENERATED ALWAYS AS ((data->>'s3_key')::text) STORED;

ALTER TABLE files DROP CONSTRAINT IF EXISTS files_pkey CASCADE;
ALTER TABLE files ADD PRIMARY KEY (key);

ALTER TABLE files ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE files ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE files ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

DROP INDEX IF EXISTS files_created_at_idx;
CREATE INDEX IF NOT EXISTS files_created_at_idx ON files(created_at);
DROP INDEX IF EXISTS files_updated_at_idx;
CREATE INDEX IF NOT EXISTS files_updated_at_idx ON files(updated_at);
DROP INDEX IF EXISTS files_deleted_at_idx;
CREATE INDEX IF NOT EXISTS files_deleted_at_idx ON files(deleted_at);
DROP INDEX IF EXISTS files_filename_idx;
CREATE INDEX IF NOT EXISTS files_filename_idx ON files(filename);
DROP INDEX IF EXISTS files_user_id_idx;
CREATE INDEX IF NOT EXISTS files_user_id_idx ON files(user_id);
DROP INDEX IF EXISTS files_status_idx;
CREATE INDEX IF NOT EXISTS files_status_idx ON files(status);
DROP INDEX IF EXISTS files_s3_bucket_idx;
CREATE INDEX IF NOT EXISTS files_s3_bucket_idx ON files(s3_bucket);
DROP INDEX IF EXISTS files_s3_key_idx;
CREATE INDEX IF NOT EXISTS files_s3_key_idx ON files(s3_key);

DROP TRIGGER IF EXISTS update_files_updated_at ON files;
CREATE TRIGGER update_files_updated_at
BEFORE UPDATE ON files
FOR EACH ROW
EXECUTE FUNCTION update_files_updated_at_column();
`;
