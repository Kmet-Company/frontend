import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { CameraFeed } from '../models/venue.models';
import { resolveCameraVideoUrl } from '../utils/camera-default-video';
import {
  AiGatewayService,
  ViolencePredictResponse,
} from './ai-gateway.service';
import { AlertsService } from './alerts.service';
import { captureStreamFromVideo } from './video-chunk-analysis.service';

/**
 * Live violence detection loop.
 *
 * Mirrors {@link FireDetectionService} but targets the VideoMAE /
 * deepseek_api classifier instead of YOLO. The two loops run completely
 * independently so neither blocks the other.
 *
 * The flow for every cycle:
 *   1. Wait a beat so we don't hammer the CPU-only ai-vision container.
 *   2. Record a ~3s WebM slice from a hidden `<video>` via MediaRecorder.
 *   3. POST the blob to `/gateway/predict-upload`.
 *   4. If the model says `Violent` with `violent_probability` above the
 *      configured threshold, grab a still snapshot from the same hidden
 *      video and raise an alert via {@link AlertsService.raiseViolenceAlert}
 *      (internally cooldowned at 2 minutes per camera).
 *
 * Restricted by the {@link VIOLENCE_CAMERA_IDS} whitelist — only
 * `cam-main` runs the heavy model so the violence pipeline doesn't get
 * pinned to feeds that have nothing to classify.
 */
@Injectable({ providedIn: 'root' })
export class ViolenceDetectionService {
  private readonly gateway = inject(AiGatewayService);
  private readonly alerts = inject(AlertsService);

  /** Only cam-main plays the fight clip used for the demo. */
  private static readonly VIOLENCE_CAMERA_IDS: ReadonlySet<string> = new Set([
    'cam-main',
  ]);
  /** Length of each recorded slice in seconds. */
  private static readonly CHUNK_SECONDS = 3;
  /** Gap between cycle completions — keeps CPU load reasonable. */
  private static readonly COOLDOWN_MS = 10_000;
  /** violent_probability ≥ this raises an alert. */
  private static readonly VIOLENCE_THRESHOLD = 0.6;

  private readonly videos = new Map<string, HTMLVideoElement>();
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly inflight = new Set<string>();
  private running = false;

