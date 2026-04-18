import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
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

type StatusFilter =
  | 'all'
  | 'active'
  | 'new'
  | 'acknowledged'
  | 'dispatched'
  | 'resolved';

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
  selector: 'va-reports-list',
  standalone: true,
  imports: [DatePipe, FormsModule, RouterLink, ToastComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="h-full overflow-y-auto bg-surface">
      <div class="max-w-[1400px] mx-auto px-6 md:px-8 py-8 space-y-6">
        <header class="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div
              class="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant"
            >
              Operations · Guest Reports
            </div>
            <h1
              class="text-3xl font-extrabold tracking-tightest text-on-surface mt-1"
            >
              Reports
            </h1>
            <p class="text-sm text-on-surface-variant mt-1 max-w-2xl">
              Everything submitted through the venue mobile app this shift. Open
              a report to review the message and coordinate a response.
            </p>
          </div>

          <div
            class="flex items-center gap-1 px-3 h-10 rounded-lg bg-surface-container text-xs"
          >
            <span class="w-2 h-2 rounded-full bg-primary animate-soft-pulse"></span>
            <span
              class="font-semibold text-on-surface-variant tracking-wider uppercase"
            >
              {{ alerts.newGuestReportCount() }} new ·
              {{ highPriorityCount() }} priority
            </span>
          </div>
        </header>

        <!-- Stat tiles -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
          @for (tile of tiles(); track tile.label) {
            <div class="bg-surface-container rounded-xl p-4">
              <div
                class="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant"
              >
                <span class="w-1.5 h-1.5 rounded-full" [class]="tile.dot"></span>
                {{ tile.label }}
              </div>
              <div
                class="text-2xl font-extrabold tracking-tightest text-on-surface mt-2"
              >
                {{ tile.value }}
              </div>
              <div class="text-[11px] text-on-surface-variant mt-0.5">
                {{ tile.hint }}
              </div>
            </div>
          }
        </div>

        <!-- Filters -->
        <div
          class="bg-surface-container rounded-xl p-4 flex flex-wrap items-center gap-3"
        >
          <div
            class="flex items-center gap-1 bg-surface-container-high rounded-lg p-1 flex-wrap"
          >
            @for (option of statusOptions; track option.value) {
              <button
                type="button"
                (click)="statusFilter.set(option.value)"
                [class]="statusButtonClass(option.value)"
              >
                {{ option.label }}
              </button>
            }
          </div>

          <div class="relative flex-1 min-w-[220px]">
            <span
              class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]"
              >search</span
            >
            <input
              type="search"
              [ngModel]="query()"
              (ngModelChange)="query.set($event)"
              placeholder="Search title, guest, location..."
              class="w-full h-10 pl-10 pr-3 rounded-lg bg-surface-container-lowest text-sm text-on-surface placeholder:text-on-surface-variant/60 outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <select
            [ngModel]="kindFilter()"
            (ngModelChange)="kindFilter.set($event)"
            class="h-10 px-3 rounded-lg bg-surface-container-lowest text-sm text-on-surface outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">All categories</option>
            @for (k of kindValues; track k) {
              <option [value]="k">{{ meta(k).label }}</option>
            }
          </select>
        </div>

        <!-- Table -->
        <div class="bg-surface-container rounded-xl overflow-hidden">
          <div
            class="grid grid-cols-[90px_1.8fr_130px_90px_110px_140px_110px] items-center gap-4 px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant bg-surface-container-high/60"
          >
            <span>Ref</span>
            <span>Report</span>
            <span>Category</span>
            <span>Priority</span>
            <span>Status</span>
            <span>Guest</span>
            <span class="text-right">Submitted</span>
          </div>

          @if (filtered().length === 0) {
            <div class="p-8 text-center text-sm text-on-surface-variant">
              <span class="material-symbols-outlined text-3xl text-primary"
                >inbox</span
              >
              <div class="mt-2 font-semibold text-on-surface">
                No reports match your filters
              </div>
              <div class="text-xs mt-1">
                Try clearing the search or switching status.
              </div>
            </div>
          }

          @for (item of filtered(); track item.id) {
            <a
              [routerLink]="['/reports', item.id]"
              class="grid grid-cols-[90px_1.8fr_130px_90px_110px_140px_110px] items-center gap-4 px-5 py-3 text-sm cursor-pointer hover:bg-surface-container-high transition-colors"
            >
              <span class="font-mono text-xs text-on-surface-variant">{{
                item.reference
              }}</span>

              <div class="min-w-0">
                <div class="flex items-center gap-2">
                  <span
                    class="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    [class]="toneDot(item.kind)"
                  ></span>
                  <span class="font-semibold text-on-surface truncate">{{
                    item.title
                  }}</span>
                </div>
                <div
                  class="text-[11px] text-on-surface-variant truncate mt-0.5"
                  [title]="item.message"
                >
                  {{ item.message }}
                </div>
              </div>

              <span class="chip" [class]="kindChipClass(item.kind)">
                <span class="material-symbols-outlined text-[12px]">{{
                  meta(item.kind).icon
                }}</span>
                {{ meta(item.kind).label }}
              </span>

              <span class="chip" [class]="priorityChipClass(item.priority)">{{
                item.priority
              }}</span>

              <span class="chip" [class]="statusChipClass(item.status)">{{
                statusLabel(item.status)
              }}</span>

              <span
                class="text-xs text-on-surface-variant truncate flex items-center gap-1 min-w-0"
              >
                <span class="material-symbols-outlined text-[14px]">person</span>
                <span class="truncate">{{ item.guestHandle }}</span>
              </span>

              <span
                class="text-right text-[11px] text-on-surface-variant"
                [title]="item.submittedAt | date: 'medium'"
              >
                {{ item.submittedAt | date: 'shortTime' }}
              </span>
            </a>
          }
        </div>
      </div>

      <va-toast />
    </section>
  `,
})
export class ReportsListComponent {
  protected readonly alerts = inject(AlertsService);

  protected readonly statusFilter = signal<StatusFilter>('active');
  protected readonly kindFilter = signal<GuestReportKind | 'all'>('all');
  protected readonly query = signal<string>('');

  protected readonly statusOptions: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'active', label: 'Active' },
    { value: 'new', label: 'New' },
    { value: 'acknowledged', label: 'Acked' },
    { value: 'dispatched', label: 'Dispatched' },
    { value: 'resolved', label: 'Resolved' },
  ];

  protected readonly kindValues = Object.keys(KIND_META) as GuestReportKind[];

  protected readonly filtered = computed<GuestReport[]>(() => {
    const status = this.statusFilter();
    const kind = this.kindFilter();
    const q = this.query().trim().toLowerCase();

    return [...this.alerts.guestReports()]
      .sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime())
      .filter((item) => {
        if (status === 'active' && item.status === 'resolved') return false;
        if (
          status !== 'all' &&
          status !== 'active' &&
          item.status !== status
        )
          return false;
        if (kind !== 'all' && item.kind !== kind) return false;
        if (!q) return true;
        return (
          item.title.toLowerCase().includes(q) ||
          item.message.toLowerCase().includes(q) ||
          item.location.toLowerCase().includes(q) ||
          item.guestHandle.toLowerCase().includes(q) ||
          item.reference.toLowerCase().includes(q)
        );
      });
  });

  protected readonly highPriorityCount = computed(
    () =>
      this.alerts
        .guestReports()
        .filter((r) => r.priority === 'high' && r.status !== 'resolved').length,
  );

  protected readonly tiles = computed(() => {
    const all = this.alerts.guestReports();
    const newCount = all.filter((r) => r.status === 'new').length;
    const acked = all.filter((r) => r.status === 'acknowledged').length;
    const dispatched = all.filter((r) => r.status === 'dispatched').length;
    const resolved = all.filter((r) => r.status === 'resolved').length;
    return [
      {
        label: 'New',
        value: newCount,
        hint: 'Awaiting review',
        dot: 'bg-primary animate-soft-pulse',
      },
      {
        label: 'Acknowledged',
        value: acked,
        hint: 'Seen by staff',
        dot: 'bg-secondary',
      },
      {
        label: 'Dispatched',
        value: dispatched,
        hint: 'Team en route',
        dot: 'bg-secondary',
      },
      {
        label: 'Resolved',
        value: resolved,
        hint: 'Closed this shift',
        dot: 'bg-on-surface-variant',
      },
    ];
  });

  protected statusButtonClass(value: StatusFilter): string {
    const base = 'px-3 h-8 text-xs font-semibold rounded-md transition-colors';
    return value === this.statusFilter()
      ? `${base} bg-surface-bright text-on-surface`
      : `${base} text-on-surface-variant hover:text-on-surface`;
  }

  protected meta(kind: GuestReportKind): KindMeta {
    return KIND_META[kind];
  }

  protected toneDot(kind: GuestReportKind): string {
    switch (this.meta(kind).tone) {
      case 'error':
        return 'bg-error';
      case 'warning':
        return 'bg-secondary';
      case 'primary':
        return 'bg-primary';
      default:
        return 'bg-on-surface-variant';
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
}
