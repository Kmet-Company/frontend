import { Injectable, computed, inject, signal } from '@angular/core';
import { catchError, of } from 'rxjs';

import {
  AlertSeverity,
  AlertStatus,
  BoundingBox,
  CameraFeed,
  GuestReport,
  GuestReportPriority,
  IncidentEvent,
  ResponseNote,
  RiskLevel,
  StaffMember,
  StaffRole,
  StaffStatus,
  VenueAlert,
} from '../models/venue.models';
import { ApiService } from './api.service';

/**
 * Operational state for the venue safety dashboard.
 *
 * Cameras / alerts / history / guest reports are served by PostgREST. On
 * construction the service fetches each collection once and populates its
 * signals; subsequent writes (confirm / dismiss / escalate / acknowledge /
 * note) are applied optimistically to the signal AND posted to the DB so
 * they survive a refresh.
 *
 * `_staff` is still in-memory because staff identity is managed by Keycloak;
 * the Postgres `staff_presence` table only stores shift + zone by user id
 * and will be wired up once Keycloak is live.
 */
@Injectable({ providedIn: 'root' })
export class AlertsService {
  private readonly api = inject(ApiService);

  private readonly _cameras = signal<CameraFeed[]>([]);
  private readonly _alerts = signal<VenueAlert[]>([]);
  private readonly _history = signal<VenueAlert[]>([]);
  private readonly _guestReports = signal<GuestReport[]>([]);

  private readonly _staff = signal<StaffMember[]>([
    {
      id: 'st-001',
      name: 'Officer Miller',
      role: 'security',
      zone: 'Bar Area',
      phone: '+386 41 220 014',
      status: 'on_shift',
      shiftStart: this.hoursAgo(3),
      callSign: 'Unit 14',
    },
    {
      id: 'st-002',
      name: 'Officer Chen',
      role: 'security',
      zone: 'North Plaza',
      phone: '+386 41 220 018',
      status: 'on_shift',
      shiftStart: this.hoursAgo(3),
      callSign: 'Unit 04',
    },
    {
      id: 'st-003',
      name: 'R. Okafor',
      role: 'medic',
      zone: 'Dance Floor',
      phone: '+386 41 775 210',
      status: 'on_shift',
      shiftStart: this.hoursAgo(2),
      callSign: 'Medic 02',
    },
    {
      id: 'st-004',
      name: 'Priya Ramaswamy',
      role: 'floor_lead',
      zone: 'Main Stage',
      phone: '+386 41 580 902',
      status: 'on_shift',
      shiftStart: this.hoursAgo(4),
      callSign: 'Floor Lead',
    },
    {
      id: 'st-005',
      name: 'Jamal Khoury',
      role: 'door_staff',
      zone: 'Front Door',
      phone: '+386 41 330 114',
      status: 'on_shift',
      shiftStart: this.hoursAgo(3),
      callSign: 'Gate Supervisor',
    },
    {
      id: 'st-006',
      name: 'Marco Bellini',
      role: 'security',
      zone: 'South Concourse',
      phone: '+386 41 441 702',
      status: 'on_break',
      shiftStart: this.hoursAgo(3),
      callSign: 'Floor Team',
    },
    {
      id: 'st-007',
      name: 'Admin Sarah',
      role: 'dispatcher',
      zone: 'Control Room',
      phone: '+386 41 090 001',
      status: 'on_shift',
      shiftStart: this.hoursAgo(5),
      callSign: 'Dispatch 01',
    },
    {
      id: 'st-008',
      name: 'Noa Perez',
      role: 'manager',
      zone: 'Control Room',
      phone: '+386 41 018 555',
      status: 'on_shift',
      shiftStart: this.hoursAgo(5),
      callSign: 'Shift Manager',
    },
    {
      id: 'st-009',
      name: 'Danny Tran',
      role: 'bar_staff',
      zone: 'Main Bar',
      phone: '+386 41 844 312',
      status: 'on_shift',
      shiftStart: this.hoursAgo(2),
    },
    {
      id: 'st-010',
      name: 'Elena Vidmar',
      role: 'medic',
      zone: 'Medical Room',
      phone: '+386 41 775 222',
      status: 'off_shift',
    },
    {
      id: 'st-011',
      name: 'Luka Novak',
      role: 'security',
      zone: 'VIP Lounge',
      phone: '+386 41 220 099',
      status: 'off_shift',
    },
  ]);

