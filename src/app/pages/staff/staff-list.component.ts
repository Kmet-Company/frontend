import { FormsModule } from '@angular/forms';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';

import { ToastComponent } from '../../components/toast/toast.component';
import { AlertsService } from '../../services/alerts.service';
import { StaffMember, StaffRole } from '../../models/venue.models';

interface RoleMeta {
  label: string;
  icon: string;
  tone: 'primary' | 'secondary' | 'error' | 'neutral';
}

const ROLE_META: Record<StaffRole, RoleMeta> = {
  security: { label: 'Security', icon: 'local_police', tone: 'error' },
  medic: { label: 'Medic', icon: 'medical_services', tone: 'error' },
  dispatcher: { label: 'Dispatcher', icon: 'headset_mic', tone: 'primary' },
  floor_lead: { label: 'Floor Lead', icon: 'supervisor_account', tone: 'primary' },
  manager: { label: 'Manager', icon: 'verified_user', tone: 'primary' },
  bar_staff: { label: 'Bar Staff', icon: 'local_bar', tone: 'secondary' },
  door_staff: { label: 'Door Staff', icon: 'door_front', tone: 'secondary' },
};

interface AddForm {
  name: string;
  email: string;
  password: string;
  repeatPassword: string;
  role: StaffRole;
  phone: string;
}

