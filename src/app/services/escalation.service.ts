import { Injectable, computed, inject, signal } from '@angular/core';

import { AlertsService } from './alerts.service';

/**
 * Category grouping for escalation actions. Drives the section a card lives in
 * and its visual tone.
 */
export type EscalationCategory =
  | 'emergency'
  | 'internal'
  | 'systems'
  | 'announcements';

/**
 * `one_shot`  – Fire and forget (dispatches, PA announcements, external calls).
 *              Tracks `lastTriggeredAt` so the UI can show "2m ago".
 * `toggle`    – Venue system that has an on/off state (lights, music, fog).
 */
export type EscalationKind = 'one_shot' | 'toggle';

export type EscalationTone = 'error' | 'warning' | 'primary' | 'neutral';

export interface EscalationAction {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly icon: string;
  readonly category: EscalationCategory;
  readonly kind: EscalationKind;
  /** Requires a confirmation dialog before firing. */
  readonly confirm: boolean;
  readonly tone: EscalationTone;
  /**
   * Toggle actions use this for their default system state (true = on at venue open).
   * Ignored for one-shots.
   */
  readonly defaultOn?: boolean;
}

export interface EscalationLogEntry {
  readonly id: string;
  readonly actionId: string;
  readonly actionLabel: string;
  readonly at: Date;
  /**
   * For toggle actions, whether we turned the system on (true) or off (false).
   * Undefined for one-shot actions.
   */
  readonly enabled?: boolean;
  readonly operator: string;
}

const ACTIONS: readonly EscalationAction[] = [
  // --- Emergency services --------------------------------------------------
  {
    id: 'call-police',
    label: 'Call Police',
    description: 'Direct dial to local precinct dispatch.',
    icon: 'local_police',
    category: 'emergency',
    kind: 'one_shot',
    confirm: true,
    tone: 'error',
  },
  {
    id: 'call-ems',
    label: 'Call EMS / Hospital',
    description: 'Request paramedics or medical transport.',
    icon: 'medical_services',
    category: 'emergency',
    kind: 'one_shot',
    confirm: true,
    tone: 'error',
  },
  {
    id: 'call-fire',
    label: 'Call Fire Dept.',
    description: 'Notify fire & rescue services.',
    icon: 'local_fire_department',
    category: 'emergency',
    kind: 'one_shot',
    confirm: true,
    tone: 'error',
  },

  // --- Internal teams ------------------------------------------------------
  {
    id: 'dispatch-security',
    label: 'Dispatch Security',
    description: 'Send nearest security unit to flagged zone.',
    icon: 'security',
    category: 'internal',
    kind: 'one_shot',
    confirm: false,
    tone: 'primary',
  },
  {
    id: 'dispatch-medical',
    label: 'Dispatch Medical Team',
    description: 'Floor medics respond to reported location.',
    icon: 'medical_information',
    category: 'internal',
    kind: 'one_shot',
    confirm: false,
    tone: 'primary',
  },
  {
    id: 'notify-manager',
    label: 'Notify Shift Manager',
    description: 'Push priority alert to the manager on duty.',
    icon: 'supervisor_account',
    category: 'internal',
    kind: 'one_shot',
    confirm: false,
    tone: 'primary',
  },
  {
    id: 'reinforce-door',
    label: 'Reinforce Door Staff',
    description: 'Pull two from rotation to front entrance.',
    icon: 'door_front',
    category: 'internal',
    kind: 'one_shot',
    confirm: false,
    tone: 'primary',
  },

  // --- Venue systems (toggles) --------------------------------------------
  {
    id: 'party-lights',
    label: 'Party Lights',
    description: 'Stage, strobe & color wash rigs.',
    icon: 'party_mode',
    category: 'systems',
    kind: 'toggle',
    confirm: false,
    tone: 'neutral',
    defaultOn: true,
  },
  {
    id: 'house-lights',
    label: 'House / White Lights',
    description: 'Full-venue white lighting for evacuation & first aid.',
    icon: 'lightbulb',
    category: 'systems',
    kind: 'toggle',
    confirm: true,
    tone: 'warning',
    defaultOn: false,
  },
  {
    id: 'music-playback',
    label: 'Music Playback',
    description: 'Main PA music feed. Disable to cut the show.',
    icon: 'music_note',
    category: 'systems',
    kind: 'toggle',
    confirm: true,
    tone: 'warning',
    defaultOn: true,
  },
  {
    id: 'fog-machines',
    label: 'Fog Machines',
    description: 'Haze / fog atmospherics.',
    icon: 'foggy',
    category: 'systems',
    kind: 'toggle',
    confirm: false,
    tone: 'neutral',
    defaultOn: true,
  },

  // --- Announcements -------------------------------------------------------
  {
    id: 'pa-general',
    label: 'General PA Announcement',
    description: 'Broadcast pre-recorded general notice.',
    icon: 'campaign',
    category: 'announcements',
    kind: 'one_shot',
    confirm: false,
    tone: 'primary',
  },
  {
    id: 'pa-medical',
    label: 'Medical Assistance Needed',
    description: 'Request medical personnel over PA.',
    icon: 'health_and_safety',
    category: 'announcements',
    kind: 'one_shot',
    confirm: false,
    tone: 'warning',
  },
  {
    id: 'pa-evacuate',
    label: 'Evacuation Announcement',
    description: 'Trigger full-venue evacuation script.',
    icon: 'directions_run',
    category: 'announcements',
    kind: 'one_shot',
    confirm: true,
    tone: 'error',
  },
];