  private readonly _selectedCameraId = signal<string | null>(null);
  private readonly _viewMode = signal<'grid' | 'focus'>('grid');
  private readonly _toast = signal<string | null>(null);
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  readonly cameras = this._cameras.asReadonly();
  readonly alerts = this._alerts.asReadonly();
  readonly history = this._history.asReadonly();
  readonly guestReports = this._guestReports.asReadonly();
  readonly staff = this._staff.asReadonly();
  readonly selectedCameraId = this._selectedCameraId.asReadonly();
  readonly viewMode = this._viewMode.asReadonly();
  readonly toast = this._toast.asReadonly();

  constructor() {
    this.hydrateFromApi();
  }

  /**
   * Initial load of cameras, alerts, history and guest reports from
   * PostgREST. Each request is independent; if one fails the others still
   * populate. Errors are logged but not surfaced in the UI.
   */
  private hydrateFromApi(): void {
    this.api
      .getCameras()
      .pipe(catchError((err) => this.logAndEmpty('getCameras', err)))
      .subscribe((rows) => rows && this._cameras.set(rows));

    this.api
      .getActiveAlerts()
      .pipe(catchError((err) => this.logAndEmpty('getActiveAlerts', err)))
      .subscribe((rows) => rows && this._alerts.set(rows));

    this.api
      .getAlertHistory()
      .pipe(catchError((err) => this.logAndEmpty('getAlertHistory', err)))
      .subscribe((rows) => rows && this._history.set(rows));

    this.api
      .getGuestReports()
      .pipe(catchError((err) => this.logAndEmpty('getGuestReports', err)))
      .subscribe((rows) => rows && this._guestReports.set(rows));
  }

  private logAndEmpty(source: string, err: unknown) {
    // eslint-disable-next-line no-console
    console.warn(`[AlertsService] ${source} failed`, err);
    return of(null);
  }

  readonly staffOnShiftCount = computed(
    () => this._staff().filter((s) => s.status === 'on_shift').length,
  );
  readonly staffOnBreakCount = computed(
    () => this._staff().filter((s) => s.status === 'on_break').length,
  );
  readonly staffOffShiftCount = computed(
    () => this._staff().filter((s) => s.status === 'off_shift').length,
  );

  readonly allIncidents = computed<VenueAlert[]>(() =>
    [...this._alerts(), ...this._history()].sort(
      (a, b) => b.detectedAt.getTime() - a.detectedAt.getTime(),
    ),
  );

  readonly activeAlertCount = computed(
    () => this._alerts().filter((a) => a.status === 'active').length,
  );

  readonly criticalAlertCount = computed(
    () =>
      this._alerts().filter(
        (a) => a.status === 'active' && a.severity === 'critical',
      ).length,
  );

  readonly boundingBoxesByCamera = computed(() => {
    const map = new Map<string, BoundingBox[]>();
    for (const alert of this._alerts()) {
      if (alert.status !== 'active' || !alert.boundingBox) continue;
      const list = map.get(alert.cameraId) ?? [];
      list.push(alert.boundingBox);
      map.set(alert.cameraId, list);
    }
    return map;
  });

  readonly newGuestReportCount = computed(
    () => this._guestReports().filter((r) => r.status === 'new').length,
  );

  readonly activeGuestReports = computed(() =>
    this._guestReports().filter((r) => r.status !== 'resolved'),
  );

  readonly activeAlertCameras = computed(
    () =>
      new Set(
        this._alerts()
          .filter((a) => a.status === 'active' && a.severity !== 'info')
          .map((a) => a.cameraId),
      ),
  );