const EMPTY_FORM: AddForm = {
  name: '',
  email: '',
  password: '',
  repeatPassword: '',
  role: 'security',
  phone: '',
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Component({
  selector: 'va-staff-list',
  standalone: true,
  imports: [FormsModule, ToastComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="h-full overflow-y-auto bg-surface">
      <div class="max-w-[1400px] mx-auto px-6 md:px-8 py-8 space-y-6">
        <header class="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div
              class="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant"
            >
              Teams · Roster
            </div>
            <h1
              class="text-3xl font-extrabold tracking-tightest text-on-surface mt-1"
            >
              Staff Roster
            </h1>
            <p class="text-sm text-on-surface-variant mt-1 max-w-2xl">
              Everyone on the team. Add new members and view their access QR
              codes.
            </p>
          </div>
        </header>

        <!-- Filters + add -->
        <div
          class="bg-surface-container rounded-xl p-4 flex flex-wrap items-center gap-3"
        >
          <div class="relative flex-1 min-w-[220px]">
            <span
              class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]"
              >search</span
            >
            <input
              type="search"
              [ngModel]="query()"
              (ngModelChange)="query.set($event)"
              placeholder="Search name, email, phone..."
              class="w-full h-10 pl-10 pr-3 rounded-lg bg-surface-container-lowest text-sm text-on-surface placeholder:text-on-surface-variant/60 outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <select
            [ngModel]="roleFilter()"
            (ngModelChange)="roleFilter.set($event)"
            class="h-10 px-3 rounded-lg bg-surface-container-lowest text-sm text-on-surface outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">All roles</option>
            @for (r of roleValues; track r) {
              <option [value]="r">{{ meta(r).label }}</option>
            }
          </select>

          <button
            type="button"
            (click)="openAdd()"
            class="inline-flex items-center gap-1.5 px-3 h-10 rounded-lg bg-primary text-on-primary text-xs font-semibold hover:brightness-110 transition-all"
          >
            <span class="material-symbols-outlined text-[16px]">person_add</span>
            Add staff
          </button>
        </div>

        <!-- Table -->
        <div class="bg-surface-container rounded-xl overflow-hidden">
          <div
            class="grid grid-cols-[1.5fr_1.6fr_140px_160px_110px] items-center gap-4 px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant bg-surface-container-high/60"
          >
            <span>Name</span>
            <span>Email</span>
            <span>Role</span>
            <span>Phone</span>
            <span class="text-right">QR Code</span>
          </div>

          @if (filtered().length === 0) {
            <div class="p-8 text-center text-sm text-on-surface-variant">
              <span class="material-symbols-outlined text-3xl text-primary"
                >group</span
              >
              <div class="mt-2 font-semibold text-on-surface">
                No staff match your filters
              </div>
              <div class="text-xs mt-1">
                Try clearing the search or switching role.
              </div>
            </div>
          }

          @for (item of filtered(); track item.id) {
            <div
              class="grid grid-cols-[1.5fr_1.6fr_140px_160px_110px] items-center gap-4 px-5 py-3 text-sm hover:bg-surface-container-high transition-colors border-t border-outline-variant/30"
            >
              <div class="flex items-center gap-3 min-w-0">
                <div
                  class="flex-shrink-0 w-9 h-9 rounded-full bg-surface-container-highest text-on-surface flex items-center justify-center text-xs font-bold"
                >
                  {{ initials(item.name) }}
                </div>
                <div class="font-semibold text-on-surface truncate">
                  {{ item.name }}
                </div>
              </div>

              <span class="text-on-surface-variant text-xs truncate">
                {{ item.email || '—' }}
              </span>

              <span class="chip" [class]="roleChipClass(item.role)">
                <span class="material-symbols-outlined text-[12px]">{{
                  meta(item.role).icon
                }}</span>
                {{ meta(item.role).label }}
              </span>

              <span class="text-on-surface-variant text-xs font-mono truncate">
                {{ item.phone }}
              </span>

              <div class="flex items-center justify-end">
                <button
                  type="button"
                  (click)="openQr(item)"
                  class="inline-flex items-center gap-1.5 px-2.5 h-8 rounded-md bg-surface-container-highest text-on-surface text-xs font-semibold hover:bg-primary hover:text-on-primary transition-colors"
                  title="Show QR code"
                >
                  <span class="material-symbols-outlined text-[14px]"
                    >qr_code_2</span
                  >
                  QR
                </button>
              </div>
            </div>
          }
        </div>
      </div>

      <!-- Add staff modal -->
      @if (addOpen()) {
        <div
          class="fixed inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in"
          (click)="closeAdd()"
        >
          <div
            class="bg-surface-container rounded-2xl w-full max-w-md mx-4 p-6 shadow-xl"
            (click)="$event.stopPropagation()"
            role="dialog"
            aria-labelledby="add-staff-title"
          >
            <div class="flex items-start justify-between mb-4">
              <div>
                <h2
                  id="add-staff-title"
                  class="text-lg font-bold text-on-surface"
                >
                  Add staff member
                </h2>
                <p class="text-xs text-on-surface-variant mt-0.5">
                  They'll appear immediately on the roster.
                </p>
              </div>
              <button
                type="button"
                (click)="closeAdd()"
                class="w-8 h-8 rounded-md flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors"
                aria-label="Close"
              >
                <span class="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <form (ngSubmit)="submitAdd()" class="space-y-3">
              <label class="block">
                <span
                  class="text-[11px] font-semibold uppercase tracking-widest text-on-surface-variant"
                  >Name</span
                >
                <input
                  type="text"
                  name="name"
                  [ngModel]="form().name"
                  (ngModelChange)="patch({ name: $event })"
                  required
                  placeholder="Full name"
                  class="mt-1 w-full h-10 px-3 rounded-lg bg-surface-container-lowest text-sm text-on-surface outline-none focus:ring-1 focus:ring-primary"
                />
              </label>

              <label class="block">
                <span
                  class="text-[11px] font-semibold uppercase tracking-widest text-on-surface-variant"
                  >Email</span
                >
                <input
                  type="email"
                  name="email"
                  [ngModel]="form().email"
                  (ngModelChange)="patch({ email: $event })"
                  required
                  placeholder="name@example.com"
                  class="mt-1 w-full h-10 px-3 rounded-lg bg-surface-container-lowest text-sm text-on-surface outline-none focus:ring-1 focus:ring-primary"
                />
              </label>

              <div class="grid grid-cols-2 gap-3">
                <label class="block">
                  <span
                    class="text-[11px] font-semibold uppercase tracking-widest text-on-surface-variant"
                    >Password</span
                  >
                  <input
                    type="password"
                    name="password"
                    [ngModel]="form().password"
                    (ngModelChange)="patch({ password: $event })"
                    required
                    placeholder="••••••••"
                    class="mt-1 w-full h-10 px-3 rounded-lg bg-surface-container-lowest text-sm text-on-surface outline-none focus:ring-1 focus:ring-primary"
                  />
                </label>

                <label class="block">
                  <span
                    class="text-[11px] font-semibold uppercase tracking-widest text-on-surface-variant"
                    >Repeat password</span
                  >
                  <input
                    type="password"
                    name="repeatPassword"
                    [ngModel]="form().repeatPassword"
                    (ngModelChange)="patch({ repeatPassword: $event })"
                    required
                    placeholder="••••••••"
                    class="mt-1 w-full h-10 px-3 rounded-lg bg-surface-container-lowest text-sm text-on-surface outline-none focus:ring-1 focus:ring-primary"
                  />
                </label>
              </div>

              @if (passwordMismatch()) {
                <div class="text-xs text-error">Passwords do not match.</div>
              }

              <div class="grid grid-cols-2 gap-3">
                <label class="block">
                  <span
                    class="text-[11px] font-semibold uppercase tracking-widest text-on-surface-variant"
                    >Role</span
                  >
                  <select
                    name="role"
                    [ngModel]="form().role"
                    (ngModelChange)="patch({ role: $event })"
                    class="mt-1 w-full h-10 px-3 rounded-lg bg-surface-container-lowest text-sm text-on-surface outline-none focus:ring-1 focus:ring-primary"
                  >
                    @for (r of roleValues; track r) {
                      <option [value]="r">{{ meta(r).label }}</option>
                    }
                  </select>
                </label>

                <label class="block">
                  <span
                    class="text-[11px] font-semibold uppercase tracking-widest text-on-surface-variant"
                    >Phone</span
                  >
                  <input
                    type="tel"
                    name="phone"
                    [ngModel]="form().phone"
                    (ngModelChange)="patch({ phone: $event })"
                    required
                    placeholder="+386 ..."
                    class="mt-1 w-full h-10 px-3 rounded-lg bg-surface-container-lowest text-sm text-on-surface outline-none focus:ring-1 focus:ring-primary"
                  />
                </label>
              </div>

              <div class="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  (click)="closeAdd()"
                  class="px-3 h-10 rounded-lg border border-outline-variant bg-transparent text-on-surface text-sm font-semibold hover:bg-surface-container-highest hover:border-outline transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  [disabled]="!canSubmit()"
                  class="inline-flex items-center gap-1.5 px-3 h-10 rounded-lg bg-primary text-on-primary text-sm font-semibold hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span class="material-symbols-outlined text-[16px]"
                    >person_add</span
                  >
                  Add to roster
                </button>
              </div>
            </form>
          </div>
        </div>
      }

      <!-- QR code modal -->
      @if (qrTarget(); as target) {
        <div
          class="fixed inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in"
          (click)="closeQr()"
        >
          <div
            class="bg-surface-container rounded-2xl w-full max-w-sm mx-4 p-6 shadow-xl"
            (click)="$event.stopPropagation()"
            role="dialog"
            aria-labelledby="qr-title"
          >
            <div class="flex items-start justify-between mb-4">
              <div>
                <h2 id="qr-title" class="text-lg font-bold text-on-surface">
                  {{ target.name }}
                </h2>
                <p class="text-xs text-on-surface-variant mt-0.5">
                  Staff access QR code
                </p>
              </div>
              <button
                type="button"
                (click)="closeQr()"
                class="w-8 h-8 rounded-md flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors"
                aria-label="Close"
              >
                <span class="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div class="flex flex-col items-center gap-3">
              <div class="bg-white rounded-xl p-4">
                <img
                  [src]="qrImageUrl(target)"
                  [alt]="target.name + ' QR code'"
                  width="260"
                  height="260"
                  class="block"
                />
              </div>
              <code
                class="text-[11px] text-on-surface-variant break-all text-center font-mono"
                >{{ qrPayload(target) }}</code
              >
            </div>
          </div>
        </div>
      }

      <va-toast />
    </section>
  `,
})
export class StaffListComponent {
  protected readonly alerts = inject(AlertsService);

  protected readonly roleFilter = signal<StaffRole | 'all'>('all');
  protected readonly query = signal<string>('');

  protected readonly addOpen = signal<boolean>(false);
  protected readonly form = signal<AddForm>({ ...EMPTY_FORM });
  protected readonly qrTarget = signal<StaffMember | null>(null);

  protected readonly roleValues = Object.keys(ROLE_META) as StaffRole[];

  protected readonly filtered = computed<StaffMember[]>(() => {
    const role = this.roleFilter();
    const q = this.query().trim().toLowerCase();

    return [...this.alerts.staff()]
      .sort((a, b) => a.name.localeCompare(b.name))
      .filter((item) => {
        if (role !== 'all' && item.role !== role) return false;
        if (!q) return true;
        return (
          item.name.toLowerCase().includes(q) ||
          (item.email ?? '').toLowerCase().includes(q) ||
          item.phone.toLowerCase().includes(q)
        );
      });
  });

  protected readonly passwordMismatch = computed(() => {
    const f = this.form();
    return (
      f.repeatPassword.length > 0 && f.password !== f.repeatPassword
    );
  });

  protected readonly canSubmit = computed(() => {
    const f = this.form();
    return (
      f.name.trim().length > 1 &&
      EMAIL_RE.test(f.email.trim()) &&
      f.password.length > 0 &&
      f.password === f.repeatPassword &&
      f.phone.trim().length > 0
    );
  });

  protected meta(role: StaffRole): RoleMeta {
    return ROLE_META[role];
  }

  protected initials(name: string): string {
    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('');
  }

  protected roleChipClass(role: StaffRole): string {
    switch (this.meta(role).tone) {
      case 'error':
        return 'bg-error-container text-on-error-container';
      case 'secondary':
        return 'bg-secondary-container text-on-secondary-container';
      case 'primary':
        return 'bg-primary-container text-on-primary-container';
      default:
        return 'bg-surface-container-highest text-on-surface-variant';
    }
  }

  protected openAdd(): void {
    this.form.set({ ...EMPTY_FORM });
    this.addOpen.set(true);
  }

  protected closeAdd(): void {
    this.addOpen.set(false);
  }

  protected patch(partial: Partial<AddForm>): void {
    this.form.set({ ...this.form(), ...partial });
  }

  protected submitAdd(): void {
    if (!this.canSubmit()) return;
    const f = this.form();
    const member = this.alerts.addStaff({
      name: f.name.trim(),
      email: f.email.trim(),
      role: f.role,
      phone: f.phone.trim(),
    });
    this.closeAdd();
    this.qrTarget.set(member);
  }

  protected openQr(member: StaffMember): void {
    this.qrTarget.set(member);
  }

  protected closeQr(): void {
    this.qrTarget.set(null);
  }

  protected qrPayload(member: StaffMember): string {
    return `${member.name}::${member.email ?? ''}::staff`;
  }

  protected qrImageUrl(member: StaffMember): string {
    const data = encodeURIComponent(this.qrPayload(member));
    return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=0&data=${data}`;
  }
}
