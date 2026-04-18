import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { AlertsService } from '../../services/alerts.service';

@Component({
  selector: 'va-toast',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (alerts.toast(); as message) {
      <div
        class="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface-bright text-on-surface text-sm font-medium shadow-[0_12px_32px_-4px_rgba(224,230,237,0.08)] animate-slide-in"
        role="status"
        aria-live="polite"
      >
        <span class="material-symbols-outlined sym-fill text-primary text-[18px]"
          >check_circle</span
        >
        {{ message }}
      </div>
    }
  `,
})
export class ToastComponent {
  protected readonly alerts = inject(AlertsService);
}
