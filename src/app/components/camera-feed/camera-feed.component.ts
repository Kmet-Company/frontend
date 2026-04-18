import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';

import { BoundingBox, CameraFeed } from '../../models/venue.models';

@Component({
  selector: 'va-camera-feed',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      (click)="select.emit(camera().id)"
      [class]="wrapperClass()"
    >
      <img
        class="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity duration-300"
        [src]="camera().imageUrl"
        [alt]="camera().label + ' camera feed'"
        loading="lazy"
      />

      <!-- Subtle vignette to make labels legible without heavy overlays -->
      <div
        class="absolute inset-0 pointer-events-none bg-gradient-to-b from-black/30 via-transparent to-black/40"
      ></div>

      <!-- Inner "selected" highlight — sits inside the card so it stacks with
           the outer red ring when the camera is also the source of an alert. -->
      @if (isSelected()) {
        <div
          class="absolute inset-0 rounded-xl ring-[3px] ring-primary ring-inset pointer-events-none animate-fade-in"
        ></div>
      }

      <!-- Top-left label — turns primary when this feed is the one you're viewing -->
      <div [class]="labelClass()">
        <span class="material-symbols-outlined text-[14px]">{{ camera().icon }}</span>
        {{ camera().label }}
        @if (isSelected()) {
          <span class="material-symbols-outlined text-[14px]">visibility</span>
        }
      </div>

      <!-- Live / Alert indicator — clearly labels what the red border means -->
      <div
        class="absolute top-3 right-3 flex items-center gap-1.5 px-2 py-1 rounded-lg bg-surface-container/80 backdrop-blur-sm text-[10px] font-bold tracking-widest uppercase"
        [class.text-error]="hasAlert()"
        [class.text-on-surface-variant]="!hasAlert()"
        [title]="hasAlert() ? 'This camera is the source of an active alert' : 'Camera feed is live'"
      >
        <span
          class="w-1.5 h-1.5 rounded-full animate-soft-pulse"
          [class.bg-error]="hasAlert()"
          [class.bg-primary]="!hasAlert()"
        ></span>
        @if (hasAlert()) {
          Alert
        } @else {
          Live
        }
      </div>

      <!-- Bottom meta bar -->
      <div
        class="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-3 pointer-events-none"
      >
        <div class="text-[10px] uppercase tracking-widest text-on-surface/80">
          {{ camera().zone }}
        </div>
        @if (camera().occupancy !== undefined) {
          <div
            class="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-surface-container/75 backdrop-blur-sm text-[10px] font-semibold"
          >
            <span class="material-symbols-outlined text-[12px]">groups</span>
            {{ camera().occupancy }}
            <span class="text-on-surface-variant">· {{ densityLabel() }}</span>
          </div>
        }
      </div>

      <!-- Bounding boxes for active incidents -->
      @for (box of boxes(); track box.label) {
        <div
          class="absolute pointer-events-none animate-fade-in"
          [style.left.%]="box.x * 100"
          [style.top.%]="box.y * 100"
          [style.width.%]="box.width * 100"
          [style.height.%]="box.height * 100"
        >
          <div
            class="w-full h-full rounded-sm border-2 border-error/70 bg-error/10"
          ></div>
          <span
            class="absolute -top-5 left-0 text-[9px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded bg-error text-on-error"
          >
            {{ box.label }}
          </span>
        </div>
      }
    </button>
  `,
})
export class CameraFeedComponent {
  readonly camera = input.required<CameraFeed>();
  readonly hasAlert = input<boolean>(false);
  readonly isSelected = input<boolean>(false);
  readonly boxes = input<BoundingBox[]>([]);

  readonly select = output<string>();

  protected readonly labelClass = computed(() => {
    const base =
      'absolute top-3 left-3 flex items-center gap-2 px-2 py-1 rounded-lg backdrop-blur-sm text-[10px] font-bold uppercase tracking-widest transition-colors';
    return this.isSelected()
      ? `${base} bg-primary text-on-primary`
      : `${base} bg-surface-container/80 text-on-surface`;
  });

  protected readonly wrapperClass = computed(() => {
    const classes = [
      'relative group block w-full text-left bg-surface-container rounded-xl overflow-hidden aspect-video transition-all duration-200 focus:outline-none',
    ];
    // Outer ring = "this camera is the source of an active alert".
    // Inner overlay (rendered in the template) = "this is the camera you're
    // currently viewing". They're on different layers so both can show at once.
    if (this.hasAlert()) {
      classes.push('ring-2 ring-error/80 ring-offset-2 ring-offset-background');
    } else {
      classes.push('hover:ring-1 hover:ring-outline-variant/40');
    }
    return classes.join(' ');
  });

  protected readonly densityLabel = computed(() => {
    switch (this.camera().density) {
      case 'high':
        return 'Dense';
      case 'medium':
        return 'Steady';
      case 'low':
        return 'Light';
      default:
        return '';
    }
  });
}
