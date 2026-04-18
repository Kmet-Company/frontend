import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import { ToastComponent } from '../../components/toast/toast.component';
import { AlertsService } from '../../services/alerts.service';
import {
  GuestReport,
  GuestReportKind,
  GuestReportPriority,
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
  selector: 'va-report-detail',
  standalone: true,
  imports: [DatePipe, RouterLink, ToastComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="h-full overflow-y-auto bg-surface">
      <div class="max-w-[1100px] mx-auto px-6 md:px-8 py-8 space-y-6">
        <!-- Breadcrumb / back -->
        <nav class="flex items-center gap-2 text-xs text-on-surface-variant">
          <a
            routerLink="/reports"
            class="inline-flex items-center gap-1 hover:text-on-surface transition-colors"
          >
            <span class="material-symbols-outlined text-[16px]">arrow_back</span>
            Reports
          </a>
          <span>/</span>
          <span class="font-mono text-on-surface">{{
            report()?.reference ?? 'Not found'
          }}</span>
        </nav>

        @if (report(); as r) {
          <!-- Header card -->
          <header
            class="bg-surface-container rounded-2xl p-6 flex flex-col gap-4"
          >
            <div class="flex flex-wrap items-start justify-between gap-4">
              <div class="flex items-start gap-4 min-w-0">
                <div [class]="iconWrapClass(r)">
                  <span class="material-symbols-outlined text-[22px]">{{
                    meta(r.kind).icon
                  }}</span>
                </div>
                <div class="min-w-0">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="chip" [class]="kindChipClass(r.kind)">
                      {{ meta(r.kind).label }}
                    </span>
                    <span class="chip" [class]="statusChipClass(r.status)">
                      {{ statusLabel(r.status) }}
                    </span>
                    <span class="chip" [class]="priorityChipClass(r.priority)">
                      {{ r.priority }} priority
                    </span>
                    <span
                      class="font-mono text-[11px] text-on-surface-variant"
                      [title]="r.submittedAt | date: 'medium'"
                    >
                      {{ r.reference }} · {{ relative(r.submittedAt) }}
                    </span>
                  </div>
                  <h1
                    class="text-2xl font-extrabold tracking-tightest text-on-surface mt-2"
                  >
                    {{ r.title }}
                  </h1>
                </div>
              </div>

              <!-- Action buttons mirror the card on the live dashboard. -->
              @if (r.status !== 'resolved') {
                <div class="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    (click)="alerts.acknowledgeGuestReport(r.id)"
                    class="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-primary text-on-primary text-xs font-semibold hover:brightness-110 transition"
                    title="Promote to an active alert for operator follow-up"
                  >
                    <span class="material-symbols-outlined text-[16px]">done</span>
                    Acknowledge
                  </button>
                  <button
                    type="button"
                    (click)="alerts.dismissGuestReport(r.id)"
                    class="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-outline-variant bg-transparent text-on-surface text-xs font-semibold hover:bg-surface-container-highest hover:border-outline transition"
                  >
                    <span class="material-symbols-outlined text-[16px]">close</span>
                    Dismiss
                  </button>
                </div>
              }
            </div>
          </header>

          <div class="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-6">
            <!-- Message body -->
            <div class="bg-surface-container rounded-2xl p-6 space-y-4">
              <h2
                class="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant"
              >
                Guest message
              </h2>
              <blockquote
                class="text-[15px] text-on-surface leading-relaxed whitespace-pre-line"
              >
                {{ r.message }}
              </blockquote>

              <div
                class="pt-4 border-t border-outline-variant/40 grid grid-cols-2 gap-4 text-sm"
              >
                <div>
                  <div
                    class="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant"
                  >
                    Location
                  </div>
                  <div
                    class="mt-1 text-on-surface flex items-center gap-1"
                  >
                    <span class="material-symbols-outlined text-[16px]"
                      >location_on</span
                    >
                    {{ r.location }}
                  </div>
                </div>
                <div>
                  <div
                    class="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant"
                  >
                    Submitted
                  </div>
                  <div class="mt-1 text-on-surface">
                    {{ r.submittedAt | date: 'medium' }}
                  </div>
                </div>
              </div>
            </div>

            <!-- Side panel: guest + meta -->
            <aside class="bg-surface-container rounded-2xl p-6 space-y-5">
              <div>
                <h2
                  class="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant"
                >
                  Guest
                </h2>
                <div
                  class="mt-2 flex items-center gap-3 bg-surface-container-high rounded-xl px-3 py-2"
                >
                  <div
                    class="w-9 h-9 rounded-full bg-surface-container-highest flex items-center justify-center text-on-surface-variant"
                  >
                    <span class="material-symbols-outlined text-[20px]"
                      >person</span
                    >
                  </div>
                  <div class="min-w-0">
                    <div class="text-sm font-semibold text-on-surface truncate">
                      {{ r.guestHandle }}
                    </div>
                    <div class="text-[11px] text-on-surface-variant">
                      Submitted via mobile app
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h2
                  class="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant"
                >
                  Category
                </h2>
                <div class="mt-2 text-sm text-on-surface">
                  {{ meta(r.kind).label }}
                </div>
              </div>

              <div>
                <h2
                  class="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant"
                >
                  Priority
                </h2>
                <div class="mt-2">
                  <span class="chip" [class]="priorityChipClass(r.priority)">
                    {{ r.priority }}
                  </span>
                </div>
              </div>

              <div>
                <h2
                  class="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant"
                >
                  Status
                </h2>
                <div class="mt-2">
                  <span class="chip" [class]="statusChipClass(r.status)">
                    {{ statusLabel(r.status) }}
                  </span>
                </div>
              </div>
            </aside>
          </div>
        } @else {
          <div class="bg-surface-container rounded-xl p-12 text-center">
            <span class="material-symbols-outlined text-4xl text-on-surface-variant"
              >search_off</span
            >
            <h2 class="text-xl font-bold text-on-surface mt-3">
              Report not found
            </h2>
            <p class="text-sm text-on-surface-variant mt-1">
              This guest report may have been archived.
            </p>
            <a
              routerLink="/reports"
              class="inline-flex items-center gap-2 mt-4 px-4 h-10 rounded-lg bg-primary text-on-primary text-sm font-semibold"
            >
              <span class="material-symbols-outlined text-[18px]">arrow_back</span>
              Back to reports
            </a>
          </div>
        }
      </div>

      <va-toast />
    </section>
  `,
})
export class ReportDetailComponent {
  /** Comes from the `:id` route param via withComponentInputBinding. */
  readonly id = input<string | undefined>(undefined);

  protected readonly alerts = inject(AlertsService);

  protected readonly report = computed<GuestReport | undefined>(() => {
    const id = this.id();
    if (!id) return undefined;
    // Read the live list so status updates from this page reflect immediately.
    return this.alerts.guestReports().find((r) => r.id === id);
  });

  protected meta(kind: GuestReportKind): KindMeta {
    return KIND_META[kind];
  }

  protected iconWrapClass(report: GuestReport): string {
    const tone = this.meta(report.kind).tone;
    const base =
      'flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center';
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

  protected kindChipClass(kind: GuestReportKind): string {
    switch (this.meta(kind).tone) {
      case 'error':
        return 'bg-error-container text-on-error-container';
      case 'warning':
        return 'bg-secondary-container text-on-secondary-container';
      case 'primary':
        return 'bg-primary-container text-on-primary-container';
      default:
        return 'bg-surface-container-highest text-on-surface-variant';
    }
  }

  protected priorityChipClass(priority: GuestReportPriority): string {
    switch (priority) {
      case 'high':
        return 'bg-error-container text-on-error-container';
      case 'medium':
        return 'bg-secondary-container text-on-secondary-container';
      default:
        return 'bg-surface-container-highest text-on-surface-variant';
    }
  }

  protected statusChipClass(status: GuestReportStatus): string {
    switch (status) {
      case 'new':
        return 'bg-primary-container text-on-primary-container';
      case 'acknowledged':
        return 'bg-surface-container-highest text-on-surface-variant';
      case 'dispatched':
        return 'bg-secondary-container text-on-secondary-container';
      case 'resolved':
        return 'bg-surface-container-highest text-on-surface-variant';
      default:
        return 'bg-surface-container-highest text-on-surface-variant';
    }
  }

  protected statusLabel(status: GuestReportStatus): string {
    switch (status) {
      case 'new':
        return 'New';
      case 'acknowledged':
        return 'Acknowledged';
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
