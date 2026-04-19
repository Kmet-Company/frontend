import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map, shareReplay } from 'rxjs';

import { resolveCameraVideoUrl } from '../utils/camera-default-video';

import {
  AlertSeverity,
  AlertStatus,
  BoundingBox,
  CameraFeed,
  GuestReport,
  GuestReportKind,
  GuestReportPriority,
  GuestReportStatus,
  IncidentEvent,
  IncidentEventKind,
  ResponseNote,
  RiskLevel,
  VenueAlert,
} from '../models/venue.models';

/**
 * Thin HTTP layer over the PostgREST API served at /api (proxied by nginx
 * to the `api` container in docker-compose). Every method returns the same
 * shape the Angular app already works with, so AlertsService can `.set()`
 * signals directly without further transformation.
 *
 * PostgREST logs in as the read-only `web_anon` role. Writes (acknowledge,
 * dismiss, escalate, add note, ...) will need a `web_operator` role +
 * Keycloak-issued JWT before they can be persisted; right now writes stay
 * in-memory on the client.
 */

type CameraRow = {
  code: string;
  label: string;
  zone: string;
  icon: string | null;
  image_url: string | null;
  video_url: string | null;
  occupancy: number | null;
  density: 'low' | 'medium' | 'high' | null;
};

type AlertEventRow = {
  kind: IncidentEventKind;
  title: string;
  description: string;
  occurred_at: string;
};

type AlertNoteRow = {
  author_name: string;
  kind: ResponseNote['kind'] | null;
  text: string;
  created_at: string;
};

type AlertRow = {
  id: string;
  reference: string;
  title: string;
  description: string;
  severity: AlertSeverity;
  risk: RiskLevel;
  confidence: number;
  location: string;
  zone: string;
  detected_at: string;
  preview_url: string | null;
  status: AlertStatus;
  lead_responder: string | null;
  involved_parties: number | null;
  duration_seconds: number | null;
  playhead_seconds: number | null;
  coords_lat: number | null;
  coords_lng: number | null;
  bounding_box: BoundingBox | null;
  camera: { code: string } | null;
  alert_event: AlertEventRow[];
  alert_note: AlertNoteRow[];
};

