export type AlertSeverity = 'critical' | 'warning' | 'info';
export type AlertStatus =
  | 'active'
  | 'confirmed'
  | 'dismissed'
  | 'escalated'
  | 'resolved';
export type RiskLevel = 'low' | 'medium' | 'high';
export type IncidentEventKind =
  | 'detection'
  | 'confirmation'
  | 'dispatch'
  | 'note'
  | 'resolution'
  | 'escalation';

export interface CameraFeed {
  id: string;
  label: string;
  zone: string;
  imageUrl: string;
  icon: string;
  occupancy?: number;
  density?: 'low' | 'medium' | 'high';
}

export interface BoundingBox {
  /** 0-1 relative positions/sizes so boxes scale with the image */
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
}

export interface IncidentEvent {
  at: Date;
  kind: IncidentEventKind;
  title: string;
  description: string;
}

export interface ResponseNote {
  author: string;
  at: Date;
  text: string;
  kind?: 'radio' | 'note' | 'system';
}

export type GuestReportKind =
  | 'safety'
  | 'medical'
  | 'harassment'
  | 'hazard'
  | 'lost_item'
  | 'staff_help'
  | 'other';

export type GuestReportStatus =
  | 'new'
  | 'acknowledged'
  | 'dispatched'
  | 'resolved';

export type GuestReportPriority = 'low' | 'medium' | 'high';

export interface GuestReport {
  id: string;
  reference: string;
  kind: GuestReportKind;
  title: string;
  message: string;
  location: string;
  /** Display handle: "Anonymous", "Guest #A47", or a nickname */
  guestHandle: string;
  guestEmail: string;
  photoUrl?: string;
  submittedAt: Date;
  status: GuestReportStatus;
  priority: GuestReportPriority;
}

export type StaffRole =
  | 'security'
  | 'medic'
  | 'dispatcher'
  | 'floor_lead'
  | 'manager'
  | 'bar_staff'
  | 'door_staff';

export type StaffStatus = 'on_shift' | 'on_break' | 'off_shift';

export interface StaffMember {
  id: string;
  name: string;
  role: StaffRole;
  /** Human-readable zone they're currently assigned to. */
  zone: string;
  phone: string;
  email?: string;
  status: StaffStatus;
  /** When the current shift started — undefined when off shift. */
  shiftStart?: Date;
  /** Radio channel / call sign ("Unit 14"). */
  callSign?: string;
}

export interface VenueAlert {
  /** Numeric-ish public ID ("402") used in UI */
  reference: string;
  id: string;
  title: string;
  description: string;
  severity: AlertSeverity;
  risk: RiskLevel;
  confidence: number;
  location: string;
  zone: string;
  cameraId: string;
  detectedAt: Date;
  previewUrl: string;
  status: AlertStatus;
  handledBy?: string;
  leadResponder?: string;
  involvedParties?: number;
  durationSeconds?: number;
  playheadSeconds?: number;
  boundingBox?: BoundingBox;
  events: IncidentEvent[];
  notes: ResponseNote[];
  coords?: { lat: number; lng: number };
}
