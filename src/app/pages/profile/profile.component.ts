import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';

import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'va-profile',
  standalone: true,
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="h-full overflow-y-auto bg-surface">
      <div class="max-w-[960px] mx-auto px-6 md:px-8 py-5 space-y-4">
        <!-- Header -->
        <header class="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div
              class="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant"
            >
              Account
            </div>
            <h1
              class="text-2xl font-extrabold tracking-tightest text-on-surface mt-0.5"
            >
              Profile
            </h1>
          </div>
          <p class="text-xs text-on-surface-variant max-w-md">
            Identity metadata from your Keycloak session. To change any of
            these fields, open the account manager.
          </p>
        </header>

        @if (user(); as u) {
          <!-- Hero / avatar card -->
          <section class="bg-surface-container rounded-xl p-5">
            <div class="flex flex-wrap items-center gap-5">
              <div
                class="w-20 h-20 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center text-2xl font-extrabold tracking-tight shrink-0"
                [title]="u.name"
              >
                {{ u.initials }}
              </div>

              <div class="min-w-0 flex-1">
                <div class="text-xl font-bold text-on-surface truncate">
                  {{ u.name }}
                </div>
                @if (u.title) {
                  <div
                    class="text-sm text-on-surface-variant truncate mt-0.5"
                  >
                    {{ u.title }}
                  </div>
                }
                <div class="flex flex-wrap gap-1.5 mt-2">
                  @for (role of u.roles; track role) {
                    <span
                      class="text-[11px] font-semibold uppercase tracking-widest bg-tertiary-container text-on-tertiary-container rounded-md px-2 py-0.5"
                      >{{ role }}</span
                    >
                  } @empty {
                    <span
                      class="text-[11px] text-on-surface-variant italic"
                      >No realm roles assigned</span
                    >
                  }
                </div>
              </div>
            </div>
          </section>

          <!-- Identity details -->
          <section class="bg-surface-container rounded-xl p-4">
            <div class="flex items-center gap-2 mb-3">
              <span class="material-symbols-outlined text-[18px] text-on-surface-variant"
                >badge</span
              >
              <h2 class="text-sm font-bold text-on-surface">Identity</h2>
            </div>
            <dl
              class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm"
            >
              <div>
                <dt
                  class="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant"
                >
                  Display name
                </dt>
                <dd class="text-on-surface mt-0.5">{{ u.name }}</dd>
              </div>
              <div>
                <dt
                  class="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant"
                >
                  Username
                </dt>
                <dd class="text-on-surface mt-0.5 font-mono text-xs">
                  {{ u.username }}
                </dd>
              </div>
              <div>
                <dt
                  class="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant"
                >
                  Email
                </dt>
                <dd class="text-on-surface mt-0.5 font-mono text-xs">
                  {{ u.email ?? '—' }}
                </dd>
              </div>
              <div>
                <dt
                  class="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant"
                >
                  Title
                </dt>
                <dd class="text-on-surface mt-0.5">{{ u.title ?? '—' }}</dd>
              </div>
              <div>
                <dt
                  class="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant"
                >
                  Call sign
                </dt>
                <dd class="text-on-surface mt-0.5 font-mono text-xs">
                  {{ u.callSign ?? '—' }}
                </dd>
              </div>
              <div>
                <dt
                  class="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant"
                >
                  Initials
                </dt>
                <dd class="text-on-surface mt-0.5 font-mono text-xs">
                  {{ u.initials }}
                </dd>
              </div>
            </dl>
          </section>

          <!-- Session / SSO details -->
          <section class="bg-surface-container rounded-xl p-4">
            <div class="flex items-center gap-2 mb-3">
              <span class="material-symbols-outlined text-[18px] text-on-surface-variant"
                >shield_person</span
              >
              <h2 class="text-sm font-bold text-on-surface">Session</h2>
            </div>
            <dl
              class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm"
            >
              <div>
                <dt
                  class="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant"
                >
                  Realm
                </dt>
                <dd class="text-on-surface mt-0.5 font-mono text-xs">
                  {{ kcRealm }}
                </dd>
              </div>
              <div>
                <dt
                  class="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant"
                >
                  Client
                </dt>
                <dd class="text-on-surface mt-0.5 font-mono text-xs">
                  {{ kcClient }}
                </dd>
              </div>
              <div class="sm:col-span-2">
                <dt
                  class="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant"
                >
                  Issuer
                </dt>
                <dd
                  class="text-on-surface mt-0.5 font-mono text-xs break-all"
                >
                  {{ kcIssuer }}
                </dd>
              </div>
              <div>
                <dt
                  class="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant"
                >
                  Signed in
                </dt>
                <dd class="text-on-surface mt-0.5 font-mono text-xs">
                  {{ sessionStartLabel }}
                </dd>
              </div>
              <div>
                <dt
                  class="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant"
                >
                  Auth protocol
                </dt>
                <dd class="text-on-surface mt-0.5 font-mono text-xs">
                  OIDC · PKCE
                </dd>
              </div>
            </dl>
          </section>
        } @else {
          <section class="bg-surface-container rounded-xl p-6 text-center">
            <div class="text-on-surface-variant text-sm">
              Not signed in. Redirecting to the sign-in page…
            </div>
          </section>
        }
      </div>
    </section>
  `,
})
export class ProfileComponent {
  protected readonly auth = inject(AuthService);
  protected readonly user = this.auth.user;

  protected readonly kcRealm = AuthService.config.realm;
  protected readonly kcClient = AuthService.config.clientId;
  protected readonly kcIssuer = computed(
    () => `${AuthService.config.url}/realms/${AuthService.config.realm}`,
  )();

  /** The SPA is freshly loaded whenever we land on this page; this is a
   *  cheap approximation of "current browser session started at" without
   *  reading the ID token's `auth_time` claim. */
  protected readonly sessionStartLabel = new Date().toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
