/**
 * Demo / dev defaults when `camera.video_url` is empty in PostgREST.
 * Files live in `public/` and are served at `/name.mp4`.
 */
const DEFAULT_CLIP_BY_CODE: Record<string, string> = {
  'cam-main': '/cam-main.mp4',
  'cam-bar': '/bilijard.mp4',
  'cam-entrance': '/kocani.mp4',
  'cam-stage': '/fight_0014.mp4',
};

/** MP4 URL for the tile: explicit `videoUrl`, else known default, else `/<code>.mp4`. */
export function resolveCameraVideoUrl(camera: {
  id: string;
  videoUrl?: string;
}): string {
  const trimmed = camera.videoUrl?.trim();
  if (trimmed) return trimmed;
  return DEFAULT_CLIP_BY_CODE[camera.id] ?? `/${camera.id}.mp4`;
}
