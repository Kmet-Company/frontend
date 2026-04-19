import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { timeout } from 'rxjs/operators';

export interface GatewayCapabilities {
  violence: boolean;
  fire: boolean;
}

export interface GatewayHealth {
  ok: boolean;
  postgrest: string;
  ai_vision_configured: boolean;
  analysis_interval_sec: number;
  ai_vision_url?: string | null;
  ai_vision_ping?: number | string | null;
  ai_fire_configured?: boolean;
  ai_fire_url?: string | null;
  ai_fire_ping?: number | string | null;
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

export interface FirePredictResponse {
  mock?: boolean;
  filename?: string;
  results?: Array<{
    start_time: number;
    end_time: number;
    fire_detected: boolean;
    max_fire_confidence: number;
    frames_scored: number;
  }>;
}

@Injectable({ providedIn: 'root' })
export class AiGatewayService {
  private readonly http = inject(HttpClient);
  private readonly base = '/gateway';

  getHealth(): Observable<GatewayHealth> {
    return this.http.get<GatewayHealth>(`${this.base}/health`);
  }

  getCapabilities(): Observable<GatewayCapabilities> {
    return this.http.get<GatewayCapabilities>(`${this.base}/capabilities`);
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

  /** Short clip (e.g. 3s WebM) → VideoMAE violence classifier via gateway. */
  predictUpload(blob: Blob, filename: string): Observable<ViolencePredictResponse> {
    const body = new FormData();
    body.append('file', blob, filename);
    return this.http
      .post<ViolencePredictResponse>(`${this.base}/predict-upload`, body)
      .pipe(timeout({ first: 25 * 60 * 1000 }));
  }

  /** Same clip → YOLO fire detector via gateway (mock if AI_FIRE_URL unset). */
  predictFireUpload(blob: Blob, filename: string): Observable<FirePredictResponse> {
    const body = new FormData();
    body.append('file', blob, filename);
    return this.http
      .post<FirePredictResponse>(`${this.base}/predict-fire-upload`, body)
      .pipe(timeout({ first: 25 * 60 * 1000 }));
  }
}
