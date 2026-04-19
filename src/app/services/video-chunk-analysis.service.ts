import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import {
  AiGatewayService,
  FirePredictResponse,
  PredictUploadResponse,
  ViolencePredictResponse,
} from './ai-gateway.service';

function toAbsoluteVideoUrl(url: string): string {
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  const path = url.startsWith('/') ? url : `/${url}`;
  return `${window.location.origin}${path}`;
}

export { toAbsoluteVideoUrl, captureStreamFromVideo };

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

function waitSeeked(video: HTMLVideoElement): Promise<void> {
  return new Promise((resolve) => {
    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked);
      resolve();
    };
    video.addEventListener('seeked', onSeeked);
  });
}

/** `captureStream` exists in Chromium/Firefox; DOM typings may lag. */
function captureStreamFromVideo(video: HTMLVideoElement): MediaStream {
  const v = video as HTMLVideoElement & { captureStream(): MediaStream };
  return v.captureStream();
}

function pickRecorderMime(): string {
  const candidates = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c)) {
      return c;
    }
  }
  return '';
}

function isFireResponse(res: PredictUploadResponse): res is FirePredictResponse {
  const r0 = res.results?.[0];
  return !!r0 && 'fire_detected' in r0;
}

export interface ChunkAnalysisOptions {
  /** Gateway routing: `cam-entrance` → fire, `cam-main` → violence, etc. */
  cameraCode?: string;
  /** For callbacks / logging (tile id). */
  cameraId?: string;
  /** Log prefix, e.g. `[violence]` */
  logPrefix?: string;
  onDetection?: (payload: {
    kind: 'violence' | 'fire';
    cameraId: string;
    cameraCode: string;
    startSec: number;
    endSec: number;
    summary: string;
    response: PredictUploadResponse;
  }) => void;
}

/**
 * Records the &lt;video&gt; timeline in fixed wall-clock slices via MediaRecorder
 * and POSTs each blob to the gateway → violence or fire model (via `cameraCode`).
 */
@Injectable({ providedIn: 'root' })
export class VideoChunkAnalysisService {
  private readonly gateway = inject(AiGatewayService);

  readonly chunkSeconds = 3;

  async analyzeUrlInThreeSecondChunks(
    videoUrl: string,
    onLine: (line: string) => void,
    onChunkDone?: (index: number, total: number, summary: string) => void,
    opts?: ChunkAnalysisOptions,
  ): Promise<void> {
    const prefix = opts?.logPrefix ? `${opts.logPrefix} ` : '';
    const cameraCode = opts?.cameraCode?.trim();
    const cameraId = opts?.cameraId?.trim() ?? '';
    const routeHint =
      cameraCode && ['cam-entrance', 'kocani', 'kochani'].includes(cameraCode)
        ? 'fire YOLO'
        : 'violence VideoMAE';

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
        `${prefix}Source ${duration.toFixed(1)}s → ${totalChunks} chunk(s) × ${this.chunkSeconds}s → /gateway/predict-upload (${routeHint}${cameraCode ? `, camera_code=${cameraCode}` : ''})`,
      );
      console.info(
        `[3s-chunk-ai] start url=${abs} chunks=${totalChunks} camera=${cameraCode ?? 'default'}`,
      );

