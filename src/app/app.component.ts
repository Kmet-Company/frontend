import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { TopBarComponent } from './components/top-bar/top-bar.component';
import { SideNavComponent } from './components/side-nav/side-nav.component';
import { SettingsService } from './services/settings.service';

@Component({
  selector: 'va-root',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, TopBarComponent, SideNavComponent],
  template: `
    <div class="h-screen flex flex-col bg-background text-on-surface overflow-hidden">
      <va-top-bar />
      <div class="flex flex-1 min-h-0 overflow-hidden">
        <va-side-nav />
        <div class="flex-1 min-w-0 min-h-0 overflow-hidden">
          <router-outlet />
        </div>
      </div>
    </div>
  `,
})
export class AppComponent {
  // Eagerly construct so saved theme + profile load on app boot.
  private readonly settings = inject(SettingsService);
}
