import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { BoundingBox, CameraFeed } from '../models/venue.models';
import { resolveCameraVideoUrl } from '../utils/camera-default-video';
import { AiGatewayService, FireFrameResponse } from './ai-gateway.service';
import { AlertsService } from './alerts.service';

/**
 * Live fire detection loop.
 *
 * For each camera we own a hidden off-screen `<video>` element that mirrors
 * whatever clip the tile is currently playing. On a fixed timer we draw the
 * current frame to a throwaway `<canvas>`, JPEG-encode it, and POST it to
 * `/gateway/detect-fire-frame/{cameraId}`. The response carries YOLO
 * bounding boxes in 0..1 normalised coordinates which we expose per-camera
 * via the {@link boxesByCamera} signal so the dashboard can overlay them
 * on the camera tile regardless of the on-screen size.
 *
 * When a non-empty response comes back we also call
 * {@link AlertsService.raiseFireAlert} which internally cooldowns at one
 * alert per minute per camera.
 *
 * We intentionally drive the loop off hidden videos instead of the visible
 * tiles so detection keeps running in focus mode (where only one tile is
 * rendered) and survives any DOM churn in the dashboard layout.
 */
@Injectable({ providedIn: 'root' })
export class FireDetectionService {
  private readonly gateway = inject(AiGatewayService);
  private readonly alerts = inject(AlertsService);

  /**
   * Camera IDs to run YOLO fire detection on. Explicitly a whitelist so we
   * don't waste CPU (server + client) analysing feeds that will never see
   * a fire in the demo dataset — `cam-entrance` plays `kocani.mp4` which
   * has the flame footage.
   */
  private static readonly FIRE_CAMERA_IDS: ReadonlySet<string> = new Set([
    'cam-entrance',
  ]);

  /** Poll cadence per camera. 1500 ms = ~40 requests/min per tile. */
  private static readonly POLL_INTERVAL_MS = 1500;
  /** JPEG long-edge target — small enough to stay under ~60 KiB, big
   *  enough that YOLO still resolves flame shapes. */
  private static readonly FRAME_MAX_WIDTH = 640;
  private static readonly JPEG_QUALITY = 0.72;
  /**
   * How long we keep the last detected boxes visible after a blank frame.
   * Kept tight so boxes don't sit on the overlay for seconds after the
   * fire leaves the viewport — 400 ms is roughly one poll cycle of slack.
   */
  private static readonly BOX_LINGER_MS = 400;
  /**
   * Cap the number of boxes drawn per frame so multiple overlapping YOLO
   * detections on the same flame don't crowd the overlay. We keep the
   * top-N by confidence.
   */
  private static readonly MAX_BOXES_PER_FRAME = 3;

  private readonly _boxesByCamera = signal<Record<string, BoundingBox[]>>({});
  /** Map of `cameraId → boxes[]` currently overlaid on the tile. */
  readonly boxesByCamera = this._boxesByCamera.asReadonly();

  private readonly videos = new Map<string, HTMLVideoElement>();
  private readonly timers = new Map<string, ReturnType<typeof setInterval>>();
  /** Guards against piling up requests when the backend is slow. */
  private readonly inflight = new Set<string>();
  /** Last wall-clock ms we saw any box for the camera (used for linger). */
  private readonly lastHitAt = new Map<string, number>();
  /**
   * Base64 data URL of the JPEG that belongs to the most recent POST per
   * camera. We hold onto it so that when YOLO returns `fire_detected=true`
   * we can attach the exact source frame to the alert card.
   */
  private readonly lastFrameDataUrl = new Map<string, string>();
  private running = false;

  /**
   * Idempotent. Call whenever the camera list is available — subsequent
   * calls wire up any cameras that weren't already running. Pass the same
   * list as the dashboard renders; changes to a camera's `videoUrl` will
   * be picked up because we read {@link resolveCameraVideoUrl} every time.
   */
  start(cameras: CameraFeed[]): void {
    this.running = true;

    // Whitelist: only cameras in FIRE_CAMERA_IDS actually get analysed.
    // Anything else is ignored, and any previously-tracked camera that
    // drops off this filtered list is torn down.
    const eligible = cameras.filter((c) =>
      FireDetectionService.FIRE_CAMERA_IDS.has(c.id),
    );
    const eligibleIds = new Set(eligible.map((c) => c.id));

    for (const id of Array.from(this.videos.keys())) {
      if (!eligibleIds.has(id)) {
        this.disposeCamera(id);
      }
    }

    for (const cam of eligible) {
      this.ensureCamera(cam);
    }
  }

  /** Tear down every hidden video + timer. Safe to call during teardown. */
  stop(): void {
    this.running = false;
    for (const id of Array.from(this.videos.keys())) {
      this.disposeCamera(id);
    }
    this._boxesByCamera.set({});
  }