  /** Idempotent — safe to call on every cameras-signal tick. */
  start(cameras: CameraFeed[]): void {
    this.running = true;

    const eligible = cameras.filter((c) =>
      ViolenceDetectionService.VIOLENCE_CAMERA_IDS.has(c.id),
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

  stop(): void {
    this.running = false;
    for (const id of Array.from(this.videos.keys())) {
      this.disposeCamera(id);
    }
  }

  private ensureCamera(cam: CameraFeed): void {
    const existing = this.videos.get(cam.id);
    const desiredSrc = resolveCameraVideoUrl(cam);
    if (existing) {
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
    // Same off-screen pinhole trick as FireDetectionService — `display:none`
    // stops frame decoding in some browsers, 1×1 near-transparent doesn't.
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
    video.play().catch(() => void 0);

    this.videos.set(cam.id, video);
    this.scheduleNext(cam);
  }

  private disposeCamera(id: string): void {
    const timer = this.timers.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
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
    this.inflight.delete(id);
  }

  private scheduleNext(cam: CameraFeed): void {
    if (!this.running) return;
    const timer = setTimeout(() => {
      void this.runCycle(cam);
    }, ViolenceDetectionService.COOLDOWN_MS);
    this.timers.set(cam.id, timer);
  }

  private async runCycle(cam: CameraFeed): Promise<void> {
    if (!this.running) return;
    if (this.inflight.has(cam.id)) {
      // A previous cycle is still waiting on the model — skip this tick.
      this.scheduleNext(cam);
      return;
    }

    const video = this.videos.get(cam.id);
    if (!video) return;

    if (video.readyState < 2 || !video.videoWidth) {
      if (video.paused) video.play().catch(() => void 0);
      this.scheduleNext(cam);
      return;
    }

    this.inflight.add(cam.id);
    try {
      const blob = await this.recordLiveChunk(video);
      if (!blob || !blob.size) return;

      // Snapshot the frame at the end of the chunk — good enough as a
      // representative thumbnail for the alert card.
      let snapshot: string | undefined;
      try {
        snapshot = await this.grabSnapshot(video);
      } catch {
        // Snapshot is best-effort; the alert can still be raised without.
      }

      const res = await firstValueFrom(
        this.gateway.predictUpload(blob, `${cam.id}-live.webm`),
      );
      this.handleResponse(cam, res, snapshot);
    } catch (err) {
      // ai-vision may be down or mid-warmup — keep quiet, try again later.
      // eslint-disable-next-line no-console
      console.debug('[violence-detection] cycle failed', cam.id, err);
    } finally {
      this.inflight.delete(cam.id);
      this.scheduleNext(cam);
    }
  }

  private handleResponse(
    cam: CameraFeed,
    res: ViolencePredictResponse,
    snapshot: string | undefined,
  ): void {
    const results = res.results;
    if (!results || results.length === 0) return;

    // Pick the chunk row with the highest violent_probability — for a 3s
    // slice this is usually a single row anyway.
    const top = results.reduce((best, cur) =>
      cur.violent_probability > best.violent_probability ? cur : best,
    );

    if (
      top.prediction === 'Violent' &&
      top.violent_probability >= ViolenceDetectionService.VIOLENCE_THRESHOLD
    ) {
      this.alerts.raiseViolenceAlert(
        cam.id,
        top.violent_probability,
        snapshot,
      );
    }
  }

  /**
   * Records {@link CHUNK_SECONDS} of the currently-playing hidden video
   * via MediaRecorder on the element's captureStream. We never seek — the
   * hidden element plays on a continuous loop so the recording is
   * effectively "the last 3 seconds of the feed".
   */
  private recordLiveChunk(video: HTMLVideoElement): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const mime = pickRecorderMime();
      if (!mime) {
        reject(
          new Error(
            'No supported WebM MediaRecorder profile (use Chromium/Firefox)',
          ),
        );
        return;
      }

      try {
        const stream = captureStreamFromVideo(video);
        const rec = new MediaRecorder(stream, { mimeType: mime });
        const parts: Blob[] = [];
        rec.ondataavailable = (ev) => {
          if (ev.data.size) parts.push(ev.data);
        };
        rec.onerror = () => reject(new Error('MediaRecorder error'));
        rec.onstop = () => {
          resolve(new Blob(parts, { type: rec.mimeType || 'video/webm' }));
        };

        rec.start(250);
        setTimeout(() => {
          if (rec.state === 'recording') {
            rec.requestData();
            rec.stop();
          }
        }, ViolenceDetectionService.CHUNK_SECONDS * 1000);
      } catch (e) {
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    });
  }

  private grabSnapshot(video: HTMLVideoElement): Promise<string> {
    return new Promise((resolve, reject) => {
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      if (!vw || !vh) {
        reject(new Error('video has no frame yet'));
        return;
      }
      const targetW = Math.min(640, vw);
      const targetH = Math.round(targetW * (vh / vw));
      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('2d canvas not available'));
        return;
      }
      try {
        ctx.drawImage(video, 0, 0, targetW, targetH);
      } catch (e) {
        reject(e instanceof Error ? e : new Error(String(e)));
        return;
      }
      canvas.toBlob(
        (b) => {
          if (!b) {
            reject(new Error('toBlob returned null'));
            return;
          }
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () =>
            reject(reader.error ?? new Error('FileReader failed'));
          reader.readAsDataURL(b);
        },
        'image/jpeg',
        0.72,
      );
    });
  }
}

function pickRecorderMime(): string {
  const candidates = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c)) return c;
  }
  return '';
}
