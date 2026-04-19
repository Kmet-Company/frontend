import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { AlertsService } from '../../services/alerts.service';
import { AuthService } from '../../services/auth.service';
import { VenueAlert } from '../../models/venue.models';

@Component({
  selector: 'va-top-bar',
  standalone: true,
  imports: [DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header
      class="w-full sticky top-0 z-40 bg-surface-container flex justify-between items-center px-6 h-16 font-headline"
    >
      <!-- Left: logo + name. We handle the click manually so that clicking the
           logo while already on the dashboard still resets view mode + selection
           (router links are no-ops on the current route). -->
      <button
        type="button"
        (click)="onLogoClick()"
        class="flex items-center gap-3 min-w-0 rounded-lg px-2 -mx-2 py-1 hover:bg-surface-container-high transition-colors text-left"
        title="Go to Live Dashboard"
      >
        <img
          src="logo.png"
          alt="ViReAl — Vision Recognition Alert"
          class="brand-logo h-10 w-auto flex-shrink-0 select-none"
          draggable="false"
        />
        <div class="leading-tight min-w-0 hidden md:block ml-1 pl-3 border-l border-outline-variant/40">
          <div class="text-[10px] uppercase tracking-widest text-on-surface-variant truncate">
            Venue Operations
          </div>
        </div>
      </button>

      <!-- Right: shift · clock · notifications · avatar -->
      <div class="flex items-center gap-3">
        <div
          class="hidden md:flex items-center gap-2 px-3 h-9 rounded-lg bg-surface-container-low text-xs text-on-surface-variant"
          [title]="shiftTitle()"
        >
          <span class="w-2 h-2 rounded-full bg-primary animate-soft-pulse"></span>
          <span class="tracking-wide">Shift: {{ shift() }}</span>
        </div>

        <div
          class="hidden sm:flex items-center gap-2 px-3 h-9 rounded-lg bg-surface-container-low font-mono text-on-surface tabular-nums"
          title="Local venue time"
        >
          <span class="material-symbols-outlined text-[18px] text-on-surface-variant"
            >schedule</span
          >
          <span class="text-base font-semibold tracking-tight">{{ clock() }}</span>
        </div>

        <div class="relative">
          <button
            type="button"
            class="relative p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high rounded-lg transition-colors"
            [class.bg-surface-container-high]="notificationsOpen()"
            [class.text-on-surface]="notificationsOpen()"
            title="Notifications"
            (click)="toggleNotifications($event)"
          >
            <span class="material-symbols-outlined">notifications</span>
            @if (alerts.activeAlertCount() > 0) {
              <span
                class="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-error text-on-error text-[9px] font-bold flex items-center justify-center"
                >{{ alerts.activeAlertCount() }}</span
              >
            }
          </button>

          @if (notificationsOpen()) {
            <!-- Click-away backdrop -->
            <div
              class="fixed inset-0 z-40"
              (click)="closeNotifications()"
            ></div>

            <div
              class="absolute right-0 top-full mt-2 w-96 max-h-[70vh] rounded-xl bg-surface-container-high shadow-2xl ring-1 ring-outline-variant/40 z-50 flex flex-col overflow-hidden animate-slide-in"
              role="dialog"
              aria-label="Active alerts"
              (click)="$event.stopPropagation()"
            >
              <div
                class="flex items-center justify-between px-4 py-3 border-b border-outline-variant/40"
              >
                <div class="flex items-center gap-2">
                  <span class="material-symbols-outlined text-on-surface-variant"
                    >notifications_active</span
                  >
                  <h2 class="text-sm font-semibold text-on-surface">Active alerts</h2>
                  <span
                    class="text-[10px] px-1.5 py-0.5 rounded-full bg-surface-container-highest text-on-surface-variant font-bold tabular-nums"
                    >{{ activeAlerts().length }}</span
                  >
                </div>
                <button
                  type="button"
                  class="p-1 rounded-md text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest"
                  (click)="closeNotifications()"
                  title="Close"
                >
                  <span class="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>

              <div class="overflow-y-auto flex-1">
                @if (activeAlerts().length === 0) {
                  <div
                    class="px-4 py-10 text-center text-xs text-on-surface-variant"
                  >
                    <span
                      class="material-symbols-outlined text-[32px] text-on-surface-variant/60 mb-2 block"
                      >check_circle</span
                    >
                    No active alerts. All clear.
                  </div>
                } @else {
                  <ul class="divide-y divide-outline-variant/30">
                    @for (alert of activeAlerts(); track alert.id) {
                      <li>
                        <button
                          type="button"
                          class="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-surface-container-highest transition-colors"
                          (click)="openAlert(alert)"
                        >
                          <span
                            class="w-1 self-stretch rounded-full flex-shrink-0"
                            [class.bg-error]="alert.severity === 'critical'"
                            [class.bg-secondary]="alert.severity === 'warning'"
                            [class.bg-primary]="alert.severity === 'info'"
                          ></span>
                          <div class="flex-1 min-w-0">
                            <div class="flex items-start justify-between gap-2">
                              <h3
                                class="text-sm font-semibold text-on-surface leading-snug truncate"
                              >
                                {{ alert.title }}
                              </h3>
                              <span
                                class="text-[10px] text-on-surface-variant flex-shrink-0 tabular-nums"
                                [title]="alert.detectedAt | date: 'medium'"
                              >
                                {{ formatTimeAgo(alert.detectedAt) }}
                              </span>
                            </div>
                            <div
                              class="flex items-center gap-x-3 gap-y-0.5 mt-1 text-[11px] text-on-surface-variant flex-wrap"
                            >
                              <span class="flex items-center gap-1 min-w-0">
                                <span class="material-symbols-outlined text-[13px]"
                                  >location_on</span
                                >
                                <span class="truncate">{{ alert.location }}</span>
                              </span>
                              <span
                                class="uppercase tracking-wide font-bold text-[9px] px-1.5 py-0.5 rounded"
                                [class.bg-error-container]="alert.severity === 'critical'"
                                [class.text-on-error-container]="alert.severity === 'critical'"
                                [class.bg-secondary-container]="alert.severity === 'warning'"
                                [class.text-on-secondary-container]="alert.severity === 'warning'"
                                [class.bg-primary-container]="alert.severity === 'info'"
                                [class.text-on-primary-container]="alert.severity === 'info'"
                                >{{ alert.severity }}</span
                              >
                            </div>
                          </div>
                        </button>
                      </li>
                    }
                  </ul>
                }
              </div>
            </div>
          }
        </div>

        <button
          type="button"
          (click)="auth.openAccount()"
          class="w-9 h-9 rounded-full bg-surface-container-highest overflow-hidden flex items-center justify-center text-sm font-bold text-on-surface-variant hover:text-on-surface hover:ring-2 hover:ring-primary/40 transition"
          [title]="avatarTitle()"
        >
          {{ auth.initials() }}
        </button>
      </div>
    </header>
  `,
})
export class TopBarComponent {
  protected readonly alerts = inject(AlertsService);
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly clock = signal<string>(this.formatNow());
  protected readonly shift = signal<string>(this.computeShiftLabel());
  protected readonly shiftTitle = signal<string>(this.computeShiftTitle());
  protected readonly notificationsOpen = signal<boolean>(false);

  protected readonly activeAlerts = computed(() =>
    this.alerts
      .alerts()
      .filter((a) => a.status === 'active')
      .slice()
      .sort((a, b) => b.detectedAt.getTime() - a.detectedAt.getTime()),
  );

  /** "Mia Chen · Operations Lead" style tooltip for the avatar circle. */
  protected readonly avatarTitle = computed(() => {
    const user = this.auth.user();
    if (!user) return 'Not signed in';
    const suffix = user.title ?? user.roles[0] ?? user.username;
    return suffix ? `${user.name} · ${suffix}` : user.name;
  });

  constructor() {
    // Refresh the clock + shift label periodically. 30s is fine because the
    // shift label only changes on hour-of-day boundaries.
    setInterval(() => {
      this.clock.set(this.formatNow());
      this.shift.set(this.computeShiftLabel());
      this.shiftTitle.set(this.computeShiftTitle());
    }, 30_000);
  }

  protected toggleNotifications(event: Event): void {
    event.stopPropagation();
    this.notificationsOpen.update((v) => !v);
  }

  protected closeNotifications(): void {
    this.notificationsOpen.set(false);
  }

  protected openAlert(alert: VenueAlert): void {
    this.closeNotifications();
    this.alerts.focusAlert(alert);
    void this.router.navigate(['/incidents', alert.id]);
  }

  protected formatTimeAgo(at: Date): string {
    const minutes = Math.max(1, Math.round((Date.now() - at.getTime()) / 60_000));
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.round(hours / 24);
    return `${days}d ago`;
  }

  protected onLogoClick(): void {
    // Always drop back to the default "scanning the room" state, even if we're
    // already on the live dashboard route.
    this.alerts.resetDashboardView();
    void this.router.navigateByUrl('/');
  }

  private formatNow(): string {
    const d = new Date();
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  }

  /** Returns e.g. "Friday · Night" based on the current local time. */
  private computeShiftLabel(): string {
    const d = new Date();
    const weekday = d.toLocaleDateString(undefined, { weekday: 'long' });
    return `${weekday} · ${this.partOfDay(d.getHours())}`;
  }

  private computeShiftTitle(): string {
    const d = new Date();
    const date = d.toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    });
    return `${date} · ${this.partOfDay(d.getHours())} shift`;
  }

  /**
   * Buckets the hour of day into the shift terms staff actually use:
   *  - Morning   06:00 - 11:59
   *  - Afternoon 12:00 - 16:59
   *  - Evening   17:00 - 21:59
   *  - Night     22:00 - 05:59
   */
  private partOfDay(hour: number): 'Morning' | 'Afternoon' | 'Evening' | 'Night' {
    if (hour >= 6 && hour < 12) return 'Morning';
    if (hour >= 12 && hour < 17) return 'Afternoon';
    if (hour >= 17 && hour < 22) return 'Evening';
    return 'Night';
  }
}
