import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';

import { AlertsService } from '../../services/alerts.service';
import {
  GuestReport,
  GuestReportKind,
  GuestReportStatus,
} from '../../models/venue.models';

interface KindMeta {
  icon: string;
  label: string;
  tone: 'error' | 'warning' | 'info' | 'primary';
}

const KIND_META: Record<GuestReportKind, KindMeta> = {
  medical: { icon: 'medical_services', label: 'Medical', tone: 'error' },
  safety: { icon: 'shield_person', label: 'Safety', tone: 'error' },
  harassment: { icon: 'report', label: 'Harassment', tone: 'error' },
  hazard: { icon: 'warning', label: 'Hazard', tone: 'warning' },
  staff_help: { icon: 'support_agent', label: 'Needs staff', tone: 'warning' },
  lost_item: { icon: 'luggage', label: 'Lost item', tone: 'info' },
  other: { icon: 'chat', label: 'Other', tone: 'info' },
};

@Component({
  selector: 'va-guest-reports',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe],
  host: { class: 'block' },
  template: `
    <section class="flex flex-col gap-3">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span
            class="material-symbols-outlined text-[18px] text-on-surface-variant"
            >smartphone</span
          >
          <h2 class="text-base font-bold tracking-tight text-on-surface">
            Guest Reports
          </h2>
        </div>
        @if (alerts.newGuestReportCount() > 0) {
          <span class="chip bg-secondary-container text-on-secondary-container">
            {{ alerts.newGuestReportCount() }} new
          </span>
        } @else {
          <span class="chip bg-surface-container text-on-surface-variant">
            Caught up
          </span>
        }
      </div>

      <p class="text-xs text-on-surface-variant -mt-1">
        Live reports submitted by guests through the venue mobile app.
      </p>

      <!--
        Panel caps around the height of ~3 cards; anything past that
        scrolls inside the panel so the overall page never grows.
      -->
      <div class="flex flex-col gap-3 max-h-[34rem] overflow-y-auto pr-2 py-1">
        @if (alerts.activeGuestReports().length === 0) {
          <div
            class="bg-surface-container-high rounded-xl p-5 text-center text-sm text-on-surface-variant"
          >
            <span class="material-symbols-outlined text-2xl text-primary"
              >inbox</span
            >
            <div class="mt-1 font-semibold text-on-surface">No open reports</div>
            <div class="text-xs mt-0.5">
              Guests haven’t flagged anything in the last few minutes.
            </div>
          </div>
        }

        @for (report of alerts.activeGuestReports(); track report.id) {
          <article
            class="group relative bg-surface-container-high rounded-xl p-4 transition-colors duration-200 animate-slide-in hover:bg-surface-container-highest"
          >
            <div class="flex items-start gap-3">
              <div [class]="iconWrapClass(report)">
                <span class="material-symbols-outlined text-[18px]">{{
                  meta(report.kind).icon
                }}</span>
              </div>

              <div class="flex-1 min-w-0">
                <div class="flex items-start justify-between gap-3">
                  <div class="flex items-center gap-2 flex-wrap min-w-0">
                    <span [class]="kindPillClass(report)">
                      {{ meta(report.kind).label }}
                    </span>
                    <span [class]="statusPillClass(report.status)">
                      {{ statusLabel(report.status) }}
                    </span>
                  </div>
                  <time
                    class="text-[11px] text-on-surface-variant whitespace-nowrap mt-0.5"
                    [attr.title]="report.submittedAt | date: 'medium'"
                  >
                    {{ relative(report.submittedAt) }}
                  </time>
                </div>

                <p
                  class="mt-2 text-[12.5px] text-on-surface leading-relaxed"
                  [title]="report.message"
                >
                  {{ report.message }}
                </p>

                @if (report.photoUrl) {
                  <a
                    [href]="report.photoUrl"
                    target="_blank"
                    rel="noopener"
                    class="mt-2 block w-full max-w-xs overflow-hidden rounded-lg border border-outline-variant"
                    [title]="'Open photo attached by ' + report.guestEmail"
                  >
                    <img
                      [src]="report.photoUrl"
                      [alt]="'Photo attached to report ' + report.reference"
                      loading="lazy"
                      class="w-full h-32 object-cover"
                    />
                  </a>
                }

                <div
                  class="mt-2 flex items-center gap-x-3 gap-y-1 text-[11px] text-on-surface-variant flex-wrap"
                >
                  <span class="inline-flex items-center gap-1">
                    <span class="material-symbols-outlined text-[13px]"
                      >location_on</span
                    >
                    {{ report.location }}
                  </span>
                  <span class="inline-flex items-center gap-1 min-w-0">
                    <span class="material-symbols-outlined text-[13px]"
                      >mail</span
                    >
                    <span class="truncate">{{ report.guestEmail }}</span>
                  </span>
                </div>

                <div class="mt-3 flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    (click)="alerts.acknowledgeGuestReport(report.id)"
                    class="inline-flex items-center gap-1 px-2.5 h-7 rounded-md bg-primary text-on-primary text-[11px] font-semibold hover:brightness-110 transition"
                    title="Promote to an active alert for operator follow-up"
                  >
                    <span class="material-symbols-outlined text-[14px]"
                      >done</span
                    >
                    Acknowledge
                  </button>
                  <button
                    type="button"
                    (click)="alerts.dismissGuestReport(report.id)"
                    class="inline-flex items-center gap-1 px-2.5 h-7 rounded-md border border-outline-variant bg-transparent text-on-surface text-[11px] font-semibold hover:bg-surface-container-highest hover:border-outline transition"
                  >
                    <span class="material-symbols-outlined text-[14px]"
                      >close</span
                    >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          </article>
        }

      </div>
    </section>
  `,
})
export class GuestReportsComponent {
  protected readonly alerts = inject(AlertsService);

