import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import {
  AiGatewayService,
  FirePredictResponse,
  ViolencePredictResponse,
} from './ai-gateway.service';

function toAbsoluteVideoUrl(url: string): string {
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  const path = url.startsWith('/') ? url : `/${url}`;
  return `${window.location.origin}${path}`;
}

function waitLoadedMetadata(video: HTMLVideoElement): Promise<void> {
  return new Promise((resolve, reject) => {
    if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
      resolve();
      return;
    }
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error('Video failed to load (check URL / CORS)'));
  });
}

@Injectable({ providedIn: 'root' })
export class VideoChunkAnalysisService {
  private readonly gateway = inject(AiGatewayService);

  readonly chunkSeconds = 3;

  /**
   * Decode `videoUrl` in a hidden `<video>`, record ~`chunkSeconds` WebM slices with
   * `MediaRecorder`, POST each blob to `/gateway/predict-upload` (violence) and
   * `/gateway/predict-fire-upload` (fire) independently, and stream log lines.
   */
  async analyzeUrlInThreeSecondChunks(
    videoUrl: string,
    onLine: (line: string) => void,
    onChunkDone?: (index: number, total: number, summary: string) => void,
  ): Promise<void> {
    const abs = toAbsoluteVideoUrl(videoUrl);
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.src = abs;

    try {
      await waitLoadedMetadata(video);
      const duration = Number.isFinite(video.duration) ? video.duration : 0;
      if (duration <= 0) {
        throw new Error('Video duration is not available');
      }

      const totalChunks = Math.max(1, Math.ceil(duration / this.chunkSeconds));
      onLine(
        `Source ${duration.toFixed(1)}s → ${totalChunks} chunk(s) × ${this.chunkSeconds}s → violence + fire (two POSTs per chunk)`,
      );
      console.info(
        `[3s-chunk-ai] start url=${abs} chunks=${totalChunks} step=${this.chunkSeconds}s`,
      );

      for (let i = 0; i < totalChunks; i++) {
        const start = i * this.chunkSeconds;
        const len = Math.min(this.chunkSeconds, duration - start);
        if (len <= 0.05) {
          break;
        }

        onLine(
          `Chunk ${i + 1}/${totalChunks}: record ${start.toFixed(2)}s–${(start + len).toFixed(2)}s …`,
        );
        const blob = await this.recordSegment(video, start, len);
        onLine(`  → ${(blob.size / 1024).toFixed(0)} KiB, uploading violence + fire …`);
        onLine(
          i === 0
            ? '  → first chunk may wait a long time while models load (see gateway / ai logs)…'
            : '  → waiting for inference…',
        );

        const violence = await firstValueFrom(
          this.gateway.predictUpload(blob, `chunk-${i}-violence.webm`),
        );
        const fire = await firstValueFrom(
          this.gateway.predictFireUpload(blob, `chunk-${i}-fire.webm`),
        );

        const vLine = this.formatViolence(violence);
        const fLine = this.formatFire(fire);
        onLine(`  ← ${vLine}`);
        onLine(`  ← ${fLine}`);
        const summary = `${vLine}; ${fLine}`;
        onChunkDone?.(i, totalChunks, summary);
        console.info(`[3s-chunk-ai] chunk ${i + 1}/${totalChunks}`, summary);
      }
    } finally {
      video.pause();
      video.removeAttribute('src');
      video.load();
    }
  }

  private formatViolence(res: ViolencePredictResponse): string {
    if (res.mock) {
      return 'violence (mock): ' + this.formatViolenceRow(res.results?.[0]);
    }
    const rows = res.results ?? [];
    const top = rows[0];
    if (!top) {
      return 'violence: no rows';
    }
    if (rows.length === 1) {
      return 'violence: ' + this.formatViolenceRow(top);
    }
    return `violence: ${rows.length} window(s); first: ${this.formatViolenceRow(top)}`;
  }