  getIncident(id: string): VenueAlert | undefined {
    return (
      this._alerts().find((a) => a.id === id) ??
      this._history().find((a) => a.id === id)
    );
  }

  getGuestReport(id: string): GuestReport | undefined {
    return this._guestReports().find((r) => r.id === id);
  }

  relatedIncidents(incident: VenueAlert, limit = 3): VenueAlert[] {
    return this.allIncidents()
      .filter(
        (other) => other.id !== incident.id && other.zone === incident.zone,
      )
      .slice(0, limit);
  }

  selectCamera(cameraId: string): void {
    this._selectedCameraId.set(cameraId);
  }

  clearCameraSelection(): void {
    this._selectedCameraId.set(null);
  }

  setViewMode(mode: 'grid' | 'focus'): void {
    this._viewMode.set(mode);
  }

  /** Called when the logo is clicked — drops the user back on the
   *  default "scanning the room" view regardless of where they were. */
  resetDashboardView(): void {
    this._viewMode.set('grid');
    this._selectedCameraId.set(null);
  }

  focusAlert(alert: VenueAlert): void {
    this._selectedCameraId.set(alert.cameraId);
  }

  confirmAlert(alert: VenueAlert): void {
    this.updateStatus(alert.id, 'confirmed', {
      kind: 'confirmation',
      title: 'Marked as confirmed',
      description: 'Floor team notified via dispatch channel.',
    });
    this.showToast('Security team notified');
  }

  dismissAlert(alert: VenueAlert): void {
    this.updateStatus(alert.id, 'dismissed', {
      kind: 'note',
      title: 'Dismissed by operator',
      description: 'Operator marked the alert as a false positive.',
    });
    this.showToast('Alert dismissed');
  }

  escalateAlert(alert: VenueAlert): void {
    this.updateStatus(alert.id, 'escalated', {
      kind: 'escalation',
      title: 'Escalated to shift manager',
      description: 'Shift manager has been paged for review.',
    });
    this.showToast('Escalated to shift manager');
  }

  resolveIncident(id: string): void {
    this.updateStatus(id, 'resolved', {
      kind: 'resolution',
      title: 'Marked as resolved',
      description: 'Incident closed out by operator.',
    });
    this.showToast('Incident marked resolved');
  }

  requestBackup(id: string): void {
    const event: IncidentEvent = {
      at: new Date(),
      kind: 'dispatch',
      title: 'Backup requested',
      description: 'Additional floor team dispatched to location.',
    };
    this.appendEvent(id, event);
    this.persistEvent(id, event);
    this.showToast('Backup requested');
  }

  addNote(id: string, author: string, text: string): void {
    const trimmed = text.trim();
    if (!trimmed) return;

    const note: ResponseNote = {
      author,
      at: new Date(),
      text: trimmed,
      kind: 'note',
    };
    const applyNote = (list: VenueAlert[]): VenueAlert[] =>
      list.map((item) =>
        item.id === id ? { ...item, notes: [...item.notes, note] } : item,
      );
    this._alerts.set(applyNote(this._alerts()));
    this._history.set(applyNote(this._history()));

    this.api
      .addAlertNote(id, { author, text: trimmed, kind: 'note' })
      .pipe(catchError((err) => this.logAndEmpty('addAlertNote', err)))
      .subscribe();

    this.showToast('Note added to response log');
  }