type GuestReportRow = {
  id: string;
  reference: string;
  kind: GuestReportKind;
  title: string;
  message: string;
  location: string;
  guest_handle: string;
  guest_email: string;
  submitted_at: string;
  status: GuestReportStatus;
  priority: GuestReportPriority;
  photo_base64: string | null;
  photo_mime_type: string | null;
};

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api';

  // Cache the default venue UUID once. Needed as a FK when creating new
  // alerts (guest-report promotion) since PostgREST inserts need the raw id.
  private venueId$?: Observable<string>;

  // PostgREST defaults to `return=representation` on writes, which sends
  // every mutated row back. When we don't need the response body, this
  // shaves a trip through the mapper and reduces over-the-wire size.
  private readonly minimalHeaders = new HttpHeaders({ Prefer: 'return=minimal' });
  private readonly returnHeaders = new HttpHeaders({ Prefer: 'return=representation' });

  getCameras(): Observable<CameraFeed[]> {
    const params =
      'select=code,label,zone,icon,image_url,video_url,occupancy,density&order=label.asc';
    return this.http
      .get<CameraRow[]>(`${this.base}/camera?${params}`)
      .pipe(map((rows) => rows.map(this.toCamera)));
  }

  getActiveAlerts(): Observable<VenueAlert[]> {
    const select = '*,camera(code),alert_event(*),alert_note(*)';
    return this.http
      .get<AlertRow[]>(
        `${this.base}/alert?select=${select}&status=eq.active&order=detected_at.desc`,
      )
      .pipe(map((rows) => rows.map(this.toAlert)));
  }

  getAlertHistory(): Observable<VenueAlert[]> {
    const select = '*,camera(code),alert_event(*),alert_note(*)';
    return this.http
      .get<AlertRow[]>(
        `${this.base}/alert?select=${select}&status=neq.active&order=detected_at.desc`,
      )
      .pipe(map((rows) => rows.map(this.toAlert)));
  }

  getGuestReports(): Observable<GuestReport[]> {
    return this.http
      .get<GuestReportRow[]>(
        `${this.base}/guest_report?order=submitted_at.desc`,
      )
      .pipe(map((rows) => rows.map(this.toGuestReport)));
  }

  getDefaultVenueId(): Observable<string> {
    if (!this.venueId$) {
      this.venueId$ = this.http
        .get<{ id: string }[]>(`${this.base}/venue?select=id&limit=1`)
        .pipe(
          map((rows) => rows[0]?.id ?? ''),
          shareReplay(1),
        );
    }
    return this.venueId$;
  }

  // ==========================================================================
  // Writes — PostgREST translates these to INSERT/UPDATE/DELETE. All mutating
  // tables grant INSERT/UPDATE/DELETE to the web_anon role in init.sql.
  // ==========================================================================

  updateAlertStatus(alertId: string, status: AlertStatus): Observable<void> {
    return this.http.patch<void>(
      `${this.base}/alert?id=eq.${alertId}`,
      { status },
      { headers: this.minimalHeaders },
    );
  }

  addAlertEvent(
    alertId: string,
    event: { kind: IncidentEventKind; title: string; description: string },
  ): Observable<void> {
    return this.http.post<void>(
      `${this.base}/alert_event`,
      {
        alert_id: alertId,
        kind: event.kind,
        title: event.title,
        description: event.description,
      },
      { headers: this.minimalHeaders },
    );
  }

  addAlertNote(
    alertId: string,
    note: { author: string; text: string; kind: ResponseNote['kind'] },
  ): Observable<void> {
    return this.http.post<void>(
      `${this.base}/alert_note`,
      {
        alert_id: alertId,
        author_name: note.author,
        text: note.text,
        kind: note.kind ?? 'note',
      },
      { headers: this.minimalHeaders },
    );
  }

  updateGuestReportStatus(
    reportId: string,
    patch: {
      status: GuestReportStatus;
      promoted_alert_id?: string | null;
    },
  ): Observable<void> {
    return this.http.patch<void>(
      `${this.base}/guest_report?id=eq.${reportId}`,
      patch,
      { headers: this.minimalHeaders },
    );
  }

  createAlertFromGuestReport(payload: {
    venueId: string;
    reference: string;
    title: string;
    description: string;
    severity: AlertSeverity;
    risk: RiskLevel;
    confidence: number;
    location: string;
    zone: string;
    sourceGuestReportId: string;
  }): Observable<{ id: string }> {
    return this.http
      .post<AlertRow[]>(
        `${this.base}/alert`,
        {
          venue_id: payload.venueId,
          reference: payload.reference,
          title: payload.title,
          description: payload.description,
          severity: payload.severity,
          risk: payload.risk,
          confidence: payload.confidence,
          location: payload.location,
          zone: payload.zone,
          status: 'active',
          source: 'guest_report',
          source_guest_report_id: payload.sourceGuestReportId,
        },
        { headers: this.returnHeaders },
      )
      .pipe(map((rows) => ({ id: rows[0].id })));
  }

  private toCamera = (row: CameraRow): CameraFeed => ({
    id: row.code,
    label: row.label,
    zone: row.zone,
    icon: row.icon ?? 'videocam',
    imageUrl: row.image_url ?? '',
    videoUrl: resolveCameraVideoUrl({
      id: row.code,
      videoUrl: row.video_url ?? undefined,
    }),
    occupancy: row.occupancy ?? undefined,
    density: row.density ?? undefined,
  });

  private toAlert = (row: AlertRow): VenueAlert => ({
    id: row.id,
    reference: row.reference,
    title: row.title,
    description: row.description,
    severity: row.severity,
    risk: row.risk,
    confidence: row.confidence,
    location: row.location,
    zone: row.zone,
    cameraId: row.camera?.code ?? '',
    detectedAt: new Date(row.detected_at),
    previewUrl: row.preview_url ?? '',
    status: row.status,
    leadResponder: row.lead_responder ?? undefined,
    involvedParties: row.involved_parties ?? undefined,
    durationSeconds: row.duration_seconds ?? undefined,
    playheadSeconds: row.playhead_seconds ?? undefined,
    boundingBox: row.bounding_box ?? undefined,
    coords:
      row.coords_lat != null && row.coords_lng != null
        ? { lat: row.coords_lat, lng: row.coords_lng }
        : undefined,
    events: (row.alert_event ?? [])
      .slice()
      .sort(
        (a, b) =>
          new Date(a.occurred_at).getTime() -
          new Date(b.occurred_at).getTime(),
      )
      .map<IncidentEvent>((e) => ({
        kind: e.kind,
        title: e.title,
        description: e.description,
        at: new Date(e.occurred_at),
      })),
    notes: (row.alert_note ?? [])
      .slice()
      .sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      )
      .map<ResponseNote>((n) => ({
        author: n.author_name,
        kind: n.kind ?? 'note',
        text: n.text,
        at: new Date(n.created_at),
      })),
  });

  private toGuestReport = (row: GuestReportRow): GuestReport => ({
    id: row.id,
    reference: row.reference,
    kind: row.kind,
    title: row.title,
    message: row.message,
    location: row.location,
    guestHandle: row.guest_handle,
    submittedAt: new Date(row.submitted_at),
    status: row.status,
    priority: row.priority,
    guestEmail: row.guest_email,
    photoUrl: row.photo_base64
      ? `data:${row.photo_mime_type ?? 'image/jpeg'};base64,${row.photo_base64}`
      : undefined,
  });
}
