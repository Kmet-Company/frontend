import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { AlertsService } from '../../services/alerts.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'va-top-bar',
  standalone: true,
  imports: [RouterLink],
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

        <button
          type="button"
          class="relative p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high rounded-lg transition-colors"
          title="Notifications"
        >
          <span class="material-symbols-outlined">notifications</span>
          @if (alerts.activeAlertCount() > 0) {
            <span
              class="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-error text-on-error text-[9px] font-bold flex items-center justify-center"
              >{{ alerts.activeAlertCount() }}</span
            >
          }
        </button>

        <a
          routerLink="/profile"
          class="w-9 h-9 rounded-full bg-surface-container-highest overflow-hidden flex items-center justify-center text-sm font-bold text-on-surface-variant hover:text-on-surface hover:ring-2 hover:ring-primary/40 transition"
          [title]="avatarTitle()"
        >
          {{ auth.initials() }}
        </a>
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
