import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

import { ActivatedRoute, Router } from '@angular/router';

/** Wide-angle "scanning" view vs. picture-in-picture focus on a feed. */
type ViewMode = 'grid' | 'focus';

import { AlertCardComponent } from '../../components/alert-card/alert-card.component';
import { CameraFeedComponent } from '../../components/camera-feed/camera-feed.component';
import { GuestReportsComponent } from '../../components/guest-reports/guest-reports.component';
import { PulseMonitorComponent } from '../../components/pulse-monitor/pulse-monitor.component';
import { ToastComponent } from '../../components/toast/toast.component';
import { AlertsService } from '../../services/alerts.service';
import { BoundingBox, CameraFeed } from '../../models/venue.models';

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

            <button
              type="button"
              class="flex items-center gap-1.5 px-3 h-9 rounded-lg bg-primary text-on-primary text-xs font-semibold hover:brightness-110 transition-all"
            >
              <span class="material-symbols-outlined text-[16px]">add</span>
              Add camera
            </button>
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
                    <img
                      [src]="camera.imageUrl"
                      [alt]="camera.label + ' thumbnail'"
                      class="w-full h-full object-cover"
                      loading="lazy"
                    />
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
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

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
    return this.alerts.boundingBoxesByCamera().get(cameraId) ?? [];
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