      for (let i = 0; i < totalChunks; i++) {
        const start = i * this.chunkSeconds;
        const len = Math.min(this.chunkSeconds, duration - start);
        if (len <= 0.05) {
          break;
        }

        onLine(
          `${prefix}Chunk ${i + 1}/${totalChunks}: record ${start.toFixed(2)}s–${(start + len).toFixed(2)}s …`,
        );
        const blob = await this.recordSegment(video, start, len);
        onLine(`${prefix}  → ${(blob.size / 1024).toFixed(0)} KiB, uploading …`);
        onLine(
          `${prefix}  → ` +
            (i === 0
              ? 'waiting for ai-vision (chunk 1: cold load + ffmpeg + inference can take minutes)…'
              : 'waiting for inference…'),
        );

        const res = await firstValueFrom(
          this.gateway.predictUpload(blob, `chunk-${i}.webm`, cameraCode),
        );
        const summary = this.formatResponse(start, len, res);
        onLine(`${prefix}  ← ${summary}`);
        console.info(`[3s-chunk-ai] chunk ${i + 1}/${totalChunks} done`, summary);

        this.emitDetectionIfNeeded(start, len, res, opts, summary);

        onChunkDone?.(i, totalChunks, summary);
      }
    } finally {
      video.pause();
      video.removeAttribute('src');
      video.load();
    }
  }

  private emitDetectionIfNeeded(
    startSec: number,
    lenSec: number,
    res: PredictUploadResponse,
    opts: ChunkAnalysisOptions | undefined,
    summary: string,
  ): void {
    if (!opts?.onDetection || !opts.cameraCode) {
      return;
    }
    const cameraId = opts.cameraId?.trim() || opts.cameraCode;
    if (isFireResponse(res)) {
      const hit = res.results?.some((r) => r.fire_detected) ?? false;
      if (hit) {
        opts.onDetection({
          kind: 'fire',
          cameraId,
          cameraCode: opts.cameraCode,
          startSec,
          endSec: startSec + lenSec,
          summary,
          response: res,
        });
      }
      return;
    }
    const r0 = (res as ViolencePredictResponse).results?.[0];
    if (r0?.prediction === 'Violent') {
      opts.onDetection({
        kind: 'violence',
        cameraId,
        cameraCode: opts.cameraCode,
        startSec,
        endSec: startSec + lenSec,
        summary,
        response: res,
      });
    }
  }

  private formatResponse(
    startSec: number,
    lenSec: number,
    res: PredictUploadResponse,
  ): string {
    const range = `${startSec.toFixed(1)}s–${(startSec + lenSec).toFixed(1)}s`;
    if (res.mock) {
      return `${range} mock=true ${JSON.stringify(res)}`;
    }
    if (isFireResponse(res)) {
      const rows = res.results ?? [];
      const anyFire = rows.some((r) => r.fire_detected);
      const maxC = Math.max(0, ...rows.map((r) => r.max_fire_confidence ?? 0));
      return `${range} fire=${anyFire ? 'YES' : 'no'} · max_conf=${maxC.toFixed(3)}`;
    }
    const r0 = (res as ViolencePredictResponse).results?.[0];
    if (!r0) {
      return `${range} ${JSON.stringify(res)}`;
    }
    return `${range} ${r0.prediction} · violent=${r0.violent_probability} non-violent=${r0.non_violent_probability}`;
  }

  private recordSegment(
    video: HTMLVideoElement,
    startSec: number,
    durationSec: number,
  ): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const mime = pickRecorderMime();
      if (!mime) {
        reject(
          new Error(
            'No supported WebM MediaRecorder profile (use Chromium or Firefox)',
          ),
        );
        return;
      }

      void (async () => {
        try {
          video.pause();
          video.currentTime = startSec;
          await waitSeeked(video);

          const stream = captureStreamFromVideo(video);
          const rec = new MediaRecorder(stream, { mimeType: mime });
          const chunks: Blob[] = [];
          rec.ondataavailable = (ev) => {
            if (ev.data.size) {
              chunks.push(ev.data);
            }
          };

          rec.start(200);
          await video.play();
          await new Promise((r) => setTimeout(r, 80));

          await new Promise((r) => setTimeout(r, durationSec * 1000));

          if (rec.state === 'recording') {
            rec.requestData();
          }
          rec.stop();
          await new Promise<void>((res, rej) => {
            rec.onstop = () => res();
            rec.onerror = () => rej(new Error('MediaRecorder stopped with error'));
          });

          video.pause();

          const out = new Blob(chunks, {
            type: rec.mimeType || 'video/webm',
          });
          if (!out.size) {
            reject(
              new Error(
                'Recorded 0 bytes — captureStream may be unsupported for this asset',
              ),
            );
            return;
          }
          resolve(out);
        } catch (e) {
          reject(e instanceof Error ? e : new Error(String(e)));
        }
      })();
    });
  }
}
