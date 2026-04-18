import { Injectable, computed, signal } from '@angular/core';

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

/**
 * Mock operational data for the venue safety dashboard. In a production build
 * this service would subscribe to a websocket / REST backend instead.
 */
@Injectable({ providedIn: 'root' })
export class AlertsService {
  private readonly _cameras = signal<CameraFeed[]>([
    {
      id: 'cam-main',
      label: 'Main Floor',
      zone: 'Dance Floor',
      icon: 'layers',
      occupancy: 612,
      density: 'high',
      imageUrl:
        'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?auto=format&fit=crop&w=1200&q=70',
    },
    {
      id: 'cam-bar',
      label: 'Bar Area',
      zone: 'Main Bar',
      icon: 'local_bar',
      occupancy: 184,
      density: 'medium',
      imageUrl:
        'https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=1200&q=70',
    },
    {
      id: 'cam-entrance',
      label: 'Entrance Queue',
      zone: 'Front Door',
      icon: 'groups',
      occupancy: 96,
      density: 'medium',
      imageUrl:
        'https://images.unsplash.com/photo-1493676304819-0d7a8d026dcf?auto=format&fit=crop&w=1200&q=70',
    },
    {
      id: 'cam-stage',
      label: 'Stage Crowd',
      zone: 'Main Stage',
      icon: 'theater_comedy',
      occupancy: 842,
      density: 'high',
      imageUrl:
        'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?auto=format&fit=crop&w=1200&q=70',
    },
  ]);

  private readonly _alerts = signal<VenueAlert[]>([
    this.seedActive({
      reference: '402',
      id: 'alert-402',
      title: 'Possible fight near bar',
      description:
        'Raised voices and sudden crowd movement detected. Two patrons pushed into the counter; a third joined and the group separated after 18 seconds.',
      severity: 'critical',
      risk: 'high',
      confidence: 82,
      location: 'Bar Area North',
      zone: 'South Concourse',
      cameraId: 'cam-bar',
      minutesAgo: 12,
      preview:
        'https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=400&q=60',
      boundingBox: { x: 0.34, y: 0.28, width: 0.28, height: 0.46, label: 'Conflict 82%' },
      involvedParties: 3,
      leadResponder: 'Unit 14 · Officer Miller',
      events: [
        {
          kind: 'detection',
          title: 'Initial detection',
          description: 'AI Analytics flagged erratic movement in Grid B4.',
          minutesAgo: 12,
        },
        {
          kind: 'confirmation',
          title: 'Human confirmation',
          description: 'Lead dispatcher visually confirmed verbal altercation.',
          minutesAgo: 11,
        },
        {
          kind: 'dispatch',
          title: 'Security dispatched',
          description: 'Officers Miller and Chen en route to Bar Area North.',
          minutesAgo: 10,
        },
      ],
      notes: [
        {
          author: 'Officer Miller',
          kind: 'radio',
          minutesAgo: 8,
          text: '"Arrived on scene. Three males separated. Attempting to de-escalate. No weapons visible."',
        },
        {
          author: 'Lead Dispatcher',
          kind: 'note',
          minutesAgo: 6,
          text: '"Maintaining visual via Camera 12 and 14. Standing by for medical request."',
        },
      ],
      coords: { lat: 46.0511, lng: 14.5051 },
    }),
    this.seedActive({
      reference: '403',
      id: 'alert-403',
      title: 'Dense crowd forming near stage',
      description:
        'Crowd density crossing the safe threshold in front of the main stage left barrier.',
      severity: 'warning',
      risk: 'medium',
      confidence: 67,
      location: 'Main Stage',
      zone: 'North Hall',
      cameraId: 'cam-stage',
      minutesAgo: 5,
      preview:
        'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?auto=format&fit=crop&w=400&q=60',
      involvedParties: 180,
      leadResponder: 'Floor Lead · Priya R.',
      events: [
        {
          kind: 'detection',
          title: 'Density threshold crossed',
          description: '2.8 persons/m² sustained for 45 seconds in front-left pit.',
          minutesAgo: 5,
        },
      ],
      notes: [
        {
          author: 'Floor Lead · Priya R.',
          kind: 'note',
          minutesAgo: 3,
          text: '"Rerouting inbound traffic to stage-right. Monitoring.",',
        },
      ],
    }),
    this.seedActive({
      reference: '404',
      id: 'alert-404',
      title: 'Queue backup at entrance',
      description:
        'Entrance queue grew past 80 patrons. Consider opening secondary lane.',
      severity: 'info',
      risk: 'low',
      confidence: 54,
      location: 'Entrance Queue',
      zone: 'Front of House',
      cameraId: 'cam-entrance',
      minutesAgo: 9,
      preview:
        'https://images.unsplash.com/photo-1493676304819-0d7a8d026dcf?auto=format&fit=crop&w=400&q=60',
      involvedParties: 84,
      leadResponder: 'Gate Supervisor · Jamal K.',
      events: [
        {
          kind: 'detection',
          title: 'Queue length advisory',
          description: 'Outdoor queue exceeded recommended maximum.',
          minutesAgo: 9,
        },
      ],
      notes: [],
    }),
    this.seedActive({
      reference: '405',
      id: 'alert-405',
      title: 'Guest unresponsive on dance floor',
      description:
        'Patron on the floor near grid C3, not moving for 22 seconds. Surrounding crowd is clearing space.',
      severity: 'critical',
      risk: 'high',
      confidence: 74,
      location: 'Dance Floor Center',
      zone: 'Dance Floor',
      cameraId: 'cam-main',
      minutesAgo: 2,
      preview:
        'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?auto=format&fit=crop&w=400&q=60',
      boundingBox: { x: 0.48, y: 0.54, width: 0.14, height: 0.22, label: 'Person down 74%' },
      involvedParties: 1,
      leadResponder: 'Medic 02 · R. Okafor',
      events: [
        {
          kind: 'detection',
          title: 'Fall detected',
          description: 'Pose analytics flagged a sustained prone posture.',
          minutesAgo: 2,
        },
      ],
      notes: [],
    }),
    this.seedActive({
      reference: '406',
      id: 'alert-406',
      title: 'Loitering near fire exit',
      description:
        'Same individual blocking emergency exit B for over 3 minutes despite signage.',
      severity: 'warning',
      risk: 'medium',
      confidence: 71,
      location: 'Fire Exit B',
      zone: 'South Concourse',
      cameraId: 'cam-bar',
      minutesAgo: 7,
      preview:
        'https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=400&q=60',
      involvedParties: 1,
      leadResponder: 'Floor Team · Marco B.',
      events: [
        {
          kind: 'detection',
          title: 'Exit obstruction',
          description: 'Emergency egress path partially blocked.',
          minutesAgo: 7,
        },
      ],
      notes: [],
    }),
  ]);

