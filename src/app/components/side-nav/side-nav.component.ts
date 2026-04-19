import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { AlertsService } from '../../services/alerts.service';
import { AuthService } from '../../services/auth.service';

interface NavItem {
  label: string;
  icon: string;
  /** Populated routes are active links; otherwise the item renders as disabled. */
  route?: string;
  exact?: boolean;
  badge?: () => string | null;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

@Component({
  selector: 'va-side-nav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <aside
      class="hidden lg:flex flex-col h-full w-60 bg-surface-container-low font-body text-sm overflow-hidden"
    >
      <div class="px-6 pt-5 pb-3 shrink-0">
        <div class="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">
          Venue
        </div>
        <div class="text-sm font-bold text-on-surface mt-0.5">
          The Foundry · North Hall
        </div>
      </div>

      <nav class="flex-1 min-h-0 overflow-y-auto px-3 pb-4 space-y-6">
        @for (group of groups; track group.label) {
          <div>
            <div
              class="px-3 pt-2 pb-2 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/70"
            >
              {{ group.label }}
            </div>
            <div class="space-y-1">
              @for (item of group.items; track item.label) {
                @if (item.route) {
                  <a
                    [routerLink]="item.route"
                    routerLinkActive="bg-surface-container-high text-on-surface font-semibold"
                    [routerLinkActiveOptions]="{ exact: item.exact ?? false }"
                    #rla="routerLinkActive"
                    class="group flex items-center gap-3 px-3 py-2 rounded-lg transition-colors duration-150 text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
                  >
                    <span
                      class="material-symbols-outlined text-[20px]"
                      [class.sym-fill]="rla.isActive"
                      >{{ item.icon }}</span
                    >
                    <span class="flex-1 truncate">{{ item.label }}</span>
                    @if (item.badge && item.badge(); as badgeValue) {
                      <span
                        class="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-error-container text-on-error-container"
                        >{{ badgeValue }}</span
                      >
                    }
                  </a>
                } @else {
                  <button
                    type="button"
                    disabled
                    class="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-on-surface-variant/40 cursor-not-allowed"
                    title="Coming soon"
                  >
                    <span class="material-symbols-outlined text-[20px]">{{ item.icon }}</span>
                    <span class="flex-1 text-left truncate">{{ item.label }}</span>
                    <span class="text-[9px] uppercase tracking-widest">Soon</span>
                  </button>
                }
              }
            </div>
          </div>
        }
      </nav>

      <div class="shrink-0 px-3 pb-4 pt-2 space-y-1 border-t border-outline-variant/40">
        @if (auth.user(); as currentUser) {
          <div class="px-3 py-2 text-[11px] text-on-surface-variant truncate" [title]="currentUser.email ?? currentUser.username">
            Signed in as
            <span class="block text-on-surface font-semibold truncate">{{ currentUser.name }}</span>
          </div>
        }
        <a
          routerLink="/support"
          routerLinkActive="bg-surface-container text-on-surface"
          class="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors"
          title="About this project — tech stack &amp; architecture"
        >
          <span class="material-symbols-outlined text-[20px]">help</span>
          <span class="flex-1 text-left">Help &amp; About</span>
        </a>
        <button
          type="button"
          (click)="auth.logout()"
          class="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors"
          title="Sign out of ViReAl"
        >
          <span class="material-symbols-outlined text-[20px]">logout</span>
          <span class="flex-1 text-left">Sign out</span>
        </button>
      </div>
    </aside>
  `,
})
export class SideNavComponent {
  private readonly alerts = inject(AlertsService);
  protected readonly auth = inject(AuthService);
  private readonly activeBadge = computed(() => {
    const count = this.alerts.activeAlertCount();
    return count > 0 ? String(count) : null;
  });
  private readonly newReportsBadge = computed(() => {
    const count = this.alerts.newGuestReportCount();
    return count > 0 ? String(count) : null;
  });

  protected readonly groups: NavGroup[] = [
    {
      label: 'Operations',
      items: [
        { label: 'Live Dashboard', icon: 'dashboard', route: '/', exact: true },
        {
          label: 'Incidents',
          icon: 'report',
          route: '/incidents',
          badge: () => this.activeBadge(),
        },
        {
          label: 'Reports',
          icon: 'smartphone',
          route: '/reports',
          badge: () => this.newReportsBadge(),
        },
        { label: 'Venue Map', icon: 'map', route: '/venue-map' },
        { label: 'Escalate', icon: 'crisis_alert', route: '/escalate' },
      ],
    },
    {
      label: 'Teams',
      items: [
        { label: 'Staff Roster', icon: 'badge', route: '/staff' },
      ],
    },
    {
      label: 'System',
      items: [
        { label: 'Settings', icon: 'settings', route: '/settings' },
      ],
    },
  ];
}
