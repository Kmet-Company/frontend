import { Injectable, computed, inject, signal } from '@angular/core';

import { StaffMember, StaffRole } from '../models/venue.models';
import { AuthService } from './auth.service';

// Shape of a user record returned by Keycloak's Admin API.
interface KeycloakUser {
  id: string;
  username: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  enabled?: boolean;
  emailVerified?: boolean;
  attributes?: Record<string, string[]>;
}

interface KeycloakRole {
  id: string;
  name: string;
  description?: string;
  composite?: boolean;
  clientRole?: boolean;
}

// Roles managers can assign. Order = priority when a user has several.
const STAFF_ROLE_PRIORITY: StaffRole[] = [
  'manager',
  'dispatcher',
  'floor_lead',
  'security',
  'medic',
  'door_staff',
  'bar_staff',
];

const STAFF_ROLES: ReadonlySet<StaffRole> = new Set(STAFF_ROLE_PRIORITY);

// Roles Keycloak manages itself and the frontend should ignore.
const KEYCLOAK_INTERNAL_PREFIXES = ['default-roles-', 'offline_access', 'uma_authorization'];

export interface AddStaffInput {
  name: string;
  email: string;
  password: string;
  role: StaffRole;
  phone: string;
}

/**
 * Wraps Keycloak's Admin REST API so the Staff Roster page can treat the
 * IdP as its source of truth. A logged-in user needs at minimum
 * `realm-management.view-users` (wired into the `operator` composite in the
 * realm export) to load the list, and `manage-users` (wired into `manager`)
 * to create or delete members.
 *
 * N+1 role lookup: listing users gives us basic fields; fetching each user's
 * realm roles requires a per-user call. Fine for a venue-sized roster.
 */
@Injectable({ providedIn: 'root' })
export class StaffService {
  private readonly auth = inject(AuthService);

  private readonly _staff = signal<StaffMember[]>([]);
  private readonly _loading = signal<boolean>(false);
  private readonly _error = signal<string | null>(null);

  readonly staff = this._staff.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  /**
   * True if the logged-in user has the manager-level Keycloak permissions
   * needed to create or delete users. Controls visibility of the "Add staff"
   * and "Remove" buttons in the UI.
   */
  readonly canManage = computed<boolean>(() => {
    const roles = this.auth.user()?.roles ?? [];
    return roles.includes('manager') || roles.includes('admin');
  });

  /**
   * Fetch every user in the realm, resolve their realm role assignments,
   * and keep only those carrying a staff role. Called from the roster
   * page on open.
   */
  async refresh(): Promise<void> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const users = await this.api<KeycloakUser[]>(
        'GET',
        '/users?briefRepresentation=false&max=500',
      );

      const withRoles = await Promise.all(
        users.map(async (user) => {
          const roles = await this.api<KeycloakRole[]>(
            'GET',
            `/users/${user.id}/role-mappings/realm`,
          ).catch(() => [] as KeycloakRole[]);
          return this.toStaffMember(user, roles.map((r) => r.name));
        }),
      );

