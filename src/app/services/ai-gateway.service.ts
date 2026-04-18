import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export interface GatewayHealth {
  ok: boolean;
  postgrest: string;
  ai_vision_configured: boolean;
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
}
