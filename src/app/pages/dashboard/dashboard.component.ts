import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, EMPTY, map } from 'rxjs';

import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
/** Wide-angle "scanning" view vs. picture-in-picture focus on a feed. */
type ViewMode = 'grid' | 'focus';

import { AlertCardComponent } from '../../components/alert-card/alert-card.component';
import { CameraFeedComponent } from '../../components/camera-feed/camera-feed.component';
import { GuestReportsComponent } from '../../components/guest-reports/guest-reports.component';
import { PulseMonitorComponent } from '../../components/pulse-monitor/pulse-monitor.component';
import { ToastComponent } from '../../components/toast/toast.component';
import { AlertsService } from '../../services/alerts.service';
import { AiGatewayService } from '../../services/ai-gateway.service';
import { FireDetectionService } from '../../services/fire-detection.service';
import { ViolenceDetectionService } from '../../services/violence-detection.service';
import { BoundingBox, CameraFeed } from '../../models/venue.models';
import { resolveCameraVideoUrl } from '../../utils/camera-default-video';
import { VideoChunkAnalysisService, toAbsoluteVideoUrl, captureStreamFromVideo } from '../../services/video-chunk-analysis.service';

@Component({
  selector: 'va-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CameraFeedComponent,
    AlertCardComponent,
    GuestReportsComponent,
    PulseMonitorComponent,
    ToastComponent,
  ],
  template: `
    <div class="h-full flex flex-col lg:flex-row overflow-hidden">
      <!-- LEFT: Camera stage + pulse -->
      <section class="flex-[3] p-3 overflow-y-auto space-y-5 bg-surface">
        <header class="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 class="text-2xl font-bold tracking-tightest text-on-surface">
              Live Surveillance
            </h1>
            <p class="text-sm text-on-surface-variant mt-0.5">
              {{ activeCameraLabel() }} · {{ alerts.cameras().length }} feeds online
            </p>
          </div>

          <div class="flex items-center gap-2">
            <div
              class="flex items-center gap-1.5 px-3 h-9 rounded-lg bg-surface-container text-xs"
            >
              <span class="w-2 h-2 rounded-full bg-error animate-soft-pulse"></span>
              <span
                class="font-semibold tracking-wider uppercase text-on-surface-variant"
                >Live Stream</span
              >
            </div>

            <button
              type="button"
              (click)="analyzeSelected()"
              class="hidden sm:inline-flex items-center gap-1.5 px-2.5 h-9 rounded-lg bg-surface-container text-on-surface text-xs font-semibold hover:bg-surface-container-high transition-colors"
              title="Run violence classifier on the selected camera clip (gateway downloads the configured MP4)"
            >
              <span class="material-symbols-outlined text-[16px]">psychology</span>
              <span>Analyze</span>
            </button>

            <button
              type="button"
              (click)="analyzeAll()"
              class="hidden lg:inline-flex items-center gap-1.5 px-2.5 h-9 rounded-lg bg-surface-container text-on-surface text-xs font-semibold hover:bg-surface-container-high transition-colors"
              title="Analyze every camera with a video_url"
            >
              <span class="material-symbols-outlined text-[16px]">hub</span>
              <span>All</span>
            </button>

            <button
              type="button"
              (click)="analyzeChunksFromBrowser()"
              [disabled]="chunkAnalyzing()"
              class="inline-flex items-center gap-1.5 px-2.5 h-9 rounded-lg bg-secondary-container text-on-secondary-container text-xs font-semibold hover:brightness-95 disabled:opacity-50 transition-colors"
              title="Run now (also resets auto-run lock for this camera)"
            >
              <span class="material-symbols-outlined text-[16px]">movie_edit</span>
              <span>3s → AI</span>
            </button>

            <!-- View mode toggle -->
            <div
              class="flex items-center gap-0.5 p-0.5 rounded-lg bg-surface-container"
              role="group"
              aria-label="Camera view mode"
            >
              <button
                type="button"
                (click)="setMode('grid')"
                [class]="modeButtonClass('grid')"
                title="Grid view"
              >
                <span class="material-symbols-outlined text-[16px]">grid_view</span>
                <span class="hidden sm:inline">Grid</span>
              </button>
              <button
                type="button"
                (click)="setMode('focus')"
                [class]="modeButtonClass('focus')"
                title="Focus view"
              >
                <span class="material-symbols-outlined text-[16px]">fullscreen</span>
                <span class="hidden sm:inline">Focus</span>
              </button>
            </div>
          </div>
        </header>

        @if (mode() === 'grid') {
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in">
            @for (camera of alerts.cameras(); track camera.id) {
              <va-camera-feed
                [camera]="camera"
                [hasAlert]="alerts.activeAlertCameras().has(camera.id)"
                [isSelected]="alerts.selectedCameraId() === camera.id"
                [boxes]="boxesFor(camera.id)"
                (select)="onCameraClick($event)"
              />
            }
          </div>
        } @else {
          <!-- Focus mode: big stage + thumbnail strip -->
          <div class="flex flex-col gap-3 animate-fade-in">
            @if (focusedCamera(); as focus) {
              <div class="relative">
                <!-- In focus view the big feed is intrinsically "the one you're
                     viewing", so we suppress the blue selection overlay that
                     we show in grid view. -->
                <va-camera-feed
                  [camera]="focus"
                  [hasAlert]="alerts.activeAlertCameras().has(focus.id)"
                  [isSelected]="false"
                  [boxes]="boxesFor(focus.id)"
                  (select)="onCameraClick($event)"
                />

                <!-- Focus-mode chrome -->
                <div
                  class="absolute top-3 right-3 flex items-center gap-2"
                >
                  <button
                    type="button"
                    (click)="analyzeChunksFromBrowser(); $event.stopPropagation()"
                    [disabled]="chunkAnalyzing()"
                    class="inline-flex items-center gap-1.5 px-2.5 h-8 rounded-lg bg-secondary-container/95 backdrop-blur text-on-secondary-container text-[11px] font-semibold hover:brightness-95 disabled:opacity-50 transition-colors"
                    title="Same as header 3s → AI"
                  >
                    <span class="material-symbols-outlined text-[14px]">movie_edit</span>
                    3s → AI
                  </button>
                  <button
                    type="button"
                    (click)="setMode('grid'); $event.stopPropagation()"
                    class="inline-flex items-center gap-1.5 px-2.5 h-8 rounded-lg bg-surface-container/85 backdrop-blur text-on-surface text-[11px] font-semibold hover:bg-surface-container-high transition-colors"
                    title="Back to grid"
                  >
                    <span class="material-symbols-outlined text-[14px]">grid_view</span>
                    Exit focus
                  </button>
                </div>
              </div>

              <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                @for (camera of alerts.cameras(); track camera.id) {
                  <button
                    type="button"
                    (click)="onCameraClick(camera.id)"
                    [class]="thumbnailClass(camera)"
                  >
                    <video
                      [src]="thumbVideoSrc(camera)"
                      [poster]="camera.imageUrl"
                      class="w-full h-full object-cover pointer-events-none"
                      muted
                      loop
                      playsinline
                      preload="metadata"
                      autoplay
                    ></video>
                    <div
                      class="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent"
                    ></div>
                    <div
                      class="absolute bottom-1.5 left-2 right-2 flex items-center justify-between gap-2"
                    >
                      <div
                        class="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-on-surface truncate"
                      >
                        <span class="material-symbols-outlined text-[12px]">{{
                          camera.icon
                        }}</span>
                        <span class="truncate">{{ camera.label }}</span>
                      </div>
                      @if (alerts.activeAlertCameras().has(camera.id)) {
                        <span
                          class="w-1.5 h-1.5 rounded-full bg-error animate-soft-pulse flex-shrink-0"
                        ></span>
                      }
                    </div>
                  </button>
                }
              </div>
            }
          </div>
        }

        @if (mode() === 'grid') {
          <div class="pt-2">
            <va-pulse-monitor />
          </div>
        }
      </section>

      <!-- RIGHT: Alerts + Guest Reports -->
      <aside
        class="flex-[1.4] min-w-[340px] bg-surface-container-low flex flex-col overflow-hidden"
      >
        <div class="flex-1 overflow-y-auto px-5 pt-5 pb-5 flex flex-col gap-6">
          <!-- Active alerts section (AI + staff detections) -->
          <section class="flex flex-col gap-3">
            <div>
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <span
                    class="material-symbols-outlined text-[18px] text-on-surface-variant"
                    >sensors</span
                  >
                  <h2 class="text-base font-bold tracking-tight text-on-surface">
                    Active Alerts
                  </h2>
                </div>
                @if (alerts.criticalAlertCount() > 0) {
                  <span class="chip bg-error-container text-on-error-container">
                    {{ alerts.criticalAlertCount() }} Critical
                  </span>
                } @else {
                  <span class="chip bg-primary-container text-on-primary-container">
                    All clear
                  </span>
                }
              </div>
              <p class="text-xs text-on-surface-variant mt-1">
                Review detected incidents and coordinate with your floor team.
              </p>
            </div>

            <!--
              Panel caps around the height of ~3 cards; anything past that
              scrolls inside the panel so the overall page never grows. The
              small pl-1/pr-2/py-1 padding gives breathing room for selected
              cards' ring-offset, which would otherwise clip against the
              scroll container's edges.
            -->
            <div
              class="flex flex-col gap-4 max-h-[28rem] overflow-y-auto pl-1 pr-2 py-1"
            >
              @if (alerts.alerts().length === 0) {
                <div
                  class="bg-surface-container-high rounded-xl p-6 text-center text-sm text-on-surface-variant"
                >
                  <span class="material-symbols-outlined text-3xl text-primary"
                    >task_alt</span
                  >
                  <div class="mt-2 font-semibold text-on-surface">
                    No active alerts
                  </div>
                  <div class="text-xs mt-1">
                    Your floor team has handled everything for now.
                  </div>
                </div>
              }

              @for (alert of alerts.alerts(); track alert.id) {
                <va-alert-card
                  [alert]="alert"
                  [isSelected]="alerts.selectedCameraId() === alert.cameraId"
                />
              }
            </div>
          </section>

          <!-- Divider between AI alerts and guest reports -->
          <div class="h-px bg-outline-variant/40"></div>

          <!-- Guest reports from mobile app -->
          <va-guest-reports />
        </div>
      </aside>

      <va-toast />
    </div>
  `,
})
export class DashboardComponent {
  protected readonly alerts = inject(AlertsService);
  private readonly gateway = inject(AiGatewayService);
  private readonly chunkAnalysis = inject(VideoChunkAnalysisService);
  private readonly fireDetection = inject(FireDetectionService);
  private readonly violenceDetection = inject(ViolenceDetectionService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  /** Log lines from hidden video → 3s MediaRecorder → `/gateway/predict-upload`. */
  protected readonly chunkLogLines = signal<string[]>([]);
  protected readonly chunkAnalyzing = signal(false);
  protected readonly chunkLogText = computed(() =>
    this.chunkLogLines().join('\n'),
  );
  /** Current chunk index (1-based), total, and last model summary line. */
  protected readonly chunkProgress = signal<{
    current: number;
    total: number;
    last: string;
  } | null>(null);
  protected readonly chunkStepSec = computed(
    () => this.chunkAnalysis.chunkSeconds,
  );

  /**
   * When true, run the 3s chunk pipeline once after camera selection
   * (debounced). Default false now — continuous violence detection on
   * `cam-main` is owned by {@link ViolenceDetectionService}, so the old
   * auto-run-on-selection would just duplicate work. The toggle still
   * exists in the UI for manual ad-hoc runs on any camera.
   */
  protected readonly chunkAutoEnabled = signal(false);
  /** Prevents repeat auto-runs for the same selected camera until selection changes. */
  private readonly autoChunkDoneForId = signal<string | null>(null);

  /** View mode lives on the service so the top-bar logo can reset it. */
  protected readonly mode = this.alerts.viewMode;

  /**
   * Reads `?focus=<cameraId>` from the URL as a signal. Using a direct
   * ActivatedRoute subscription (rather than `withComponentInputBinding`)
   * because input-binding only updates on route-path navigations, not on
   * same-route query-param changes.
   * This is the single source of truth for focus/grid state, so browser
   * Back naturally exits focus mode.
   */
  private readonly focusId = toSignal(
    this.route.queryParamMap.pipe(map((p) => p.get('focus'))),
    { initialValue: null as string | null },
  );

  constructor() {
    effect(
      () => {
        const focusId = this.focusId();
        if (focusId) {
          this.alerts.selectCamera(focusId);
          this.alerts.setViewMode('focus');
        } else {
          this.alerts.clearCameraSelection();
          this.alerts.setViewMode('grid');
        }
      },
      // We're intentionally driving AlertsService state from the URL here,
      // so signal writes inside this effect are expected.
      { allowSignalWrites: true },
    );

    effect(
      () => {
        this.alerts.selectedCameraId();
        this.autoChunkDoneForId.set(null);
      },
      { allowSignalWrites: true },
    );

    effect(
      (onCleanup) => {
        if (!this.chunkAutoEnabled()) {
          return;
        }
        const sel = this.alerts.selectedCameraId();
        const cams = this.alerts.cameras();
        if (!sel || cams.length === 0) {
          return;
        }
        if (this.autoChunkDoneForId() === sel) {
          return;
        }
        if (this.chunkAnalyzing()) {
          return;
        }

        const handle = window.setTimeout(() => {
          if (!this.chunkAutoEnabled()) {
            return;
          }
          if (this.alerts.selectedCameraId() !== sel) {
            return;
          }
          if (this.chunkAnalyzing()) {
            return;
          }
          void this.runChunkAnalysis(sel, { auto: true });
        }, 2200);

        onCleanup(() => window.clearTimeout(handle));
      },
      { allowSignalWrites: true },
    );

    // Live model loops. Both services are idempotent on every camera-list
    // update and internally whitelist which camera IDs they care about
    // (fire → cam-entrance only, violence → cam-main only), so other feeds
    // aren't analysed at all. No cleanup needed here — the services are
    // root-scoped and survive route changes.
    effect(() => {
      const cams = this.alerts.cameras();
      if (cams.length > 0) {
        this.fireDetection.start(cams);
        this.violenceDetection.start(cams);
      }
    });
  }

  protected toggleChunkAuto(): void {
    this.chunkAutoEnabled.update((on) => {
      const next = !on;
      if (next) {
        this.autoChunkDoneForId.set(null);
      }
      return next;
    });
  }

  protected readonly activeCameraLabel = computed(() => {
    const selected = this.alerts.selectedCameraId();
    return (
      this.alerts.cameras().find((c) => c.id === selected)?.label ?? 'No camera'
    );
  });

  protected readonly focusedCamera = computed<CameraFeed | undefined>(() => {
    const id = this.alerts.selectedCameraId();
    return this.alerts.cameras().find((c) => c.id === id);
  });

  protected boxesFor(cameraId: string): BoundingBox[] {
    // Merge statically-defined incident boxes (from the alerts service) with
    // live YOLO fire boxes (from the fire detection service). Fire boxes
    // are listed second so they render on top of any incident overlay.
    const incidentBoxes =
      this.alerts.boundingBoxesByCamera().get(cameraId) ?? [];
    const fireBoxes = this.fireDetection.boxesByCamera()[cameraId] ?? [];
    if (fireBoxes.length === 0) return incidentBoxes;
    return [...incidentBoxes, ...fireBoxes];
  }

  protected thumbVideoSrc(camera: CameraFeed): string {
    return resolveCameraVideoUrl(camera);
  }

  protected setMode(mode: ViewMode): void {
    if (mode === 'focus') {
      // Entering focus mode without a selection would leave us staring at an
      // empty panel — default to the first feed so "Focus" is always useful.
      const id =
        this.alerts.selectedCameraId() ?? this.alerts.cameras()[0]?.id;
      if (!id) return;
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { focus: id },
      });
    } else {
      // Drop the focus query param so back/forward history treats grid as a
      // distinct state.
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: {},
      });
    }
  }

  protected onCameraClick(cameraId: string): void {
    // If we're already in focus mode and the operator picks a different
    // thumbnail, replace the URL so Back doesn't walk through every feed.
    const replaceUrl = this.mode() === 'focus';
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { focus: cameraId },
      replaceUrl,
    });
  }

  protected modeButtonClass(mode: ViewMode): string {
    const base =
      'inline-flex items-center gap-1.5 px-2.5 h-8 rounded-md text-xs font-semibold transition-colors';
    return mode === this.mode()
      ? `${base} bg-surface-bright text-on-surface`
      : `${base} text-on-surface-variant hover:text-on-surface`;
  }

  protected analyzeSelected(): void {
    const id =
      this.alerts.selectedCameraId() ?? this.alerts.cameras()[0]?.id;
    if (!id) {
      this.alerts.showToast('No camera available');
      return;
    }
    this.gateway
      .analyzeCamera(id)
      .pipe(
        catchError(() => {
          this.alerts.showToast('AI analysis failed');
          return EMPTY;
        }),
      )
      .subscribe(() => {
        this.alerts.showToast(`AI analysis finished for ${id}`);
      });
  }

  protected analyzeAll(): void {
    this.gateway
      .analyzeAll()
      .pipe(
        catchError(() => {
          this.alerts.showToast('AI batch analysis failed');
          return EMPTY;
        }),
      )
      .subscribe(() => {
        this.alerts.showToast('AI analysis finished for all cameras');
      });
  }

  /** Manual run: real-time analysis with WebSocket streaming. */
  protected analyzeChunksFromBrowser(): void {
    const id =
      this.alerts.selectedCameraId() ?? this.alerts.cameras()[0]?.id;
    if (!id) {
      this.alerts.showToast('No camera');
      return;
    }
    void this.runRealtimeChunkAnalysis(id, { force: true });
  }

  /**
   * Records ~3s WebM slices from a hidden player and POSTs each to
   * `/gateway/predict-upload`.
   */
  private runChunkAnalysis(
    cameraId: string,
    opts: { auto?: boolean; force?: boolean },
  ): Promise<void> {
    if (this.chunkAnalyzing()) {
      return Promise.resolve();
    }
    if (opts.auto && this.autoChunkDoneForId() === cameraId) {
      return Promise.resolve();
    }
    const cam = this.alerts.cameras().find((c) => c.id === cameraId);
    if (!cam) {
      if (!opts.auto) {
        this.alerts.showToast('No camera');
      }
      return Promise.resolve();
    }
    if (opts.force) {
      this.autoChunkDoneForId.set(null);
    }

    const url = resolveCameraVideoUrl(cam);
    this.chunkLogLines.set([]);
    this.chunkProgress.set(null);
    this.chunkAnalyzing.set(true);
    if (!opts.auto) {
      this.alerts.showToast(
        `${cam.label}: 3s chunking started. Watch the log panel below.`,
      );
    }

    return this.chunkAnalysis
      .analyzeUrlInThreeSecondChunks(
        url,
        (line) => {
          this.chunkLogLines.update((lines) => [...lines, line]);
        },
        (index, total, summary) => {
          this.chunkProgress.set({
            current: index + 1,
            total,
            last: summary,
          });
        },
      )
      .then(() => {
        this.chunkAnalyzing.set(false);
        this.autoChunkDoneForId.set(cameraId);
        if (!opts.auto) {
          this.alerts.showToast(`${cam.label}: 3s chunk analysis finished`);
        }
      })
      .catch((err: unknown) => {
        this.chunkAnalyzing.set(false);
        this.chunkProgress.set(null);
        this.autoChunkDoneForId.set(cameraId);
        let msg = err instanceof Error ? err.message : String(err);
        if (err instanceof HttpErrorResponse) {
          const body = err.error;
          if (body !== undefined && body !== null) {
            msg =
              typeof body === 'string'
                ? body
                : JSON.stringify(body).slice(0, 800);
          } else {
            msg = `${msg} (HTTP ${err.status})`;
          }
        }
        this.chunkLogLines.update((lines) => [...lines, `Error: ${msg}`]);
        this.alerts.showToast(
          opts.auto
            ? `Auto 3s chunks failed: ${msg.slice(0, 120)}`
            : `3s chunk analysis failed: ${msg.slice(0, 120)}`,
        );
      });
  }

  /**
   * Real-time analysis: Records ~3s WebM slices and sends via WebSocket
   * to get immediate results from the AI models.
   */
  private runRealtimeChunkAnalysis(
    cameraId: string,
    opts: { auto?: boolean; force?: boolean },
  ): Promise<void> {
    if (this.chunkAnalyzing()) {
      return Promise.resolve();
    }
    if (opts.auto && this.autoChunkDoneForId() === cameraId) {
      return Promise.resolve();
    }
    const cam = this.alerts.cameras().find((c) => c.id === cameraId);
    if (!cam) {
      if (!opts.auto) {
        this.alerts.showToast('No camera');
      }
      return Promise.resolve();
    }
    if (opts.force) {
      this.autoChunkDoneForId.set(null);
    }

    const url = resolveCameraVideoUrl(cam);
    this.chunkLogLines.set([]);
    this.chunkProgress.set(null);
    this.chunkAnalyzing.set(true);
    if (!opts.auto) {
      this.alerts.showToast(
        `${cam.label}: Real-time 3s chunking started. Watch the log panel below.`,
      );
    }

    return this.runRealtimeAnalysis(url, cam.id, (line) => {
      this.chunkLogLines.update((lines) => [...lines, line]);
    });
  }

  private runRealtimeAnalysis(
    videoUrl: string,
    cameraCode: string,
    onLine: (line: string) => void,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const abs = toAbsoluteVideoUrl(videoUrl);
      const video = document.createElement('video');
      video.crossOrigin = 'anonymous';
      video.muted = true;
      video.playsInline = true;
      video.preload = 'auto';
      video.src = abs;

      let websocket: WebSocket | null = null;
      let subscription: any = null;

      const cleanup = () => {
        if (subscription) {
          subscription.unsubscribe();
        }
        if (websocket && websocket.readyState === WebSocket.OPEN) {
          websocket.close();
        }
        video.remove();
        this.chunkAnalyzing.set(false);
      };

      video.onloadedmetadata = () => {
        const duration = Number.isFinite(video.duration) ? video.duration : 0;
        if (duration <= 0) {
          cleanup();
          reject(new Error('Video duration is not available'));
          return;
        }

        const totalChunks = Math.max(1, Math.ceil(duration / 3));
        onLine(
          `Real-time analysis: ${duration.toFixed(1)}s → ${totalChunks} chunk(s) × 3s (WebSocket streaming)`,
        );

        // Start WebSocket connection
        const realtimeConnection = this.gateway.analyzeRealtime(cameraCode);
        
        subscription = realtimeConnection.observable.subscribe({
          next: (result: any) => {
            if (result.error) {
              onLine(`ERROR: ${result.error}`);
            } else {
              const summary = this.formatRealtimeResult(result);
              onLine(`[${result.timestamp}] ${summary}`);
            }
          },
          error: (error) => {
            onLine(`WebSocket error: ${error}`);
            cleanup();
            reject(error);
          },
          complete: () => {
            onLine('Real-time analysis completed');
            cleanup();
            resolve();
          }
        });

        // Get the WebSocket instance and start recording
        realtimeConnection.websocket.then((ws) => {
          websocket = ws;
          // Start recording chunks
          this.recordAndSendChunks(video, websocket, totalChunks, onLine, () => {
            // All chunks sent, close WebSocket after a delay
            setTimeout(() => {
              if (websocket && websocket.readyState === WebSocket.OPEN) {
                websocket.close();
              }
            }, 1000);
          });
        });
      };

      video.onerror = () => {
        cleanup();
        reject(new Error('Failed to load video'));
      };
    });
  }

  private recordAndSendChunks(
    video: HTMLVideoElement,
    websocket: WebSocket | null,
    totalChunks: number,
    onLine: (line: string) => void,
    onComplete: () => void,
  ): void {
    let currentChunk = 0;

    const recordNextChunk = () => {
      if (currentChunk >= totalChunks) {
        onComplete();
        return;
      }

      const startTime = currentChunk * 3;
      const chunkDuration = Math.min(3, video.duration - startTime);

      video.currentTime = startTime;

      const chunks: Blob[] = [];
      const mediaRecorder = new MediaRecorder(captureStreamFromVideo(video));

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        blob.arrayBuffer().then((buffer) => {
          if (websocket && websocket.readyState === WebSocket.OPEN) {
            this.gateway.sendVideoChunk(websocket, buffer);
            onLine(`Sent chunk ${currentChunk + 1}/${totalChunks} (${blob.size} bytes)`);
          }
        });

        currentChunk++;
        // Small delay before next chunk
        setTimeout(recordNextChunk, 100);
      };

      // Start recording
      mediaRecorder.start();

      // Stop after chunk duration
      setTimeout(() => {
        mediaRecorder.stop();
      }, chunkDuration * 1000);
    };

    // Wait for video to be ready
    video.onseeked = () => {
      recordNextChunk();
    };
  }

  private formatRealtimeResult(result: any): string {
    if (result.result?.results) {
      // Violence detection result
      const r = result.result.results[0];
      if (r) {
        return `Violence: ${r.prediction} (${(r.violent_probability * 100).toFixed(1)}% violent)`;
      }
    } else if (result.result?.results) {
      // Fire detection result
      const r = result.result.results[0];
      if (r) {
        return `Fire: ${r.fire_detected ? 'DETECTED' : 'None'} (${r.max_fire_confidence?.toFixed(2) || 0} confidence)`;
      }
    }
    return `Result: ${JSON.stringify(result.result)}`;
  }

  protected thumbnailClass(camera: CameraFeed): string {
    const base =
      'relative aspect-video rounded-lg overflow-hidden transition-all duration-150 focus:outline-none';
    const selected = this.alerts.selectedCameraId() === camera.id;
    const alerting = this.alerts.activeAlertCameras().has(camera.id);

    if (selected) {
      return `${base} ring-2 ring-primary ring-offset-2 ring-offset-background`;
    }
    if (alerting) {
      return `${base} ring-1 ring-error/70 opacity-85 hover:opacity-100`;
    }
    return `${base} opacity-70 hover:opacity-100 hover:ring-1 hover:ring-outline-variant/50`;
  }
}