@Injectable({ providedIn: 'root' })
export class EscalationService {
  private readonly alerts = inject(AlertsService);

  private readonly _systemState = signal<Record<string, boolean>>(
    Object.fromEntries(
      ACTIONS.filter((a) => a.kind === 'toggle').map((a) => [
        a.id,
        !!a.defaultOn,
      ]),
    ),
  );

  private readonly _lastTriggered = signal<Record<string, Date>>({});
  private readonly _log = signal<EscalationLogEntry[]>([]);

  readonly actions: readonly EscalationAction[] = ACTIONS;
  readonly systemState = this._systemState.asReadonly();
  readonly lastTriggered = this._lastTriggered.asReadonly();
  readonly log = this._log.asReadonly();

  readonly actionsByCategory = computed(() => {
    const byCat: Record<EscalationCategory, EscalationAction[]> = {
      emergency: [],
      internal: [],
      systems: [],
      announcements: [],
    };
    for (const action of this.actions) {
      byCat[action.category].push(action);
    }
    return byCat;
  });

  /** Number of venue systems currently in a non-default / elevated state. */
  readonly abnormalSystemCount = computed(() => {
    const state = this._systemState();
    return this.actions
      .filter((a) => a.kind === 'toggle')
      .filter((a) => state[a.id] !== !!a.defaultOn).length;
  });

  isSystemOn(id: string): boolean {
    return !!this._systemState()[id];
  }

  /**
   * Fires a one-shot escalation action. Records the time and logs it.
   * When `opts.alertId` is supplied, a matching entry is appended to that
   * alert's incident timeline so the escalation shows up in the audit trail.
   * Returns true if the action was found and triggered.
   */
  triggerAction(id: string, opts?: { alertId?: string }): boolean {
    const action = this.actions.find((a) => a.id === id);
    if (!action || action.kind !== 'one_shot') return false;

    const now = new Date();
    this._lastTriggered.update((prev) => ({ ...prev, [id]: now }));
    this.appendLog({
      id: `log-${now.getTime()}-${id}`,
      actionId: id,
      actionLabel: action.label,
      at: now,
      operator: 'You',
    });
    this.alerts.showToast(this.toastFor(action, true));

    if (opts?.alertId) {
      this.alerts.addIncidentEvent(opts.alertId, {
        kind: 'escalation',
        title: `Escalation · ${action.label}`,
        description: this.toastFor(action, true),
      });
    }
    return true;
  }

  /**
   * Toggle a venue system on or off. Returns the new state.
   * Attaches a timeline event to the supplied alert when `opts.alertId` is set.
   */
  setSystem(id: string, on: boolean, opts?: { alertId?: string }): boolean {
    const action = this.actions.find((a) => a.id === id);
    if (!action || action.kind !== 'toggle') return this.isSystemOn(id);

    this._systemState.update((prev) => ({ ...prev, [id]: on }));
    const now = new Date();
    this._lastTriggered.update((prev) => ({ ...prev, [id]: now }));
    this.appendLog({
      id: `log-${now.getTime()}-${id}`,
      actionId: id,
      actionLabel: action.label,
      at: now,
      enabled: on,
      operator: 'You',
    });
    this.alerts.showToast(this.toastFor(action, on));

    if (opts?.alertId) {
      this.alerts.addIncidentEvent(opts.alertId, {
        kind: 'escalation',
        title: `Venue system · ${action.label} ${on ? 'ON' : 'OFF'}`,
        description: this.toastFor(action, on),
      });
    }
    return on;
  }

  /** Flip whatever the current state is. */
  toggleSystem(id: string, opts?: { alertId?: string }): boolean {
    return this.setSystem(id, !this.isSystemOn(id), opts);
  }

  private appendLog(entry: EscalationLogEntry): void {
    this._log.update((prev) => [entry, ...prev].slice(0, 40));
  }

  private toastFor(action: EscalationAction, enabledOrTriggered: boolean): string {
    if (action.kind === 'toggle') {
      return `${action.label} turned ${enabledOrTriggered ? 'ON' : 'OFF'}`;
    }
    switch (action.category) {
      case 'emergency':
        return `${action.label} — call placed`;
      case 'internal':
        return `${action.label} — team dispatched`;
      case 'announcements':
        return `${action.label} — broadcasting`;
      default:
        return `${action.label} triggered`;
    }
  }
}