      this._staff.set(
        withRoles
          .filter((m): m is StaffMember => m !== null)
          .sort((a, b) => a.name.localeCompare(b.name)),
      );
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[StaffService] refresh failed', err);
      this._error.set(this.messageFor(err));
      this._staff.set([]);
    } finally {
      this._loading.set(false);
    }
  }

  /**
   * Create a new Keycloak user, set their password, and assign the chosen
   * staff realm role. Returns the StaffMember representation on success.
   */
  async add(input: AddStaffInput): Promise<StaffMember> {
    const [firstName, ...rest] = input.name.trim().split(/\s+/);
    const lastName = rest.join(' ').trim();
    const username = this.usernameFor(input.email);

    const createRes = await this.rawApi('POST', '/users', {
      username,
      email: input.email.trim(),
      firstName: firstName || username,
      lastName: lastName || '',
      enabled: true,
      emailVerified: true,
      attributes: {
        phone: [input.phone.trim()],
      },
      credentials: [
        { type: 'password', value: input.password, temporary: false },
      ],
    });

    // Keycloak returns the new user's ID in the Location header when the
    // browser is allowed to read it; CORS usually strips it, so fall back
    // to looking the user up by username.
    const location = createRes.headers.get('Location') ?? '';
    let userId = location.split('/').pop();
    if (!userId) {
      const matches = await this.api<KeycloakUser[]>(
        'GET',
        `/users?username=${encodeURIComponent(username)}&exact=true`,
      );
      userId = matches[0]?.id;
    }
    if (!userId) {
      throw new Error('Could not resolve the new user id');
    }

    const role = await this.api<KeycloakRole>('GET', `/roles/${input.role}`);
    await this.api('POST', `/users/${userId}/role-mappings/realm`, [
      { id: role.id, name: role.name },
    ]);

    await this.refresh();

    const created = this._staff().find((s) => s.id === userId);
    if (!created) {
      throw new Error('Created user did not appear in refresh');
    }
    return created;
  }

  /**
   * Permanently remove a user from Keycloak. Managers are protected — they
   * must be demoted via the admin console before they can be deleted here.
   */
  async remove(id: string): Promise<void> {
    const target = this._staff().find((s) => s.id === id);
    if (target?.role === 'manager') {
      throw new Error('Managers cannot be removed from the roster');
    }
    await this.api('DELETE', `/users/${id}`);
    this._staff.set(this._staff().filter((s) => s.id !== id));
  }

  // --------------------------------------------------------------------------
  // Internals
  // --------------------------------------------------------------------------

  private async api<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await this.rawApi(method, path, body);
    if (res.status === 204 || res.headers.get('Content-Length') === '0') {
      return undefined as T;
    }
    const text = await res.text();
    return text ? (JSON.parse(text) as T) : (undefined as T);
  }

  private async rawApi(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<Response> {
    const token = await this.auth.token();
    if (!token) {
      throw new Error('Not signed in');
    }
    const { url, realm } = AuthService.config;
    const res = await fetch(`${url}/admin/realms/${realm}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const detail = (await res.text().catch(() => '')).slice(0, 400);
      throw new KeycloakError(res.status, method, path, detail);
    }
    return res;
  }

  private toStaffMember(user: KeycloakUser, roleNames: string[]): StaffMember | null {
    const staffRole = this.pickStaffRole(roleNames);
    if (!staffRole) return null;

    const name =
      [user.firstName, user.lastName].filter(Boolean).join(' ').trim() ||
      user.username;

    return {
      id: user.id,
      name,
      role: staffRole,
      zone: this.attr(user, 'zone') ?? '',
      phone: this.attr(user, 'phone') ?? '',
      email: user.email || undefined,
      status: 'on_shift',
      callSign: this.attr(user, 'callSign') || undefined,
    };
  }

  private pickStaffRole(roleNames: string[]): StaffRole | null {
    const relevant = roleNames.filter(
      (r) =>
        !KEYCLOAK_INTERNAL_PREFIXES.some((p) => r.startsWith(p)) &&
        STAFF_ROLES.has(r as StaffRole),
    ) as StaffRole[];
    for (const candidate of STAFF_ROLE_PRIORITY) {
      if (relevant.includes(candidate)) return candidate;
    }
    return null;
  }

  private attr(user: KeycloakUser, key: string): string | null {
    const value = user.attributes?.[key]?.[0];
    return value ? value.trim() : null;
  }

  private usernameFor(email: string): string {
    return email.split('@')[0].toLowerCase().replace(/[^a-z0-9._-]+/g, '-');
  }

  private messageFor(err: unknown): string {
    if (err instanceof KeycloakError) {
      if (err.status === 401 || err.status === 403) {
        return 'You do not have permission to manage staff.';
      }
      return `${err.method} ${err.path} failed (${err.status})`;
    }
    return err instanceof Error ? err.message : 'Unknown error';
  }
}

class KeycloakError extends Error {
  constructor(
    readonly status: number,
    readonly method: string,
    readonly path: string,
    readonly detail: string,
  ) {
    super(`Keycloak ${method} ${path} -> ${status}${detail ? ': ' + detail : ''}`);
    this.name = 'KeycloakError';
  }
}