  private readonly _history = signal<VenueAlert[]>([
    this.seedHistory({
      reference: '398',
      id: 'history-398',
      title: 'Intoxicated guest escorted out',
      description:
        'Single guest assisted to taxi queue without further incident.',
      severity: 'warning',
      risk: 'medium',
      confidence: 61,
      location: 'VIP Entrance',
      zone: 'VIP Lounge',
      cameraId: 'cam-entrance',
      status: 'dismissed',
      minutesAgo: 125,
      handledBy: 'Admin Sarah',
      leadResponder: 'Admin Sarah',
    }),
    this.seedHistory({
      reference: '397',
      id: 'history-397',
      title: 'Unattended bag detected',
      description: 'Dispatched Security Team 04 to investigate and recover.',
      severity: 'critical',
      risk: 'high',
      confidence: 78,
      location: 'Coat Check',
      zone: 'North Plaza',
      cameraId: 'cam-entrance',
      status: 'confirmed',
      minutesAgo: 160,
      handledBy: 'Security 04',
      leadResponder: 'Unit 04 · Officer Chen',
    }),
    this.seedHistory({
      reference: '385',
      id: 'history-385',
      title: 'Slip & fall near bar',
      description:
        'Medical team responded; guest declined further assistance.',
      severity: 'warning',
      risk: 'medium',
      confidence: 88,
      location: 'Bar Area North',
      zone: 'South Concourse',
      cameraId: 'cam-bar',
      status: 'resolved',
      minutesAgo: 1440,
      handledBy: 'Medic 01',
      leadResponder: 'Medic 01',
    }),
    this.seedHistory({
      reference: '381',
      id: 'history-381',
      title: 'Exterior door propped open',
      description: 'Automatic closure triggered after 90s.',
      severity: 'info',
      risk: 'low',
      confidence: 92,
      location: 'Loading Dock',
      zone: 'Loading Dock',
      cameraId: 'cam-main',
      status: 'resolved',
      minutesAgo: 1520,
    }),
  ]);