  private ensureCamera(cam: CameraFeed): void {
    const existing = this.videos.get(cam.id);
    const desiredSrc = resolveCameraVideoUrl(cam);
    if (existing) {
      // Swap src if the underlying clip changed (e.g. PostgREST hydrate).
      if (existing.src !== new URL(desiredSrc, window.location.href).href) {
        existing.src = desiredSrc;
        existing.load();
        existing.play().catch(() => void 0);
      }
      return;
    }

    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.autoplay = true;
    // 1×1 near-invisible pinhole keeps the element in the DOM (and thus
    // decoding frames) without consuming layout space. `display:none`
    // would stop decoding in some browsers.
    video.style.position = 'fixed';
    video.style.left = '0';
    video.style.top = '0';
    video.style.width = '1px';
    video.style.height = '1px';
    video.style.opacity = '0';
    video.style.pointerEvents = 'none';
    video.setAttribute('aria-hidden', 'true');
    video.src = desiredSrc;
    document.body.appendChild(video);
    // Browsers increasingly require a user gesture to autoplay; if that
    // blocks us, we just keep retrying on every poll tick.
    video.play().catch(() => void 0);

    this.videos.set(cam.id, video);

    const timer = setInterval(() => {
      if (!this.running) return;
      void this.pollCamera(cam);
    }, FireDetectionService.POLL_INTERVAL_MS);
    this.timers.set(cam.id, timer);
  }

  private disposeCamera(id: string): void {
    const timer = this.timers.get(id);
    if (timer !== undefined) {
      clearInterval(timer);
      this.timers.delete(id);
    }
    const video = this.videos.get(id);
    if (video) {
      video.pause();
      video.removeAttribute('src');
      video.load();
      video.remove();
      this.videos.delete(id);
    }
    this.lastHitAt.delete(id);
    this.lastFrameDataUrl.delete(id);
    this.inflight.delete(id);
    this._boxesByCamera.update((m) => {
      if (!m[id]) return m;
      const next = { ...m };
      delete next[id];
      return next;
    });
  }

  private blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error ?? new Error('FileReader failed'));
      reader.readAsDataURL(blob);
    });
  }

  private async pollCamera(cam: CameraFeed): Promise<void> {
    if (this.inflight.has(cam.id)) return;
    const video = this.videos.get(cam.id);
    if (!video) return;

    if (video.readyState < 2 || !video.videoWidth) {
      // Nudge playback if autoplay was blocked — page interaction is all
      // it takes and this is a cheap no-op otherwise.
      if (video.paused) video.play().catch(() => void 0);
      return;
    }

    const blob = await this.grabJpeg(video);
    if (!blob) return;

    // Cache the JPEG as a data URL on every successful grab so we don't
    // have to re-encode when the very next response says "fire detected".
    // Base64 adds ~33% overhead but keeps the alert self-contained (no
    // blob: URLs that would need revoking when the alert is dismissed).
    try {
      this.lastFrameDataUrl.set(cam.id, await this.blobToDataUrl(blob));
    } catch {
      // Non-fatal — we'd just raise the alert without a preview.
    }

    this.inflight.add(cam.id);
    try {
      const res = await firstValueFrom(
        this.gateway.detectFireFrame(cam.id, blob),
      );
      this.applyResult(cam, res);
    } catch (err) {
      // ai-fire / gateway can be offline (mock mode) — keep quiet, just
      // drop this tick and try again on the next timer.
      // eslint-disable-next-line no-console
      console.debug('[fire-detection] poll failed', cam.id, err);
    } finally {
      this.inflight.delete(cam.id);
    }
  }

  private async grabJpeg(video: HTMLVideoElement): Promise<Blob | null> {
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return null;
    const targetW = Math.min(FireDetectionService.FRAME_MAX_WIDTH, vw);
    const targetH = Math.round(targetW * (vh / vw));
    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    try {
      ctx.drawImage(video, 0, 0, targetW, targetH);
    } catch {
      // CORS-tainted canvas. Shouldn't happen for same-origin /public
      // videos, but bail gracefully if it does.
      return null;
    }
    return new Promise<Blob | null>((resolve) => {
      canvas.toBlob(
        (b) => resolve(b),
        'image/jpeg',
        FireDetectionService.JPEG_QUALITY,
      );
    });
  }

  private applyResult(cam: CameraFeed, res: FireFrameResponse): void {
    const now = Date.now();
    // Sort by confidence (descending) and keep only the top few so the
    // overlay doesn't get crowded when YOLO fires multiple overlapping
    // detections on the same flame.
    const topRaw = [...(res.boxes ?? [])]
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, FireDetectionService.MAX_BOXES_PER_FRAME);

    const boxes: BoundingBox[] = topRaw.map((b) => ({
      x: b.x,
      y: b.y,
      width: b.width,
      height: b.height,
      label: `${b.label} ${(b.confidence * 100).toFixed(0)}%`,
    }));

    if (boxes.length > 0) {
      this.lastHitAt.set(cam.id, now);
      this._boxesByCamera.update((m) => ({ ...m, [cam.id]: boxes }));
      // The live overlay already shows YOLO boxes (with tight linger) —
      // the alert just carries a snapshot + confidence, no persistent box.
      this.alerts.raiseFireAlert(
        cam.id,
        res.max_confidence,
        this.lastFrameDataUrl.get(cam.id),
      );
    } else {
      const last = this.lastHitAt.get(cam.id) ?? 0;
      if (now - last > FireDetectionService.BOX_LINGER_MS) {
        this._boxesByCamera.update((m) => {
          if (!m[cam.id]) return m;
          const next = { ...m };
          delete next[cam.id];
          return next;
        });
      }
    }
  }
}
