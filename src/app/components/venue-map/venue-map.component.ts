import { ChangeDetectionStrategy, Component } from '@angular/core';

interface MapZone {
  label: string;
  status: 'calm' | 'active' | 'alert';
  top: string;
  left: string;
  size: number;
}

@Component({
  selector: 'va-venue-map',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section>
      <div class="flex items-center justify-between mb-3">
        <h2
          class="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant flex items-center gap-2"
        >
          <span class="material-symbols-outlined text-[16px]">map</span>
          Venue Map · Zone Activity
        </h2>
        <span class="text-[10px] text-on-surface-variant">Updated 12s ago</span>
      </div>

      <div
        class="relative bg-surface-container rounded-xl overflow-hidden aspect-[16/10]"
      >
        <!-- Floor plan schematic drawn in CSS (no external asset needed) -->
        <svg
          viewBox="0 0 320 200"
          xmlns="http://www.w3.org/2000/svg"
          class="absolute inset-0 w-full h-full opacity-60"
          aria-hidden="true"
        >
          <defs>
            <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path
                d="M 20 0 L 0 0 0 20"
                fill="none"
                class="stroke-surface-container-highest"
                stroke-width="0.5"
              />
            </pattern>
          </defs>
          <rect width="320" height="200" fill="url(#grid)" />
          <!-- Outer walls -->
          <rect
            x="14"
            y="14"
            width="292"
            height="172"
            rx="6"
            fill="none"
            class="stroke-outline-variant"
            stroke-width="2"
          />
          <!-- Stage -->
          <rect
            x="30"
            y="26"
            width="90"
            height="38"
            rx="3"
            class="fill-surface-container-high stroke-outline-variant"
          />
          <text
            x="75"
            y="49"
            text-anchor="middle"
            font-size="9"
            class="fill-on-surface-variant"
            font-family="Inter"
          >
            STAGE
          </text>
          <!-- Dance floor -->
          <rect
            x="30"
            y="80"
            width="160"
            height="80"
            rx="4"
            class="fill-surface-container stroke-outline-variant"
          />
          <text
            x="110"
            y="124"
            text-anchor="middle"
            font-size="10"
            class="fill-on-surface-variant"
            font-family="Inter"
          >
            DANCE FLOOR
          </text>
          <!-- Bar -->
          <rect
            x="210"
            y="30"
            width="90"
            height="70"
            rx="3"
            class="fill-surface-container-high stroke-outline-variant"
          />
          <text
            x="255"
            y="68"
            text-anchor="middle"
            font-size="9"
            class="fill-on-surface-variant"
            font-family="Inter"
          >
            BAR
          </text>
          <!-- Lounge -->
          <rect
            x="210"
            y="110"
            width="90"
            height="50"
            rx="3"
            class="fill-surface-container stroke-outline-variant"
          />
          <text
            x="255"
            y="138"
            text-anchor="middle"
            font-size="9"
            class="fill-on-surface-variant"
            font-family="Inter"
          >
            LOUNGE
          </text>
          <!-- Entrance -->
          <rect
            x="140"
            y="170"
            width="40"
            height="14"
            rx="2"
            class="fill-surface-container-high stroke-outline-variant"
          />
          <text
            x="160"
            y="180"
            text-anchor="middle"
            font-size="7"
            class="fill-on-surface-variant"
            font-family="Inter"
          >
            ENTRANCE
          </text>
        </svg>

        <!-- Heat zones -->
        @for (zone of zones; track zone.label) {
          <div
            class="absolute rounded-full blur-xl"
            [class.bg-error]="zone.status === 'alert'"
            [class.bg-secondary]="zone.status === 'active'"
            [class.bg-primary]="zone.status === 'calm'"
            [style.opacity]="zone.status === 'alert' ? 0.55 : zone.status === 'active' ? 0.35 : 0.25"
            [style.top]="zone.top"
            [style.left]="zone.left"
            [style.width.px]="zone.size"
            [style.height.px]="zone.size"
          ></div>
        }

        <!-- Zone labels -->
        @for (zone of zones; track zone.label + '-label') {
          <div
            class="absolute -translate-x-1/2 -translate-y-1/2 flex items-center gap-1 px-1.5 py-0.5 rounded bg-surface-container-high/90 backdrop-blur-sm text-[9px] font-semibold uppercase tracking-wider"
            [class.text-error]="zone.status === 'alert'"
            [class.text-on-secondary-container]="zone.status === 'active'"
            [class.text-on-surface-variant]="zone.status === 'calm'"
            [style.top]="zone.top"
            [style.left]="zone.left"
          >
            <span
              class="w-1.5 h-1.5 rounded-full"
              [class.bg-error]="zone.status === 'alert'"
              [class.bg-secondary]="zone.status === 'active'"
              [class.bg-primary]="zone.status === 'calm'"
            ></span>
            {{ zone.label }}
          </div>
        }
      </div>

      <div class="flex items-center gap-4 mt-3 text-[10px] text-on-surface-variant">
        <span class="flex items-center gap-1.5">
          <span class="w-2 h-2 rounded-full bg-error"></span>
          High activity
        </span>
        <span class="flex items-center gap-1.5">
          <span class="w-2 h-2 rounded-full bg-secondary"></span>
          Moderate
        </span>
        <span class="flex items-center gap-1.5">
          <span class="w-2 h-2 rounded-full bg-primary"></span>
          Calm
        </span>
      </div>
    </section>
  `,
})
export class VenueMapComponent {
  protected readonly zones: MapZone[] = [
    { label: 'Bar', status: 'alert', top: '35%', left: '78%', size: 70 },
    { label: 'Stage', status: 'active', top: '28%', left: '24%', size: 80 },
    { label: 'Dance Floor', status: 'active', top: '62%', left: '36%', size: 90 },
    { label: 'Lounge', status: 'calm', top: '68%', left: '78%', size: 50 },
    { label: 'Entrance', status: 'calm', top: '88%', left: '50%', size: 40 },
  ];
}