  protected meta(kind: GuestReportKind): KindMeta {
    return KIND_META[kind];
  }

  protected iconWrapClass(report: GuestReport): string {
    const tone = this.meta(report.kind).tone;
    const base =
      'flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center';
    switch (tone) {
      case 'error':
        return `${base} bg-error-container text-on-error-container`;
      case 'warning':
        return `${base} bg-secondary-container text-on-secondary-container`;
      case 'primary':
        return `${base} bg-primary-container text-on-primary-container`;
      default:
        return `${base} bg-surface-container-highest text-on-surface-variant`;
    }
  }

  protected kindPillClass(report: GuestReport): string {
    const base =
      'inline-flex items-center px-2 h-5 rounded-full text-[10px] font-bold uppercase tracking-wider';
    switch (this.meta(report.kind).tone) {
      case 'error':
        return `${base} bg-error-container text-on-error-container`;
      case 'warning':
        return `${base} bg-secondary-container text-on-secondary-container`;
      default:
        return `${base} bg-surface-container-highest text-on-surface-variant`;
    }
  }

  protected statusPillClass(status: GuestReportStatus): string {
    const base =
      'inline-flex items-center px-2 h-5 rounded-full text-[10px] font-semibold uppercase tracking-wider';
    switch (status) {
      case 'new':
        return `${base} bg-primary-container text-on-primary-container`;
      case 'acknowledged':
        return `${base} bg-surface-container-highest text-on-surface-variant`;
      case 'dispatched':
        return `${base} bg-secondary-container text-on-secondary-container`;
      default:
        return `${base} bg-surface-container-highest text-on-surface-variant`;
    }
  }

  protected statusLabel(status: GuestReportStatus): string {
    switch (status) {
      case 'new':
        return 'New';
      case 'acknowledged':
        return 'Ack.';
      case 'dispatched':
        return 'Dispatched';
      case 'resolved':
        return 'Resolved';
    }
  }

  protected relative(date: Date): string {
    const diffSec = Math.max(1, Math.round((Date.now() - date.getTime()) / 1000));
    if (diffSec < 60) return `${diffSec}s ago`;
    const mins = Math.round(diffSec / 60);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.round(hours / 24)}d ago`;
  }
}
