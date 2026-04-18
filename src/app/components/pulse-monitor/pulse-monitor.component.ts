import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import { AlertsService } from '../../services/alerts.service';

@Component({
  selector: 'va-pulse-monitor',
  standalone: true,
  imports: [DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="bg-surface-container rounded-xl p-5">
      <div class="flex items-start justify-between mb-4">
        <div>
          <h3
            class="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant"
          >
            Venue Pulse · Last 30 minutes
          </h3>
          <p class="text-xs text-on-surface-variant mt-0.5">
            Occupancy trend and safety status
          </p>
        </div>
        <div class="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-surface-container-high">
          <span class="w-1.5 h-1.5 rounded-full bg-primary animate-soft-pulse"></span>
          <span class="text-[10px] font-semibold tracking-wider uppercase">Live</span>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
        <div>
          <div class="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
            Live Occupancy
          </div>
          <div class="flex items-baseline gap-2 mt-1">
            <span class="text-4xl font-extrabold tracking-tightest text-on-surface">
              {{ occupancy() | number }}
            </span>
            <span class="text-xs font-medium text-on-surface-variant">/ 2,400 cap</span>
          </div>
          <div class="mt-2 h-1.5 rounded-full bg-surface-container-high overflow-hidden">
            <div
              class="h-full rounded-full bg-primary"
              [style.width.%]="capacityPct()"
            ></div>
          </div>
        </div>

        <div class="col-span-1 md:col-span-1">
          <div class="flex items-end gap-1 h-16">
            @for (bar of bars; track $index) {
              <div
                class="flex-1 rounded-t-sm transition-all"
                [style.height.%]="bar.height"
                [class.bg-primary]="!bar.spike"
                [class.bg-tertiary]="bar.spike"
                [class.opacity-40]="!bar.spike && bar.height < 45"
              ></div>
            }
          </div>
          <div class="flex justify-between text-[9px] text-on-surface-variant mt-1.5">
            <span>-30m</span>
            <span>-15m</span>
            <span>now</span>
          </div>
        </div>

        <div class="text-right">
          <div class="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
            Status Integrity
          </div>
          <div
            class="text-2xl font-bold mt-1"
            [class.text-primary]="criticalCount() === 0"
            [class.text-error]="criticalCount() > 0"
          >
            {{ statusLabel() }}
          </div>
          <div class="text-xs text-on-surface-variant mt-0.5">
            {{ alerts.activeAlertCount() }} active ·
            {{ criticalCount() }} critical
          </div>
        </div>
      </div>
    </section>
  `,
})
export class PulseMonitorComponent {
  protected readonly alerts = inject(AlertsService);

  protected readonly bars = [
    { height: 35, spike: false },
    { height: 42, spike: false },
    { height: 48, spike: false },
    { height: 55, spike: false },
    { height: 60, spike: false },
    { height: 64, spike: false },
    { height: 72, spike: false },
    { height: 68, spike: false },
    { height: 75, spike: false },
    { height: 92, spike: true },
    { height: 80, spike: false },
    { height: 70, spike: false },
  ];

  protected readonly occupancy = computed(() =>
    this.alerts
      .cameras()
      .reduce((sum, c) => sum + (c.occupancy ?? 0), 0),
  );

  protected readonly capacityPct = computed(() =>
    Math.min(100, Math.round((this.occupancy() / 2400) * 100)),
  );

  protected readonly criticalCount = computed(() => this.alerts.criticalAlertCount());

  protected readonly statusLabel = computed(() =>
    this.criticalCount() > 0 ? 'Attention' : 'Normal',
  );
}