  private formatViolenceRow(
    r:
      | {
          prediction?: string;
          violent_probability?: number;
          non_violent_probability?: number;
        }
      | undefined,
  ): string {
    if (!r) {
      return 'n/a';
    }
    const p = r.prediction ?? '?';
    const v = r.violent_probability;
    const n = r.non_violent_probability;
    if (typeof v === 'number' && typeof n === 'number') {
      return `${p} (violent ${v.toFixed(3)} / non-violent ${n.toFixed(3)})`;
    }
    return String(p);
  }

  private formatFire(res: FirePredictResponse): string {
    if (res.mock) {
      return 'fire (mock): ' + this.formatFireRow(res.results?.[0]);
    }
    const rows = res.results ?? [];
    const top = rows[0];
    if (!top) {
      return 'fire: no rows';
    }
    if (rows.length === 1) {
      return 'fire: ' + this.formatFireRow(top);
    }
    const anyFire = rows.some((x) => x.fire_detected);
    return `fire: ${rows.length} window(s), any_fire=${anyFire}; first: ${this.formatFireRow(top)}`;
  }

  private formatFireRow(
    r:
      | {
          fire_detected?: boolean;
          max_fire_confidence?: number;
          frames_scored?: number;
        }
      | undefined,
  ): string {
    if (!r) {
      return 'n/a';
    }
    const det = r.fire_detected ? 'YES' : 'no';
    const c = r.max_fire_confidence ?? 0;
    const fs = r.frames_scored ?? 0;
    return `${det} (max conf ${Number(c).toFixed(3)}, frames_scored ${fs})`;
  }

  private pickWebmMime(): string | null {
    const candidates = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
    ];
    for (const t of candidates) {
      if (MediaRecorder.isTypeSupported(t)) {
        return t;
      }
    }
    return null;
  }

  private seekVideo(video: HTMLVideoElement, seconds: number): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!Number.isFinite(seconds) || seconds < 0) {
        reject(new Error('invalid seek time'));
        return;
      }
      const onSeeked = () => {
        video.removeEventListener('seeked', onSeeked);
        resolve();
      };
      video.addEventListener('seeked', onSeeked, { once: true });
      video.currentTime = seconds;
      if (Math.abs(video.currentTime - seconds) < 0.04) {
        video.removeEventListener('seeked', onSeeked);
        queueMicrotask(() => resolve());
      }
    });
  }

  private async recordSegment(
    video: HTMLVideoElement,
    startSec: number,
    durationSec: number,
  ): Promise<Blob> {
    const mime = this.pickWebmMime();
    if (!mime) {
      throw new Error('No WebM codec supported for MediaRecorder in this browser');
    }

    video.pause();
    await this.seekVideo(video, startSec);

    const cap = (
      video as HTMLVideoElement & { captureStream?: (fps?: number) => MediaStream }
    ).captureStream;
    if (typeof cap !== 'function') {
      throw new Error('video.captureStream() is not supported in this browser');
    }
    const stream = cap.call(video, 30);

    const chunks: Blob[] = [];
    const rec = new MediaRecorder(stream, { mimeType: mime });

    return new Promise((resolve, reject) => {
      rec.ondataavailable = (ev: BlobEvent) => {
        if (ev.data && ev.data.size > 0) {
          chunks.push(ev.data);
        }
      };
      rec.onerror = () => reject(new Error('MediaRecorder error'));
      rec.onstop = () => {
        video.pause();
        const type = mime.split(';')[0] || 'video/webm';
        const blob = new Blob(chunks, { type });
        if (blob.size < 32) {
          reject(new Error('Recorded chunk is empty (try a different browser or codec)'));
          return;
        }
        resolve(blob);
      };

      void video
        .play()
        .then(() => {
          try {
            rec.start(250);
          } catch (e) {
            reject(e instanceof Error ? e : new Error(String(e)));
            return;
          }
          window.setTimeout(() => {
            try {
              if (rec.state === 'recording') {
                rec.stop();
              }
            } catch {
              /* ignore */
            }
          }, Math.ceil(durationSec * 1000) + 400);
        })
        .catch(reject);
    });
  }
}
