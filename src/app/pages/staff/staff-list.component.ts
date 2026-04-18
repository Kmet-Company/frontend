import { DatePipe } from '@angular/common';
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
import {
  StaffMember,
  StaffRole,
  StaffStatus,
} from '../../models/venue.models';

type StatusFilter = 'all' | StaffStatus;

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
  role: StaffRole;
  zone: string;
  phone: string;
  status: StaffStatus;
  callSign: string;
}

const EMPTY_FORM: AddForm = {
  name: '',
  role: 'security',
  zone: '',
  phone: '',
  status: 'on_shift',
  callSign: '',
};

@Component({
  selector: 'va-staff-list',
  standalone: true,
  imports: [DatePipe, FormsModule, ToastComponent],
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
              Everyone working this shift. Add or remove team members and track
              who's currently available on the floor.
            </p>
          </div>

          <div
            class="flex items-center gap-1 px-3 h-10 rounded-lg bg-surface-container text-xs"
          >
            <span class="w-2 h-2 rounded-full bg-primary animate-soft-pulse"></span>
            <span
              class="font-semibold text-on-surface-variant tracking-wider uppercase"
            >
              {{ alerts.staffOnShiftCount() }} on shift ·
              {{ alerts.staffOnBreakCount() }} on break
            </span>
          </div>
        </header>

        <!-- Stat tiles -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
          @for (tile of tiles(); track tile.label) {
            <div class="bg-surface-container rounded-xl p-4">
              <div
                class="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant"
              >
                <span class="w-1.5 h-1.5 rounded-full" [class]="tile.dot"></span>
                {{ tile.label }}
              </div>
              <div
                class="text-2xl font-extrabold tracking-tightest text-on-surface mt-2"
              >
                {{ tile.value }}
              </div>
              <div class="text-[11px] text-on-surface-variant mt-0.5">
                {{ tile.hint }}
              </div>
            </div>
          }
        </div>

        <!-- Filters + add -->
        <div
          class="bg-surface-container rounded-xl p-4 flex flex-wrap items-center gap-3"
        >
          <div
            class="flex items-center gap-1 bg-surface-container-high rounded-lg p-1 flex-wrap"
          >
            @for (option of statusOptions; track option.value) {
              <button
                type="button"
                (click)="statusFilter.set(option.value)"
                [class]="statusButtonClass(option.value)"
              >
                {{ option.label }}
              </button>
            }
          </div>

          <div class="relative flex-1 min-w-[220px]">
            <span
              class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]"
              >search</span
            >
            <input
              type="search"
              [ngModel]="query()"
              (ngModelChange)="query.set($event)"
              placeholder="Search name, zone, phone..."
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
            class="grid grid-cols-[1.8fr_130px_1fr_140px_130px_110px_80px] items-center gap-4 px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant bg-surface-container-high/60"
          >
            <span>Member</span>
            <span>Role</span>
            <span>Zone</span>
            <span>Phone</span>
            <span>Shift start</span>
            <span>Status</span>
            <span class="text-right">Actions</span>
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
                Try clearing the search or switching status.
              </div>
            </div>
          }

          @for (item of filtered(); track item.id) {
            <div
              class="grid grid-cols-[1.8fr_130px_1fr_140px_130px_110px_80px] items-center gap-4 px-5 py-3 text-sm hover:bg-surface-container-high transition-colors border-t border-outline-variant/30"
            >
              <div class="flex items-center gap-3 min-w-0">
                <div
                  class="flex-shrink-0 w-9 h-9 rounded-full bg-surface-container-highest text-on-surface flex items-center justify-center text-xs font-bold"
                >
                  {{ initials(item.name) }}
                </div>
                <div class="min-w-0">
                  <div class="font-semibold text-on-surface truncate">
                    {{ item.name }}
                  </div>
                  @if (item.callSign) {
                    <div
                      class="text-[11px] text-on-surface-variant truncate font-mono"
                    >
                      {{ item.callSign }}
                    </div>
                  }
                </div>
              </div>

              <span class="chip" [class]="roleChipClass(item.role)">
                <span class="material-symbols-outlined text-[12px]">{{
                  meta(item.role).icon
                }}</span>
                {{ meta(item.role).label }}
              </span>

              <span class="text-on-surface truncate flex items-center gap-1">
                <span
                  class="material-symbols-outlined text-[14px] text-on-surface-variant"
                  >location_on</span
                >
                <span class="truncate">{{ item.zone }}</span>
              </span>

              <span class="text-on-surface-variant text-xs font-mono truncate">
                {{ item.phone }}
              </span>

              <span class="text-xs text-on-surface-variant">
                @if (item.shiftStart) {
                  <span [title]="item.shiftStart | date: 'medium'">
                    {{ item.shiftStart | date: 'shortTime' }}
                  </span>
                } @else {
                  <span class="text-on-surface-variant/60">—</span>
                }
              </span>

              <div class="relative">
                <select
                  [ngModel]="item.status"
                  (ngModelChange)="onStatusChange(item.id, $event)"
                  [class]="statusSelectClass(item.status)"
                >
                  <option value="on_shift">On shift</option>
                  <option value="on_break">On break</option>
                  <option value="off_shift">Off shift</option>
                </select>
              </div>

              <div class="flex items-center justify-end">
                <button
                  type="button"
                  (click)="askRemove(item)"
                  class="inline-flex items-center justify-center w-8 h-8 rounded-md text-on-surface-variant hover:text-error hover:bg-error-container/50 transition-colors"
                  title="Remove from roster"
                  aria-label="Remove from roster"
                >
                  <span class="material-symbols-outlined text-[18px]"
                    >delete</span
                  >
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
                    >Initial status</span
                  >
                  <select
                    name="status"
                    [ngModel]="form().status"
                    (ngModelChange)="patch({ status: $event })"
                    class="mt-1 w-full h-10 px-3 rounded-lg bg-surface-container-lowest text-sm text-on-surface outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="on_shift">On shift</option>
                    <option value="on_break">On break</option>
                    <option value="off_shift">Off shift</option>
                  </select>
                </label>
              </div>

              <label class="block">
                <span
                  class="text-[11px] font-semibold uppercase tracking-widest text-on-surface-variant"
                  >Assigned zone</span
                >
                <input
                  type="text"
                  name="zone"
                  [ngModel]="form().zone"
                  (ngModelChange)="patch({ zone: $event })"
                  required
                  placeholder="e.g. Main Bar"
                  class="mt-1 w-full h-10 px-3 rounded-lg bg-surface-container-lowest text-sm text-on-surface outline-none focus:ring-1 focus:ring-primary"
                />
              </label>

              <div class="grid grid-cols-2 gap-3">
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

                <label class="block">
                  <span
                    class="text-[11px] font-semibold uppercase tracking-widest text-on-surface-variant"
                    >Call sign
                    <span class="text-on-surface-variant/60 normal-case">(optional)</span></span
                  >
                  <input
                    type="text"
                    name="callSign"
                    [ngModel]="form().callSign"
                    (ngModelChange)="patch({ callSign: $event })"
                    placeholder="Unit 14"
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

      <!-- Remove confirmation -->
      @if (removeTarget(); as target) {
        <div
          class="fixed inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in"
          (click)="cancelRemove()"
        >
          <div
            class="bg-surface-container rounded-2xl w-full max-w-sm mx-4 p-6 shadow-xl"
            (click)="$event.stopPropagation()"
            role="alertdialog"
          >
            <div class="flex items-center gap-3">
              <div
                class="w-10 h-10 rounded-full bg-error-container text-on-error-container flex items-center justify-center"
              >
                <span class="material-symbols-outlined text-[22px]"
                  >person_remove</span
                >
              </div>
              <div>
                <h2 class="text-base font-bold text-on-surface">
                  Remove {{ target.name }}?
                </h2>
                <p class="text-xs text-on-surface-variant mt-0.5">
                  They'll be removed from the roster and won't receive
                  dispatches.
                </p>
              </div>
            </div>

            <div class="flex items-center justify-end gap-2 mt-5">
              <button
                type="button"
                (click)="cancelRemove()"
                class="px-3 h-9 rounded-lg border border-outline-variant bg-transparent text-on-surface text-xs font-semibold hover:bg-surface-container-highest hover:border-outline transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                (click)="confirmRemove()"
                class="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg bg-error text-on-error text-xs font-semibold hover:brightness-110 transition-all"
              >
                <span class="material-symbols-outlined text-[14px]">delete</span>
                Remove
              </button>
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

  protected readonly statusFilter = signal<StatusFilter>('all');
  protected readonly roleFilter = signal<StaffRole | 'all'>('all');
  protected readonly query = signal<string>('');

  protected readonly addOpen = signal<boolean>(false);
  protected readonly form = signal<AddForm>({ ...EMPTY_FORM });
  protected readonly removeTarget = signal<StaffMember | null>(null);

  protected readonly roleValues = Object.keys(ROLE_META) as StaffRole[];

  protected readonly statusOptions: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'on_shift', label: 'On shift' },
    { value: 'on_break', label: 'On break' },
    { value: 'off_shift', label: 'Off shift' },
  ];

  protected readonly filtered = computed<StaffMember[]>(() => {
    const status = this.statusFilter();
    const role = this.roleFilter();
    const q = this.query().trim().toLowerCase();

    return [...this.alerts.staff()]
      .sort((a, b) => {
        const order: Record<StaffStatus, number> = {
          on_shift: 0,
          on_break: 1,
          off_shift: 2,
        };
        const diff = order[a.status] - order[b.status];
        if (diff !== 0) return diff;
        return a.name.localeCompare(b.name);
      })
      .filter((item) => {
        if (status !== 'all' && item.status !== status) return false;
        if (role !== 'all' && item.role !== role) return false;
        if (!q) return true;
        return (
          item.name.toLowerCase().includes(q) ||
          item.zone.toLowerCase().includes(q) ||
          item.phone.toLowerCase().includes(q) ||
          (item.callSign ?? '').toLowerCase().includes(q)
        );
      });
  });

  protected readonly tiles = computed(() => {
    const total = this.alerts.staff().length;
    return [
      {
        label: 'Total',
        value: total,
        hint: 'On the roster',
        dot: 'bg-on-surface-variant',
      },
      {
        label: 'On shift',
        value: this.alerts.staffOnShiftCount(),
        hint: 'Available now',
        dot: 'bg-primary animate-soft-pulse',
      },
      {
        label: 'On break',
        value: this.alerts.staffOnBreakCount(),
        hint: 'Back soon',
        dot: 'bg-secondary',
      },
      {
        label: 'Off shift',
        value: this.alerts.staffOffShiftCount(),
        hint: 'Not working',
        dot: 'bg-on-surface-variant/60',
      },
    ];
  });

  protected readonly canSubmit = computed(() => {
    const f = this.form();
    return (
      f.name.trim().length > 1 &&
      f.zone.trim().length > 0 &&
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

  protected statusButtonClass(value: StatusFilter): string {
    const base = 'px-3 h-8 text-xs font-semibold rounded-md transition-colors';
    return value === this.statusFilter()
      ? `${base} bg-surface-bright text-on-surface`
      : `${base} text-on-surface-variant hover:text-on-surface`;
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

  protected statusSelectClass(status: StaffStatus): string {
    const base =
      'h-8 pl-2.5 pr-7 rounded-md text-[11px] font-semibold uppercase tracking-wider outline-none cursor-pointer transition-colors';
    switch (status) {
      case 'on_shift':
        return `${base} bg-primary-container text-on-primary-container`;
      case 'on_break':
        return `${base} bg-secondary-container text-on-secondary-container`;
      case 'off_shift':
        return `${base} bg-surface-container-highest text-on-surface-variant`;
    }
  }

  protected onStatusChange(id: string, status: StaffStatus): void {
    this.alerts.updateStaffStatus(id, status);
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
    this.alerts.addStaff({
      name: f.name,
      role: f.role,
      zone: f.zone,
      phone: f.phone,
      status: f.status,
      callSign: f.callSign,
    });
    this.closeAdd();
  }

  protected askRemove(member: StaffMember): void {
    this.removeTarget.set(member);
  }

  protected cancelRemove(): void {
    this.removeTarget.set(null);
  }

  protected confirmRemove(): void {
    const target = this.removeTarget();
    if (!target) return;
    this.alerts.removeStaff(target.id);
    this.removeTarget.set(null);
  }
}
