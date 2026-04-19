import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { timeout } from 'rxjs/operators';

export interface GatewayHealth {
  ok: boolean;
  postgrest: string;
  ai_vision_configured: boolean;
  /** Present after gateway upgrade: GET /health probes ai-vision. */
  ai_vision_url?: string | null;
  ai_vision_ping?: number | string | null;
  analysis_interval_sec: number;
}

export interface GatewayDetectionEntry {
  camera_code: string;
  at?: string;
  violence?: unknown;
  error?: string;
}

export interface GatewayDetectionsResponse {
  cameras: Record<string, GatewayDetectionEntry>;
}

/** Response from `/predict-video/` / `/predict-upload` (violence classifier). */
export interface ViolencePredictResponse {
  mock?: boolean;
  filename?: string;
  results?: Array<{
    start_time: number;
    end_time: number;
    violent_probability: number;
    non_violent_probability: number;
    prediction: string;
  }>;
}

@Injectable({ providedIn: 'root' })
export class AiGatewayService {
  private readonly http = inject(HttpClient);
  private readonly base = '/gateway';

  getHealth(): Observable<GatewayHealth> {
    return this.http.get<GatewayHealth>(`${this.base}/health`);
  }

  getDetections(): Observable<GatewayDetectionsResponse> {
    return this.http.get<GatewayDetectionsResponse>(`${this.base}/detections`);
  }

  analyzeCamera(cameraId: string): Observable<GatewayDetectionEntry> {
    return this.http.post<GatewayDetectionEntry>(
      `${this.base}/analyze/${cameraId}`,
      {},
    );
  }

  analyzeAll(): Observable<GatewayDetectionsResponse> {
    return this.http.post<GatewayDetectionsResponse>(
      `${this.base}/analyze-all`,
      {},
    );
  }

  /** Upload a short clip (e.g. 3s WebM from MediaRecorder) to the vision model. */
  predictUpload(blob: Blob, filename: string): Observable<ViolencePredictResponse> {
    const body = new FormData();
    body.append('file', blob, filename);
    // First request can block on HF download + model load + CPU decode/inference for many minutes.
    return this.http
      .post<ViolencePredictResponse>(`${this.base}/predict-upload`, body)
      .pipe(timeout({ first: 25 * 60 * 1000 }));
  }
}
