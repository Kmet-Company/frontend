import { Injectable, computed, signal } from '@angular/core';
import Keycloak from 'keycloak-js';

/**
 * Thin wrapper around keycloak-js. Owns the singleton Keycloak instance,
 * runs the OIDC login-required flow on bootstrap, and exposes the logged-in
 * user as a signal so components can render a name / initials / roles
 * without importing keycloak-js directly.
 *
 * Tokens can be retrieved via {@link token} for future backend calls that
 * validate JWTs (PostgREST with PGRST_JWT_SECRET, a FastAPI service, ...).
 */
export interface AuthUser {
  /** preferred_username from the ID token. */
  username: string;
  /** "First Last" (fallback to username). */
  name: string;
  /** Two-letter uppercase initials derived from {@link name}. */
  initials: string;
  /** Email, if the user has one on their Keycloak profile. */
  email: string | null;
  /** Realm roles excluding built-in Keycloak defaults. */
  roles: string[];
  /** Free-form `title` attribute, e.g. "Operations Lead". */
  title: string | null;
  /** Free-form `callSign` attribute, e.g. "Dispatch 01". */
  callSign: string | null;
}

export interface KeycloakAppConfig {
  url: string;
  realm: string;
  clientId: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  // Runtime config. Overridable at build time; see app.config.ts.
  // For local development against a localhost Keycloak instance, temporarily
  // point `url` at http://localhost:8081 (and add that redirect URI to the
  // realm client).
  static config: KeycloakAppConfig = {
    url: 'https://auth.vireal.club',
    realm: 'vireal',
    clientId: 'vireal-web',
  };

  private readonly _user = signal<AuthUser | null>(null);
  /** Current signed-in user, or null while the OIDC handshake is running. */
  readonly user = this._user.asReadonly();
  readonly initials = computed(() => this._user()?.initials ?? '··');
  readonly displayName = computed(() => this._user()?.name ?? 'Operator');
  readonly isAuthenticated = computed(() => this._user() !== null);

  private keycloak: Keycloak | null = null;

  /** Returns the current access token, refreshing it if it's about to expire. */
  async token(minValiditySeconds = 30): Promise<string | undefined> {
    if (!this.keycloak) return undefined;
    try {
      await this.keycloak.updateToken(minValiditySeconds);
    } catch {
      // Refresh failed (refresh token gone or revoked) — force re-login.
      this.keycloak.login();
      return undefined;
    }
    return this.keycloak.token;
  }

  /**
   * Called once during APP_INITIALIZER. Redirects to the themed Keycloak
   * login page if the user isn't authenticated yet; on return, hydrates
   * `user` from the ID token.
   */
  async init(): Promise<void> {
    const kc = new Keycloak({
      url: AuthService.config.url,
      realm: AuthService.config.realm,
      clientId: AuthService.config.clientId,
    });

    const authenticated = await kc.init({
      onLoad: 'login-required',
      pkceMethod: 'S256',
      // The silent-check iframe requires hosting an HTML file on our origin
      // and is a common source of CORS grief in dev. The active-token flow
      // below keeps sessions fresh without it.
      checkLoginIframe: false,
    });

    this.keycloak = kc;
    if (!authenticated) {
      // init('login-required') already triggers a redirect, so this path is
      // effectively unreachable — kept only to make the type-checker happy.
      return;
    }

    this.hydrateUser();

    // Keep the access token warm while the page is open. If refresh fails
    // (e.g. SSO session ended elsewhere) the user gets bounced to login.
    kc.onTokenExpired = () => {
      kc.updateToken(30).catch(() => kc.login());
    };
  }

  /**
   * End the Keycloak SSO session and bounce the browser back to the app
   * root — which will kick off login-required again and land the user on
   * the themed sign-in page.
   */
  logout(): void {
    if (!this.keycloak) {
      window.location.reload();
      return;
    }
    void this.keycloak.logout({
      redirectUri: window.location.origin + '/',
    });
  }

  /** Open the Keycloak account management page for the current user. */
  openAccount(): void {
    this.keycloak?.accountManagement();
  }

  private hydrateUser(): void {
    const kc = this.keycloak;
    if (!kc) return;
    const parsed = (kc.tokenParsed ?? {}) as Record<string, unknown> & {
      preferred_username?: string;
      name?: string;
      given_name?: string;
      family_name?: string;
      email?: string;
      realm_access?: { roles?: string[] };
      title?: string;
      callSign?: string;
    };

    const username = parsed.preferred_username ?? 'operator';
    const given = parsed.given_name ?? '';
    const family = parsed.family_name ?? '';
    const name =
      parsed.name?.trim() ||
      [given, family].filter(Boolean).join(' ').trim() ||
      username;

    const roles = (parsed.realm_access?.roles ?? []).filter(
      (r) =>
        !r.startsWith('default-roles') &&
        r !== 'offline_access' &&
        r !== 'uma_authorization',
    );

    this._user.set({
      username,
      name,
      initials: this.computeInitials(name, username),
      email: parsed.email ?? null,
      roles,
      title: typeof parsed.title === 'string' ? parsed.title : null,
      callSign: typeof parsed.callSign === 'string' ? parsed.callSign : null,
    });
  }

  private computeInitials(name: string, username: string): string {
    const source = name.trim() || username;
    const parts = source.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '··';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
}
