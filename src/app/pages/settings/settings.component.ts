import { FormsModule } from '@angular/forms';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';

import { SettingsService, ThemePreference } from '../../services/settings.service';

interface ThemeOption {
  value: ThemePreference;
  label: string;
  description: string;
  icon: string;
}

@Component({
  selector: 'va-settings',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="h-full overflow-y-auto bg-surface">
      <div class="max-w-[1100px] mx-auto px-6 md:px-8 py-5 space-y-4">
        <header class="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div
              class="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant"
            >
              System
            </div>
            <h1
              class="text-2xl font-extrabold tracking-tightest text-on-surface mt-0.5"
            >
              Settings
            </h1>
          </div>
          <p class="text-xs text-on-surface-variant max-w-md">
            Personal preferences for this workstation. Changes save
            automatically.
          </p>
        </header>

        <!-- Profile -->
        <section class="bg-surface-container rounded-xl p-4">
          <div class="flex items-center gap-2 mb-3">
            <span class="material-symbols-outlined text-[18px] text-on-surface-variant"
              >person</span
            >
            <h2 class="text-sm font-bold text-on-surface">Profile</h2>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <label class="block">
              <span class="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant"
                >Display name</span
              >
              <input
                type="text"
                [ngModel]="settings.displayName()"
                (ngModelChange)="settings.setDisplayName($event)"
                class="mt-1 w-full h-9 px-2.5 rounded-lg bg-surface-container-lowest text-sm text-on-surface outline-none focus:ring-1 focus:ring-primary"
              />
            </label>

            <label class="block">
              <span class="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant"
                >Role</span
              >
              <input
                type="text"
                [ngModel]="settings.role()"
                (ngModelChange)="settings.setRole($event)"
                class="mt-1 w-full h-9 px-2.5 rounded-lg bg-surface-container-lowest text-sm text-on-surface outline-none focus:ring-1 focus:ring-primary"
              />
            </label>

            <label class="block">
              <span class="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant"
                >Call sign</span
              >
              <input
                type="text"
                [ngModel]="settings.callSign()"
                (ngModelChange)="settings.setCallSign($event)"
                placeholder="Unit 14"
                class="mt-1 w-full h-9 px-2.5 rounded-lg bg-surface-container-lowest text-sm text-on-surface outline-none focus:ring-1 focus:ring-primary"
              />
            </label>

            <label class="block">
              <span class="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant"
                >Email</span
              >
              <input
                type="email"
                [ngModel]="settings.email()"
                (ngModelChange)="settings.setEmail($event)"
                class="mt-1 w-full h-9 px-2.5 rounded-lg bg-surface-container-lowest text-sm text-on-surface outline-none focus:ring-1 focus:ring-primary"
              />
            </label>
          </div>
        </section>

        <!-- Appearance + Notifications -->
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <section class="lg:col-span-5 bg-surface-container rounded-xl p-4">
            <div class="flex items-center gap-2 mb-3">
              <span class="material-symbols-outlined text-[18px] text-on-surface-variant"
                >palette</span
              >
              <h2 class="text-sm font-bold text-on-surface">Appearance</h2>
            </div>

            <div class="grid grid-cols-1 gap-2">
              @for (opt of themeOptions; track opt.value) {
                <button
                  type="button"
                  (click)="settings.setTheme(opt.value)"
                  [class]="themeCardClass(opt.value)"
                >
                  <span class="material-symbols-outlined text-[20px]">{{
                    opt.icon
                  }}</span>
                  <div class="flex-1 min-w-0 text-left">
                    <div class="text-sm font-semibold">{{ opt.label }}</div>
                    <div class="text-[11px] text-on-surface-variant">
                      {{ opt.description }}
                    </div>
                  </div>
                  @if (settings.theme() === opt.value) {
                    <span class="material-symbols-outlined text-[18px] text-primary"
                      >check_circle</span
                    >
                  }
                </button>
              }
            </div>
          </section>

          <section class="lg:col-span-7 bg-surface-container rounded-xl p-4">
            <div class="flex items-center gap-2 mb-3">
              <span class="material-symbols-outlined text-[18px] text-on-surface-variant"
                >notifications</span
              >
              <h2 class="text-sm font-bold text-on-surface">Notifications</h2>
            </div>

            <div class="space-y-2">
              <div
                class="flex items-center justify-between gap-3 bg-surface-container-lowest rounded-lg px-3 py-2"
              >
                <div class="min-w-0">
                  <div class="text-sm font-semibold text-on-surface">
                    Sound alerts
                  </div>
                  <div class="text-[11px] text-on-surface-variant">
                    Soft chime on new critical alerts.
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  [attr.aria-checked]="settings.soundAlerts()"
                  (click)="settings.setSoundAlerts(!settings.soundAlerts())"
                  [class]="toggleClass(settings.soundAlerts())"
                >
                  <span [class]="toggleThumbClass(settings.soundAlerts())"></span>
                </button>
              </div>

              <div
                class="flex items-center justify-between gap-3 bg-surface-container-lowest rounded-lg px-3 py-2"
              >
                <div class="min-w-0">
                  <div class="text-sm font-semibold text-on-surface">
                    Desktop notifications
                  </div>
                  <div class="text-[11px] text-on-surface-variant">
                    Browser notification when the tab is in the background.
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  [attr.aria-checked]="settings.desktopNotifications()"
                  (click)="onToggleDesktop()"
                  [class]="toggleClass(settings.desktopNotifications())"
                >
                  <span
                    [class]="toggleThumbClass(settings.desktopNotifications())"
                  ></span>
                </button>
              </div>

              <div
                class="flex items-center justify-between gap-3 bg-surface-container-lowest rounded-lg px-3 py-2"
              >
                <div class="min-w-0">
                  <div class="text-sm font-semibold text-on-surface">
                    Toast duration
                  </div>
                  <div class="text-[11px] text-on-surface-variant">
                    How long confirmations stay on screen.
                  </div>
                </div>
                <div class="flex items-center gap-2 flex-shrink-0">
                  <input
                    type="range"
                    min="1"
                    max="10"
                    step="1"
                    [ngModel]="settings.toastDurationSeconds()"
                    (ngModelChange)="settings.setToastDurationSeconds($event)"
                    class="accent-primary w-28"
                  />
                  <span
                    class="text-xs text-on-surface-variant tabular-nums w-8 text-right"
                    >{{ settings.toastDurationSeconds() }}s</span
                  >
                </div>
              </div>
            </div>
          </section>
        </div>

        <!-- About + Reset -->
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <section class="lg:col-span-7 bg-surface-container rounded-xl p-4">
            <div class="flex items-center gap-2 mb-3">
              <span class="material-symbols-outlined text-[18px] text-on-surface-variant"
                >info</span
              >
              <h2 class="text-sm font-bold text-on-surface">About</h2>
            </div>

            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div>
                <div class="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant">
                  Version
                </div>
                <div class="text-on-surface font-mono mt-0.5">0.1.0</div>
              </div>
              <div>
                <div class="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant">
                  Build
                </div>
                <div class="text-on-surface font-mono mt-0.5">dev</div>
              </div>
              <div>
                <div class="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant">
                  Venue
                </div>
                <div class="text-on-surface mt-0.5">The Foundry</div>
              </div>
              <div>
                <div class="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant">
                  Environment
                </div>
                <div class="text-on-surface mt-0.5">Production</div>
              </div>
            </div>
          </section>

          <section class="lg:col-span-5 bg-surface-container rounded-xl p-4">
            <div class="flex items-center gap-2 mb-3">
              <span class="material-symbols-outlined text-[18px] text-error"
                >warning</span
              >
              <h2 class="text-sm font-bold text-on-surface">
                Reset preferences
              </h2>
            </div>
            <div class="flex items-center justify-between gap-3 flex-wrap">
              <p class="text-[11px] text-on-surface-variant flex-1 min-w-0">
                Restores profile, theme and notification defaults. Shift
                data is not affected.
              </p>
              <button
                type="button"
                (click)="askReset()"
                class="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg border border-outline-variant bg-transparent text-on-surface text-xs font-semibold hover:bg-surface-container-highest hover:border-outline transition-colors flex-shrink-0"
              >
                <span class="material-symbols-outlined text-[14px]"
                  >restart_alt</span
                >
                Reset to defaults
              </button>
            </div>
          </section>
        </div>
      </div>

      @if (resetOpen()) {
        <div
          class="fixed inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in"
          (click)="cancelReset()"
        >
          <div
            class="bg-surface-container rounded-2xl w-full max-w-sm mx-4 p-6 shadow-xl"
            (click)="$event.stopPropagation()"
            role="alertdialog"
          >
            <div class="flex items-center gap-3">
              <div
                class="w-10 h-10 rounded-full bg-error-container text-on-error-container flex items-center justify-center"
              >
                <span class="material-symbols-outlined text-[22px]"
                  >restart_alt</span
                >
              </div>
              <div>
                <h2 class="text-base font-bold text-on-surface">
                  Reset preferences?
                </h2>
                <p class="text-xs text-on-surface-variant mt-0.5">
                  Profile, theme and notification settings will return to
                  defaults.
                </p>
              </div>
            </div>

            <div class="flex items-center justify-end gap-2 mt-5">
              <button
                type="button"
                (click)="cancelReset()"
                class="px-3 h-9 rounded-lg border border-outline-variant bg-transparent text-on-surface text-xs font-semibold hover:bg-surface-container-highest hover:border-outline transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                (click)="confirmReset()"
                class="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg bg-error text-on-error text-xs font-semibold hover:brightness-110 transition-all"
              >
                <span class="material-symbols-outlined text-[14px]"
                  >restart_alt</span
                >
                Reset
              </button>
            </div>
          </div>
        </div>
      }
    </section>
  `,
})
export class SettingsComponent {
  protected readonly settings = inject(SettingsService);

  protected readonly resetOpen = signal<boolean>(false);

  protected readonly themeOptions: ThemeOption[] = [
    {
      value: 'system',
      label: 'System',
      description: 'Follows your OS setting.',
      icon: 'desktop_windows',
    },
    {
      value: 'light',
      label: 'Light',
      description: 'Always use the light palette.',
      icon: 'light_mode',
    },
    {
      value: 'dark',
      label: 'Dark',
      description: 'Always use the dark palette.',
      icon: 'dark_mode',
    },
  ];

  protected themeCardClass(value: ThemePreference): string {
    const base =
      'flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left';
    return this.settings.theme() === value
      ? `${base} border-primary bg-primary-container/40`
      : `${base} border-outline-variant bg-surface-container-lowest hover:border-outline`;
  }

  protected toggleClass(on: boolean): string {
    const base =
      'relative w-11 h-6 rounded-full transition-colors flex-shrink-0 cursor-pointer';
    return on
      ? `${base} bg-primary`
      : `${base} bg-surface-container-highest`;
  }

  protected toggleThumbClass(on: boolean): string {
    const base =
      'absolute top-0.5 w-5 h-5 rounded-full bg-surface shadow transition-all';
    return on ? `${base} left-[22px]` : `${base} left-0.5`;
  }

  protected onToggleDesktop(): void {
    const next = !this.settings.desktopNotifications();
    this.settings.setDesktopNotifications(next);

    if (
      next &&
      typeof Notification !== 'undefined' &&
      Notification.permission === 'default'
    ) {
      Notification.requestPermission().catch(() => {
        /* ignore */
      });
    }
  }

  protected askReset(): void {
    this.resetOpen.set(true);
  }

  protected cancelReset(): void {
    this.resetOpen.set(false);
  }

  protected confirmReset(): void {
    this.settings.resetToDefaults();
    this.resetOpen.set(false);
  }
}
