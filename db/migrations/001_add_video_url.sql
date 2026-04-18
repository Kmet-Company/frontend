-- Run against an existing DB if it was initialized before `video_url` existed.
ALTER TABLE camera ADD COLUMN IF NOT EXISTS video_url TEXT;
