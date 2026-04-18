import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { VenueMapComponent } from '../../components/venue-map/venue-map.component';
import { AlertsService } from '../../services/alerts.service';

@Component({
  selector: 'va-venue-map-page',
  standalone: true,
  imports: [VenueMapComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="h-full overflow-y-auto bg-surface">
      <div class="max-w-[1400px] mx-auto px-6 md:px-8 py-8 space-y-6">
        <header class="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div
              class="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant"
            >
              Operations · Floor Plan
            </div>
            <h1
              class="text-3xl font-extrabold tracking-tightest text-on-surface mt-1"
            >
              Venue Map
            </h1>
            <p class="text-sm text-on-surface-variant mt-1 max-w-2xl">
              Live zone activity overlaid on the floor plan. Heat clusters show
              crowd density, warm tones flag moderate activity, and red rings
              mark zones with an active alert.
            </p>
          </div>

          <div
            class="flex items-center gap-1 px-3 h-10 rounded-lg bg-surface-container text-xs"
          >
            <span class="w-2 h-2 rounded-full bg-error animate-soft-pulse"></span>
            <span
              class="font-semibold text-on-surface-variant tracking-wider uppercase"
            >
              {{ alerts.activeAlertCount() }} active ·
              {{ alerts.criticalAlertCount() }} critical
            </span>
          </div>
        </header>

        <div class="bg-surface-container-low rounded-2xl p-5 md:p-6">
          <va-venue-map />
        </div>
      </div>
    </section>
  `,
})
export class VenueMapPageComponent {
  protected readonly alerts = inject(AlertsService);
}
