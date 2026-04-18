import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { AlertsService } from '../../services/alerts.service';
import { VenueAlert } from '../../models/venue.models';

@Component({
  selector: 'va-alert-card',
  standalone: true,
  imports: [DatePipe, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <article
      class="group relative rounded-xl p-4 transition-colors duration-200 animate-slide-in"
      [class.bg-surface-container-high]="!isSelected()"
      [class.bg-surface-container-highest]="isSelected()"
      [class.ring-2]="isSelected()"
      [class.ring-primary]="isSelected()"
      [class.ring-offset-2]="isSelected()"
      [class.ring-offset-surface-container-low]="isSelected()"
      [class.hover:bg-surface-container-highest]="!isSelected()"
    >
      <!-- Severity rail — thickens when selected. -->
      <div
        class="absolute left-0 top-3 bottom-3 rounded-full transition-all duration-200"
        [class.w-1]="!isSelected()"
        [class.w-[5px]]="isSelected()"
        [class.bg-error]="severity() === 'critical'"
        [class.bg-secondary]="severity() === 'warning'"
        [class.bg-primary]="severity() === 'info'"
      ></div>

      <div
        role="button"
        tabindex="0"
        class="pl-3 cursor-pointer outline-none"
        (click)="select()"
        (keydown.enter)="select()"
        (keydown.space)="$event.preventDefault(); select()"
      >
        <div class="flex items-start gap-3">
          @if (alert().previewUrl) {
            <img
              class="w-14 h-14 rounded-lg object-cover flex-shrink-0 bg-surface-container"
              [src]="alert().previewUrl"
              [alt]="alert().title + ' preview'"
              loading="lazy"
            />
          } @else {
            <div
              class="w-14 h-14 rounded-lg bg-surface-container flex items-center justify-center flex-shrink-0"
            >
              <span class="material-symbols-outlined text-on-surface-variant">videocam</span>
            </div>
          }

          <div class="flex-1 min-w-0">
            <div class="flex items-start justify-between gap-2">
              <h3 class="font-semibold text-sm text-on-surface leading-snug">
                {{ alert().title }}
              </h3>
              <span
                class="text-[10px] text-on-surface-variant flex-shrink-0"
                [title]="alert().detectedAt | date: 'medium'"
              >
                {{ timeAgo() }}
              </span>
            </div>

            <div
              class="flex items-center gap-x-3 gap-y-1 mt-1.5 text-[11px] text-on-surface-variant flex-wrap"
            >
              <span class="flex items-center gap-1">
                <span class="material-symbols-outlined text-[14px]">location_on</span>
                {{ alert().location }}
              </span>
              <span class="flex items-center gap-1">
                <span class="material-symbols-outlined text-[14px]">insights</span>
                {{ alert().confidence }}% confidence
              </span>
              <a
                [routerLink]="['/incidents', alert().id]"
                (click)="$event.stopPropagation()"
                class="ml-auto inline-flex items-center gap-0.5 font-semibold text-primary hover:underline"
              >
                Open report
                <span class="material-symbols-outlined text-[13px]"
                  >arrow_forward</span
                >
              </a>
            </div>
          </div>
        </div>
      </div>

      <div class="flex items-center gap-2 pt-3 pl-3">
        <button
          type="button"
          class="flex-1 h-9 inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary text-on-primary text-xs font-semibold hover:brightness-110 transition-all active:scale-[0.98]"
          (click)="confirm()"
        >
          <span class="material-symbols-outlined text-[16px]">check</span>
          Confirm
        </button>
        <button
          type="button"
          class="flex-1 h-9 inline-flex items-center justify-center gap-1.5 rounded-lg border border-outline-variant bg-transparent text-on-surface text-xs font-semibold hover:bg-surface-container-highest hover:border-outline transition-all active:scale-[0.98]"
          (click)="dismiss()"
        >
          <span class="material-symbols-outlined text-[16px]">close</span>
          Dismiss
        </button>
        <button
          type="button"
          class="h-9 px-3 inline-flex items-center justify-center gap-1.5 rounded-lg bg-error-container text-on-error-container text-xs font-semibold hover:brightness-110 transition-all active:scale-[0.98]"
          (click)="escalate()"
          title="Open the escalation console with this alert"
        >
          <span class="material-symbols-outlined text-[16px]">emergency_share</span>
          Escalate
        </button>
      </div>
    </article>
  `,
})
export class AlertCardComponent {
  readonly alert = input.required<VenueAlert>();
  readonly isSelected = input<boolean>(false);

  private readonly service = inject(AlertsService);
  private readonly router = inject(Router);

  protected readonly severity = computed(() => this.alert().severity);

  protected readonly timeAgo = computed(() => {
    const diffMs = Date.now() - this.alert().detectedAt.getTime();
    const minutes = Math.max(1, Math.round(diffMs / 60_000));
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.round(minutes / 60);
    return `${hours} hr ago`;
  });

  protected select(): void {
    this.service.focusAlert(this.alert());
  }

  protected confirm(): void {
    this.service.confirmAlert(this.alert());
  }

  protected dismiss(): void {
    this.service.dismissAlert(this.alert());
  }

  /**
   * The Escalate button no longer mutates alert state directly — it routes the
   * operator to the dedicated Escalate console, scoped to this alert, where
   * they can fire the appropriate response plan and then mark it escalated.
   */
  protected escalate(): void {
    this.router.navigate(['/escalate'], {
      queryParams: { alertId: this.alert().id },
    });
  }
}
