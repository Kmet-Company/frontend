-- Point cameras at files shipped in Angular `public/` (built to site root).
-- Run after 001_add_video_url.sql if your DB was created before init.sql had these paths.

UPDATE camera SET video_url = '/cam-main.mp4'     WHERE code = 'cam-main';
UPDATE camera SET video_url = '/cam-main.mp4'  WHERE code = 'cam-bar';
UPDATE camera SET video_url = '/kocani.mp4'    WHERE code = 'cam-entrance';
UPDATE camera SET video_url = '/black_and_white.mp4'  WHERE code = 'cam-stage';