  /**
   * Acknowledging a guest report promotes it into a full active alert so it
   * shows up alongside operator-visible incidents. Three writes land in the
   * DB: a new `alert` row (source=guest_report), a `confirmation` event on
   * that alert, and a patch on the original `guest_report` to mark it
   * resolved + link it back to the new alert.
   *
   * The return value exists for API symmetry — existing callers ignore it.
   */
  acknowledgeGuestReport(id: string): VenueAlert | null {
    const report = this._guestReports().find((r) => r.id === id);
    if (!report || report.status === 'resolved') return null;

    const now = new Date();
    const tempId = `pending-${report.id}`;
    // Promoted alerts keep the guest report's reference (e.g. "GR-8421")
    // so operators can trace an alert back to the mobile submission.
    const alertReference = report.reference;
    const promotedTitle = `Guest report: ${report.title}`;
    const severity = this.severityFromPriority(report.priority);
    const risk = this.riskFromPriority(report.priority);

    const newAlert: VenueAlert = {
      id: tempId,
      reference: alertReference,
      title: promotedTitle,
      description: report.message,
      severity,
      risk,
      confidence: 70,
      location: report.location,
      zone: report.location,
      cameraId: this.cameras()[0]?.id ?? '',
      detectedAt: report.submittedAt,
      previewUrl: '',
      status: 'active',
      handledBy: undefined,
      events: [
        {
          at: report.submittedAt,
          kind: 'detection',
          title: 'Guest submitted report',
          description: `${report.guestHandle} reported: "${report.message}"`,
        },
        {
          at: now,
          kind: 'confirmation',
          title: 'Acknowledged by operator',
          description: `Promoted from guest report ${report.reference} to active alert.`,
        },
      ],
      notes: [],
    };

    // Optimistic local state.
    this._alerts.update((list) => [newAlert, ...list]);
    this.setGuestReportStatusLocal(id, 'resolved');
    this.showToast('Report promoted to active alert');

    // Persist. When the alert POST returns we know its real UUID, so swap
    // the temp id locally and follow up with the event + guest-report patch.
    this.api
      .getDefaultVenueId()
      .subscribe((venueId) => {
        if (!venueId) {
          console.warn('[AlertsService] no venue id available, skipping DB persist');
          return;
        }
        this.api
          .createAlertFromGuestReport({
            venueId,
            reference: alertReference,
            title: promotedTitle,
            description: report.message,
            severity,
            risk,
            confidence: 70,
            location: report.location,
            zone: report.location,
            sourceGuestReportId: report.id,
          })
          .pipe(
            catchError((err) =>
              this.logAndEmpty('createAlertFromGuestReport', err),
            ),
          )
          .subscribe((created) => {
            if (!created) return;

            this._alerts.update((list) =>
              list.map((a) =>
                a.id === tempId ? { ...a, id: created.id } : a,
              ),
            );

            this.api
              .addAlertEvent(created.id, {
                kind: 'confirmation',
                title: 'Acknowledged by operator',
                description: `Promoted from guest report ${report.reference} to active alert.`,
              })
              .pipe(
                catchError((err) =>
                  this.logAndEmpty('addAlertEvent (promotion)', err),
                ),
              )
              .subscribe();

            this.api
              .updateGuestReportStatus(report.id, {
                status: 'resolved',
                promoted_alert_id: created.id,
              })
              .pipe(
                catchError((err) =>
                  this.logAndEmpty('updateGuestReportStatus', err),
                ),
              )
              .subscribe();
          });
      });

    return newAlert;
  }

  /**
   * Dismiss a guest report without promoting it — e.g. duplicate report or
   * non-actionable. The record is archived (status → resolved) in the DB
   * and removed from the open guest-report panel.
   */
  dismissGuestReport(id: string): void {
    const report = this._guestReports().find((r) => r.id === id);
    if (!report) return;

    this.setGuestReportStatusLocal(id, 'resolved');
    this.api
      .updateGuestReportStatus(id, { status: 'resolved' })
      .pipe(catchError((err) => this.logAndEmpty('dismissGuestReport', err)))
      .subscribe();

    this.showToast('Guest report dismissed');
  }

  /**
   * Append a timeline event to an existing alert (active or archived).
   * Persists to the DB. Exposed publicly so sibling services (e.g.
   * EscalationService) can attach their actions to an alert's history.
   */
  addIncidentEvent(alertId: string, event: Omit<IncidentEvent, 'at'>): void {
    const full: IncidentEvent = { ...event, at: new Date() };
    this.appendEvent(alertId, full);
    this.persistEvent(alertId, full);
  }

