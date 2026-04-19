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
  AlertStatus,
  RiskLevel,
  VenueAlert,
} from '../../models/venue.models';

type StatusFilter = 'all' | 'active' | 'resolved';

@Component({
  selector: 'va-incidents-list',
  standalone: true,
  imports: [DatePipe, FormsModule, RouterLink, ToastComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="h-full overflow-y-auto bg-surface">
      <div class="max-w-[1400px] mx-auto px-6 md:px-8 py-8 space-y-6">
        <header class="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div class="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
              Operations · Incident Log
            </div>
            <h1 class="text-3xl font-extrabold tracking-tightest text-on-surface mt-1">
              Incidents
            </h1>
            <p class="text-sm text-on-surface-variant mt-1">
              Review all detections from this shift. Click any row to open the full
              incident report.
            </p>
          </div>

          <div class="flex items-center gap-2">
            <div
              class="flex items-center gap-1 px-3 h-10 rounded-lg bg-surface-container text-xs"
            >
              <span class="w-2 h-2 rounded-full bg-error animate-soft-pulse"></span>
              <span class="font-semibold text-on-surface-variant tracking-wider uppercase">
                {{ alerts.activeAlertCount() }} active ·
                {{ alerts.criticalAlertCount() }} critical
              </span>
            </div>
          </div>
        </header>

        <!-- Stat tiles -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
          @for (tile of tiles(); track tile.label) {
            <div class="bg-surface-container rounded-xl p-4">
              <div class="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
                <span
                  class="w-1.5 h-1.5 rounded-full"
                  [class]="tile.dot"
                ></span>
                {{ tile.label }}
              </div>
              <div class="text-2xl font-extrabold tracking-tightest text-on-surface mt-2">
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
          <div class="flex items-center gap-1 bg-surface-container-high rounded-lg p-1">
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
              placeholder="Search title, zone, responder..."
              class="w-full h-10 pl-10 pr-3 rounded-lg bg-surface-container-lowest text-sm text-on-surface placeholder:text-on-surface-variant/60 outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <select
            [ngModel]="zoneFilter()"
            (ngModelChange)="zoneFilter.set($event)"
            class="h-10 px-3 rounded-lg bg-surface-container-lowest text-sm text-on-surface outline-none focus:ring-1 focus:ring-primary"
          >
            @for (zone of zones(); track zone) {
              <option [value]="zone">
                {{ zone === 'all' ? 'All zones' : zone }}
              </option>
            }
          </select>
        </div>

        <!-- Table -->
        <div
          class="bg-surface-container rounded-xl overflow-hidden"
        >
          <div class="grid grid-cols-[70px_1.6fr_1fr_90px_110px_110px_110px] items-center gap-4 px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant bg-surface-container-high/60">
            <span>ID</span>
            <span>Incident</span>
            <span>Zone</span>
            <span>Risk</span>
            <span>Status</span>
            <span>Lead</span>
            <span class="text-right">Opened</span>
          </div>

          @if (filtered().length === 0) {
            <div class="p-8 text-center text-sm text-on-surface-variant">
              <span class="material-symbols-outlined text-3xl text-primary">task_alt</span>
              <div class="mt-2 font-semibold text-on-surface">No incidents match your filters</div>
              <div class="text-xs mt-1">Try clearing the search or switching status.</div>
            </div>
          }

          @for (item of filtered(); track item.id) {
            <a
              [routerLink]="['/incidents', item.id]"
              class="grid grid-cols-[70px_1.6fr_1fr_90px_110px_110px_110px] items-center gap-4 px-5 py-3 text-sm cursor-pointer hover:bg-surface-container-high transition-colors"
            >
              <span class="font-mono text-xs text-on-surface-variant">#{{ item.reference }}</span>

              <div class="min-w-0">
                <div class="flex items-center gap-2">
                  <span
                    class="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    [class]="severityDot(item)"
                  ></span>
                  <span class="font-semibold text-on-surface truncate">{{ item.title }}</span>
                </div>
                <div class="text-[11px] text-on-surface-variant truncate mt-0.5">
                  {{ item.description }}
                </div>
              </div>

              <div class="text-xs text-on-surface-variant flex items-center gap-1 min-w-0">
                <span class="material-symbols-outlined text-[14px]">location_on</span>
                <span class="truncate">{{ item.zone }}</span>
              </div>

              <span class="chip" [class]="riskChipClass(item.risk)">{{ item.risk }}</span>

              <span class="chip" [class]="statusChipClass(item.status)">{{
                statusLabel(item.status)
              }}</span>

              <span class="text-xs text-on-surface-variant truncate">
                {{ item.leadResponder ?? '—' }}
              </span>

              <span
                class="text-right text-[11px] text-on-surface-variant"
                [title]="item.detectedAt | date: 'medium'"
              >
                {{ item.detectedAt | date: 'shortTime' }}
              </span>
            </a>
          }
        </div>
      </div>

      <va-toast />
    </section>
  `,
})
export class IncidentsListComponent {
  protected readonly alerts = inject(AlertsService);

  protected readonly statusFilter = signal<StatusFilter>('active');
  protected readonly zoneFilter = signal<string>('all');
  protected readonly query = signal<string>('');

  protected readonly statusOptions: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'active', label: 'Active' },
    { value: 'resolved', label: 'Closed' },
  ];

  protected readonly zones = computed(() => {
    const set = new Set<string>(['all']);
    for (const item of this.alerts.allIncidents()) set.add(item.zone);
    return [...set];
  });

  protected readonly filtered = computed(() => {
    const status = this.statusFilter();
    const zone = this.zoneFilter();
    const q = this.query().trim().toLowerCase();

    return this.alerts.allIncidents().filter((item) => {
      if (status === 'active' && item.status !== 'active') return false;
      if (status === 'resolved' && item.status === 'active') return false;
      if (zone !== 'all' && item.zone !== zone) return false;
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        item.zone.toLowerCase().includes(q) ||
        item.location.toLowerCase().includes(q) ||
        (item.leadResponder ?? '').toLowerCase().includes(q) ||
        item.reference.toLowerCase().includes(q)
      );
    });
  });

  protected readonly tiles = computed(() => {
    const all = this.alerts.allIncidents();
    const active = all.filter((a) => a.status === 'active').length;
    const critical = all.filter(
      (a) => a.status === 'active' && a.severity === 'critical',
    ).length;
    const resolvedToday = all.filter((a) => a.status === 'resolved').length;
    return [
      {
        label: 'Active',
        value: active,
        hint: 'Currently open on floor',
        dot: 'bg-error animate-soft-pulse',
      },
      {
        label: 'Critical',
        value: critical,
        hint: 'Requires immediate review',
        dot: 'bg-error',
      },
      {
        label: 'Resolved',
        value: resolvedToday,
        hint: 'Closed this shift',
        dot: 'bg-primary',
      },
      {
        label: 'Total',
        value: all.length,
        hint: 'All logged this shift',
        dot: 'bg-on-surface-variant',
      },
    ];
  });

  protected statusButtonClass(value: StatusFilter): string {
    const base =
      'px-3 h-8 text-xs font-semibold rounded-md transition-colors';
    return value === this.statusFilter()
      ? `${base} bg-surface-bright text-on-surface`
      : `${base} text-on-surface-variant hover:text-on-surface`;
  }

  protected severityDot(item: VenueAlert): string {
    switch (item.severity) {
      case 'critical':
        return 'bg-error';
      case 'warning':
        return 'bg-secondary';
      default:
        return 'bg-primary';
    }
  }

  protected riskChipClass(risk: RiskLevel): string {
    switch (risk) {
      case 'high':
        return 'bg-error-container text-on-error-container';
      case 'medium':
        return 'bg-secondary-container text-on-secondary-container';
      default:
        return 'bg-primary-container text-on-primary-container';
    }
  }

  protected statusChipClass(status: AlertStatus): string {
    switch (status) {
      case 'active':
        return 'bg-error-container text-on-error-container';
      case 'confirmed':
        return 'bg-primary-container text-on-primary-container';
      case 'escalated':
        return 'bg-error-container text-on-error-container';
      case 'dismissed':
        return 'bg-secondary-container text-on-secondary-container';
      case 'resolved':
        return 'bg-surface-container-highest text-on-surface-variant';
      default:
        return 'bg-surface-container-highest text-on-surface-variant';
    }
  }

  protected statusLabel(status: AlertStatus): string {
    switch (status) {
      case 'active':
        return 'Active';
      case 'confirmed':
        return 'Confirmed';
      case 'dismissed':
        return 'Dismissed';
      case 'escalated':
        return 'Escalated';
      case 'resolved':
        return 'Resolved';
      default:
        return 'Unknown';
    }
  }
}