  private readonly _guestReports = signal<GuestReport[]>([
    {
      id: 'gr-8421',
      reference: 'GR-8421',
      kind: 'medical',
      title: 'Friend feels faint',
      message:
        'My friend is feeling dizzy and needs somewhere to sit — we’re near the main bar on the right.',
      location: 'Main Bar · right side',
      guestHandle: 'Guest · Alex K.',
      guestEmail: 'alex.k@guestmail.com',
      photoUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&h=300&fit=crop',
      submittedAt: this.minutesAgo(1),
      status: 'new',
      priority: 'high',
    },
    {
      id: 'gr-8420',
      reference: 'GR-8420',
      kind: 'safety',
      title: 'Feeling unsafe near stage',
      message:
        'A group of guys keeps pushing and it’s getting aggressive in the pit left of the stage.',
      location: 'Main Stage · front-left',
      guestHandle: 'Anonymous',
      guestEmail: 'anonymous-8420@guestmail.com',
      photoUrl: 'https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?w=400&h=300&fit=crop',
      submittedAt: this.minutesAgo(4),
      status: 'new',
      priority: 'high',
    },
    {
      id: 'gr-8419',
      reference: 'GR-8419',
      kind: 'hazard',
      title: 'Wet floor in restrooms',
      message:
        'Someone spilled a drink outside the women’s restrooms on the 2nd floor. People are slipping.',
      location: '2F Restrooms',
      guestHandle: 'Guest · Priya M.',
      guestEmail: 'priya.m@guestmail.com',
      photoUrl: 'https://images.unsplash.com/photo-1582481725274-d63bcb9c2766?w=400&h=300&fit=crop',
      submittedAt: this.minutesAgo(8),
      status: 'acknowledged',
      priority: 'medium',
    },
    {
      id: 'gr-8418',
      reference: 'GR-8418',
      kind: 'lost_item',
      title: 'Lost black jacket',
      message:
        'I think I left my black jacket near the cloakroom around 11pm. Phone in the pocket.',
      location: 'Cloakroom',
      guestHandle: 'Guest · Lina T.',
      guestEmail: 'lina.t@guestmail.com',
      submittedAt: this.minutesAgo(15),
      status: 'new',
      priority: 'low',
    },
    {
      id: 'gr-8417',
      reference: 'GR-8417',
      kind: 'harassment',
      title: 'Being followed by a stranger',
      message:
        'A guy keeps following me around the venue and won\u2019t leave me alone. Currently near the stage-right exit.',
      location: 'Stage · right exit',
      guestHandle: 'Guest #A47',
      guestEmail: 'a47@guestmail.com',
      photoUrl: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=400&h=300&fit=crop',
      submittedAt: this.minutesAgo(2),
      status: 'new',
      priority: 'high',
    },
  ]);

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
    this.appendEvent(id, {
      at: new Date(),
      kind: 'dispatch',
      title: 'Backup requested',
      description: 'Additional floor team dispatched to location.',
    });
    this.showToast('Backup requested');
  }

  addNote(id: string, author: string, text: string): void {
    if (!text.trim()) return;
    const update = (list: VenueAlert[]): VenueAlert[] =>
      list.map((item) =>
        item.id === id
          ? {
              ...item,
              notes: [
                ...item.notes,
                { author, at: new Date(), text: text.trim(), kind: 'note' },
              ],
            }
          : item,
      );
    this._alerts.set(update(this._alerts()));
    this._history.set(update(this._history()));
    this.showToast('Note added to response log');
  }

  /**
   * Acknowledging a guest report promotes it into a full active alert so it
   * shows up alongside operator-visible incidents. The guest-side record is
   * marked resolved so it disappears from the "open guest reports" panel —
   * the operator now tracks it via the alert timeline.
   *
   * Returns the newly created alert (or null if the report wasn't found or
   * was already promoted).
   */
  acknowledgeGuestReport(id: string): VenueAlert | null {
    const report = this._guestReports().find((r) => r.id === id);
    if (!report || report.status === 'resolved') return null;

    const now = new Date();
    const newAlert: VenueAlert = {
      id: `alert-gr-${report.reference}`,
      reference: `GR${report.reference}`,
      title: `Guest report: ${report.title}`,
      description: report.message,
      severity: this.severityFromPriority(report.priority),
      risk: this.riskFromPriority(report.priority),
      confidence: 70,
      location: report.location,
      zone: report.location,
      cameraId: this.cameras()[0]?.id ?? 'cam-main',
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

    this._alerts.update((list) => [newAlert, ...list]);
    this.updateGuestReport(id, 'resolved');
    this.showToast('Report promoted to active alert');
    return newAlert;
  }

  /**
   * Dismiss a guest report without promoting it — e.g. duplicate report or
   * non-actionable. The record is archived (status → resolved) and removed
   * from the open guest-report panel.
   */
  dismissGuestReport(id: string): void {
    const report = this._guestReports().find((r) => r.id === id);
    if (!report) return;
    this.updateGuestReport(id, 'resolved');
    this.showToast('Guest report dismissed');
  }

  /**
   * Append a timeline event to an existing alert (active or archived).
   * Exposed publicly so sibling services (e.g. EscalationService) can attach
   * their actions to an alert's history without reaching into private state.
   */
  addIncidentEvent(alertId: string, event: Omit<IncidentEvent, 'at'>): void {
    this.appendEvent(alertId, { ...event, at: new Date() });
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
    phone: string;
    email?: string;
    zone?: string;
    status?: StaffStatus;
    callSign?: string;
  }): StaffMember {
    const status: StaffStatus = input.status ?? 'on_shift';
    const member: StaffMember = {
      id: `st-${Date.now().toString(36)}`,
      name: input.name.trim(),
      role: input.role,
      zone: (input.zone ?? '').trim(),
      phone: input.phone.trim(),
      email: input.email?.trim() || undefined,
      status,
      callSign: input.callSign?.trim() || undefined,
      shiftStart: status === 'off_shift' ? undefined : new Date(),
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

  private updateGuestReport(
    id: string,
    status: GuestReport['status'],
  ): void {
    this._guestReports.set(
      this._guestReports().map((r) =>
        r.id === id ? { ...r, status } : r,
      ),
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

  private minutesAgo(minutes: number): Date {
    return new Date(Date.now() - minutes * 60_000);
  }

  private hoursAgo(hours: number): Date {
    return new Date(Date.now() - hours * 60 * 60_000);
  }

  private seedActive(input: {
    reference: string;
    id: string;
    title: string;
    description: string;
    severity: VenueAlert['severity'];
    risk: VenueAlert['risk'];
    confidence: number;
    location: string;
    zone: string;
    cameraId: string;
    minutesAgo: number;
    preview: string;
    involvedParties?: number;
    leadResponder?: string;
    boundingBox?: BoundingBox;
    events: Array<Omit<IncidentEvent, 'at'> & { minutesAgo: number }>;
    notes: Array<Omit<ResponseNote, 'at'> & { minutesAgo: number }>;
    coords?: { lat: number; lng: number };
  }): VenueAlert {
    return {
      reference: input.reference,
      id: input.id,
      title: input.title,
      description: input.description,
      severity: input.severity,
      risk: input.risk,
      confidence: input.confidence,
      location: input.location,
      zone: input.zone,
      cameraId: input.cameraId,
      detectedAt: this.minutesAgo(input.minutesAgo),
      previewUrl: input.preview,
      status: 'active',
      involvedParties: input.involvedParties,
      leadResponder: input.leadResponder,
      boundingBox: input.boundingBox,
      durationSeconds: 405,
      playheadSeconds: 262,
      events: input.events.map((e) => ({
        kind: e.kind,
        title: e.title,
        description: e.description,
        at: this.minutesAgo(e.minutesAgo),
      })),
      notes: input.notes.map((n) => ({
        author: n.author,
        kind: n.kind,
        text: n.text,
        at: this.minutesAgo(n.minutesAgo),
      })),
      coords: input.coords,
    };
  }

  private seedHistory(input: {
    reference: string;
    id: string;
    title: string;
    description: string;
    severity: VenueAlert['severity'];
    risk: VenueAlert['risk'];
    confidence: number;
    location: string;
    zone: string;
    cameraId: string;
    status: AlertStatus;
    minutesAgo: number;
    handledBy?: string;
    leadResponder?: string;
  }): VenueAlert {
    return {
      reference: input.reference,
      id: input.id,
      title: input.title,
      description: input.description,
      severity: input.severity,
      risk: input.risk,
      confidence: input.confidence,
      location: input.location,
      zone: input.zone,
      cameraId: input.cameraId,
      detectedAt: this.minutesAgo(input.minutesAgo),
      previewUrl: '',
      status: input.status,
      handledBy: input.handledBy,
      leadResponder: input.leadResponder,
      events: [
        {
          kind: 'detection',
          title: 'Incident opened',
          description: 'Automated detection opened the incident.',
          at: this.minutesAgo(input.minutesAgo),
        },
        {
          kind: 'resolution',
          title: `Status set to ${input.status}`,
          description: input.handledBy
            ? `Handled by ${input.handledBy}.`
            : 'Auto-closed by system.',
          at: this.minutesAgo(Math.max(input.minutesAgo - 5, 1)),
        },
      ],
      notes: [],
    };
  }
}