  private severityFromPriority(priority: GuestReportPriority): AlertSeverity {
    if (priority === 'high') return 'critical';
    if (priority === 'medium') return 'warning';
    return 'info';
  }

  private riskFromPriority(priority: GuestReportPriority): RiskLevel {
    if (priority === 'high') return 'high';
    if (priority === 'medium') return 'medium';
    return 'low';
  }

  addStaff(input: {
    name: string;
    role: StaffRole;
    zone: string;
    phone: string;
    status: StaffStatus;
    callSign?: string;
  }): StaffMember {
    const member: StaffMember = {
      id: `st-${Date.now().toString(36)}`,
      name: input.name.trim(),
      role: input.role,
      zone: input.zone.trim(),
      phone: input.phone.trim(),
      status: input.status,
      callSign: input.callSign?.trim() || undefined,
      shiftStart: input.status === 'off_shift' ? undefined : new Date(),
    };
    this._staff.set([member, ...this._staff()]);
    this.showToast(`${member.name} added to roster`);
    return member;
  }

  removeStaff(id: string): void {
    const target = this._staff().find((s) => s.id === id);
    if (!target) return;
    this._staff.set(this._staff().filter((s) => s.id !== id));
    this.showToast(`${target.name} removed from roster`);
  }

  updateStaffStatus(id: string, status: StaffStatus): void {
    this._staff.set(
      this._staff().map((s) =>
        s.id === id
          ? {
              ...s,
              status,
              shiftStart:
                status === 'off_shift'
                  ? undefined
                  : s.shiftStart ?? new Date(),
            }
          : s,
      ),
    );
  }

  private setGuestReportStatusLocal(
    id: string,
    status: GuestReport['status'],
  ): void {
    this._guestReports.set(
      this._guestReports().map((r) => (r.id === id ? { ...r, status } : r)),
    );
  }

  private appendEvent(id: string, event: IncidentEvent): void {
    const update = (list: VenueAlert[]): VenueAlert[] =>
      list.map((item) =>
        item.id === id
          ? { ...item, events: [...item.events, event] }
          : item,
      );
    this._alerts.set(update(this._alerts()));
    this._history.set(update(this._history()));
  }

  /** Persist a timeline event to the DB (fire and forget). */
  private persistEvent(alertId: string, event: IncidentEvent): void {
    this.api
      .addAlertEvent(alertId, {
        kind: event.kind,
        title: event.title,
        description: event.description,
      })
      .pipe(catchError((err) => this.logAndEmpty('addAlertEvent', err)))
      .subscribe();
  }

  private updateStatus(
    id: string,
    status: AlertStatus,
    event: Omit<IncidentEvent, 'at'>,
  ): void {
    const isActive = this._alerts().some((a) => a.id === id);
    const eventWithTime: IncidentEvent = { ...event, at: new Date() };

    if (isActive) {
      const target = this._alerts().find((a) => a.id === id);
      if (!target) return;
      const remaining = this._alerts().filter((a) => a.id !== id);
      this._alerts.set(remaining);

      const archived: VenueAlert = {
        ...target,
        status,
        handledBy: 'Current shift',
        events: [...target.events, eventWithTime],
      };
      this._history.set([archived, ...this._history()]);
    } else {
      this._history.set(
        this._history().map((item) =>
          item.id === id
            ? {
                ...item,
                status,
                events: [...item.events, eventWithTime],
              }
            : item,
        ),
      );
    }

    // Persist — status patch + timeline event. Do not block the UI.
    this.api
      .updateAlertStatus(id, status)
      .pipe(catchError((err) => this.logAndEmpty('updateAlertStatus', err)))
      .subscribe();
    this.persistEvent(id, eventWithTime);
  }

  /**
   * Surface a transient confirmation / status toast at the bottom of the screen.
   * Public so sibling services (escalations, settings, etc.) can share the same toast pipeline.
   */
  showToast(message: string): void {
    this._toast.set(message);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this._toast.set(null), 3200);
  }

  private hoursAgo(hours: number): Date {
    return new Date(Date.now() - hours * 60 * 60_000);
  }
}
