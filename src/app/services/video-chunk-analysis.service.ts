import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import {
  AiGatewayService,
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

/**
 * Records the &lt;video&gt; timeline in fixed wall-clock slices via MediaRecorder
 * and POSTs each blob to the gateway → vision model.
 */
@Injectable({ providedIn: 'root' })
export class VideoChunkAnalysisService {
  private readonly gateway = inject(AiGatewayService);

  readonly chunkSeconds = 3;

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
        `Source ${duration.toFixed(1)}s → ${totalChunks} chunk(s) × ${this.chunkSeconds}s (hidden <video> + MediaRecorder → POST /gateway/predict-upload → model)`,
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
        onLine(`  → ${(blob.size / 1024).toFixed(0)} KiB, uploading …`);
        onLine(
          i === 0
            ? '  → waiting for vision service (chunk 1 often includes Hugging Face download + model load + ffmpeg + CPU inference; can take many minutes — check ai-vision logs)…'
            : '  → waiting for inference (CPU; each chunk can take a while)…',
        );

        const res = await firstValueFrom(
          this.gateway.predictUpload(blob, `chunk-${i}.webm`),
        );
        const summary = this.formatResponse(start, len, res);
        onLine(`  ← ${summary}`);
        console.info(`[3s-chunk-ai] chunk ${i + 1}/${totalChunks} done`, summary);
        onChunkDone?.(i, totalChunks, summary);
      }
    } finally {
      video.pause();
      video.removeAttribute('src');
      video.load();
    }
  }

  private formatResponse(
    startSec: number,
    lenSec: number,
    res: ViolencePredictResponse,
  ): string {
    const range = `${startSec.toFixed(1)}s–${(startSec + lenSec).toFixed(1)}s`;
    if (res.mock) {
      return `${range} mock=true ${JSON.stringify(res)}`;
    }
    const r0 = res.results?.[0];
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
