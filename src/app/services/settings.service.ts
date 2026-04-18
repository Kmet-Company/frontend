import { Injectable, effect, signal } from '@angular/core';

export type ThemePreference = 'system' | 'light' | 'dark';

interface PersistedSettings {
  theme: ThemePreference;
  displayName: string;
  callSign: string;
  role: string;
  email: string;
  soundAlerts: boolean;
  desktopNotifications: boolean;
  toastDurationSeconds: number;
}

const STORAGE_KEY = 'va-settings';

const DEFAULTS: PersistedSettings = {
  theme: 'system',
  displayName: 'Mia Rodriguez',
  callSign: 'Shift Manager',
  role: 'Operations Lead',
  email: 'mia.rodriguez@thefoundry.example',
  soundAlerts: true,
  desktopNotifications: false,
  toastDurationSeconds: 3,
};

/**
 * User-facing settings for the operator signed in on this device.
 *
 * Persists to localStorage so a refresh keeps theme + profile + notification
 * preferences. Theme changes are applied by setting a data-theme attribute
 * on <html>, which styles.css reads to override the media-query-driven
 * default palette.
 */
@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly _theme = signal<ThemePreference>(DEFAULTS.theme);
  private readonly _displayName = signal<string>(DEFAULTS.displayName);
  private readonly _callSign = signal<string>(DEFAULTS.callSign);
  private readonly _role = signal<string>(DEFAULTS.role);
  private readonly _email = signal<string>(DEFAULTS.email);
  private readonly _soundAlerts = signal<boolean>(DEFAULTS.soundAlerts);
  private readonly _desktopNotifications = signal<boolean>(
    DEFAULTS.desktopNotifications,
  );
  private readonly _toastDurationSeconds = signal<number>(
    DEFAULTS.toastDurationSeconds,
  );

  readonly theme = this._theme.asReadonly();
  readonly displayName = this._displayName.asReadonly();
  readonly callSign = this._callSign.asReadonly();
  readonly role = this._role.asReadonly();
  readonly email = this._email.asReadonly();
  readonly soundAlerts = this._soundAlerts.asReadonly();
  readonly desktopNotifications = this._desktopNotifications.asReadonly();
  readonly toastDurationSeconds = this._toastDurationSeconds.asReadonly();

  constructor() {
    this.load();

    effect(() => {
      this.applyTheme(this._theme());
    });

    effect(() => {
      this.persist({
        theme: this._theme(),
        displayName: this._displayName(),
        callSign: this._callSign(),
        role: this._role(),
        email: this._email(),
        soundAlerts: this._soundAlerts(),
        desktopNotifications: this._desktopNotifications(),
        toastDurationSeconds: this._toastDurationSeconds(),
      });
    });
  }

  setTheme(value: ThemePreference): void {
    this._theme.set(value);
  }

  setDisplayName(value: string): void {
    this._displayName.set(value);
  }

  setCallSign(value: string): void {
    this._callSign.set(value);
  }

  setRole(value: string): void {
    this._role.set(value);
  }

  setEmail(value: string): void {
    this._email.set(value);
  }

  setSoundAlerts(value: boolean): void {
    this._soundAlerts.set(value);
  }

  setDesktopNotifications(value: boolean): void {
    this._desktopNotifications.set(value);
  }

  setToastDurationSeconds(value: number): void {
    const clamped = Math.max(1, Math.min(10, Math.round(value)));
    this._toastDurationSeconds.set(clamped);
  }

  resetToDefaults(): void {
    this._theme.set(DEFAULTS.theme);
    this._displayName.set(DEFAULTS.displayName);
    this._callSign.set(DEFAULTS.callSign);
    this._role.set(DEFAULTS.role);
    this._email.set(DEFAULTS.email);
    this._soundAlerts.set(DEFAULTS.soundAlerts);
    this._desktopNotifications.set(DEFAULTS.desktopNotifications);
    this._toastDurationSeconds.set(DEFAULTS.toastDurationSeconds);
  }

  private applyTheme(theme: ThemePreference): void {
    if (typeof document === 'undefined') return;
    const html = document.documentElement;
    if (theme === 'system') {
      html.removeAttribute('data-theme');
    } else {
      html.setAttribute('data-theme', theme);
    }
  }

  private load(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<PersistedSettings>;
      if (parsed.theme === 'system' || parsed.theme === 'light' || parsed.theme === 'dark') {
        this._theme.set(parsed.theme);
      }
      if (typeof parsed.displayName === 'string') this._displayName.set(parsed.displayName);
      if (typeof parsed.callSign === 'string') this._callSign.set(parsed.callSign);
      if (typeof parsed.role === 'string') this._role.set(parsed.role);
      if (typeof parsed.email === 'string') this._email.set(parsed.email);
      if (typeof parsed.soundAlerts === 'boolean') this._soundAlerts.set(parsed.soundAlerts);
      if (typeof parsed.desktopNotifications === 'boolean')
        this._desktopNotifications.set(parsed.desktopNotifications);
      if (typeof parsed.toastDurationSeconds === 'number')
        this._toastDurationSeconds.set(parsed.toastDurationSeconds);
    } catch {
      // Corrupt settings — ignore and use defaults.
    }
  }

  private persist(value: PersistedSettings): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    } catch {
      // Storage disabled / quota exceeded — non-fatal.
    }
  }
}
