import {
  APP_INITIALIZER,
  ApplicationConfig,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient, withFetch } from '@angular/common/http';

import { routes } from './app.routes';
import { AuthService } from './services/auth.service';

/**
 * Runs before the router / components bootstrap. When Keycloak is reachable
 * this triggers the login-required flow; the promise only resolves after
 * the user is authenticated (or the redirect is already in flight).
 *
 * In dev, if Keycloak is offline we log and continue so the rest of the
 * dashboard is still debuggable — the user signal will be null in that case.
 */
function initKeycloakFactory(auth: AuthService): () => Promise<void> {
  return () =>
    auth.init().catch((err) => {
      // eslint-disable-next-line no-console
      console.error(
        '[auth] Keycloak init failed. Is the keycloak stack running on :8081?',
        err,
      );
    });
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withComponentInputBinding()),
    provideAnimations(),
    provideHttpClient(withFetch()),
    {
      provide: APP_INITIALIZER,
      useFactory: initKeycloakFactory,
      deps: [AuthService],
      multi: true,
    },
  ],
};
