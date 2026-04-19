import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, Observer } from 'rxjs';
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

export interface RealtimeAnalysisResult {
  camera_code: string;
  timestamp: string;
  chunk_size: number;
  result: unknown;
  error?: string;
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

  /** Real-time analysis via WebSocket: sends video chunks and receives immediate results. */
  analyzeRealtime(cameraCode: string): { observable: Observable<RealtimeAnalysisResult>, websocket: Promise<WebSocket> } {
    return {
      observable: this.createRealtimeObservable(cameraCode),
      websocket: this.createWebSocket(cameraCode)
    };
  }

  private createRealtimeObservable(cameraCode: string): Observable<RealtimeAnalysisResult> {
    return new Observable((observer: Observer<RealtimeAnalysisResult>) => {
      this.createWebSocket(cameraCode).then((ws) => {
        ws.onmessage = (event) => {
          try {
            const data: RealtimeAnalysisResult = JSON.parse(event.data);
            observer.next(data);
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        };
        
        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          observer.error(error);
        };
        
        ws.onclose = () => {
          console.log(`WebSocket closed for camera ${cameraCode}`);
          observer.complete();
        };
        
        // Return cleanup function
        return () => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.close();
          }
        };
      }).catch((error) => {
        observer.error(error);
      });
    });
  }

  private createWebSocket(cameraCode: string): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}${this.base}/analyze-realtime/${cameraCode}`;
      
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        console.log(`WebSocket connected for camera ${cameraCode}`);
        resolve(ws);
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket connection error:', error);
        reject(error);
      };
    });
  }

  /** Send video chunk data to real-time analysis WebSocket. */
  sendVideoChunk(ws: WebSocket, chunkData: ArrayBuffer): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(chunkData);
    } else {
      console.warn('WebSocket not open, cannot send chunk');
    }
  }
}
