-- =============================================================================
-- Vigilant Architect — Postgres schema
-- -----------------------------------------------------------------------------
-- Mount this file at `/docker-entrypoint-initdb.d/init.sql` in the official
-- `postgres:17` image and it will run on first boot of an empty data volume.
-- See frontend/docker-compose.yml for the full db + api (PostgREST) + web stack.
--
-- Staff/user identity is owned by Keycloak. This schema only stores UUID
-- references (`*_user_id`) and a small denormalized `staff_presence` table
-- so operator tools can render a roster without calling Keycloak for every
-- request. No password / PII columns live here.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Enums mirroring the app's TypeScript types in models/venue.models.ts
-- -----------------------------------------------------------------------------
CREATE TYPE alert_severity         AS ENUM ('critical', 'warning', 'info');
CREATE TYPE alert_status           AS ENUM ('active', 'confirmed', 'dismissed', 'escalated', 'resolved');
CREATE TYPE risk_level             AS ENUM ('low', 'medium', 'high');
CREATE TYPE incident_event_kind    AS ENUM ('detection', 'confirmation', 'dispatch', 'note', 'resolution', 'escalation');
CREATE TYPE response_note_kind     AS ENUM ('radio', 'note', 'system');
CREATE TYPE guest_report_kind      AS ENUM ('safety', 'medical', 'harassment', 'hazard', 'lost_item', 'staff_help', 'other');
CREATE TYPE guest_report_status    AS ENUM ('new', 'acknowledged', 'dispatched', 'resolved');
CREATE TYPE guest_report_priority  AS ENUM ('low', 'medium', 'high');
CREATE TYPE camera_density         AS ENUM ('low', 'medium', 'high');
CREATE TYPE alert_source           AS ENUM ('ai', 'guest_report', 'manual');

CREATE TYPE escalation_category    AS ENUM ('emergency', 'internal', 'systems', 'announcements');
CREATE TYPE escalation_kind        AS ENUM ('one_shot', 'toggle');
CREATE TYPE escalation_tone        AS ENUM ('error', 'warning', 'primary', 'neutral');

CREATE TYPE staff_status           AS ENUM ('on_shift', 'on_break', 'off_shift');
CREATE TYPE theme_preference       AS ENUM ('system', 'light', 'dark');

-- -----------------------------------------------------------------------------
-- Auto-bump updated_at on every UPDATE.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- =============================================================================
-- Venue
-- =============================================================================
CREATE TABLE venue (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code       TEXT        UNIQUE NOT NULL,           -- stable key ("foundry-north-hall")
  name       TEXT        NOT NULL,
  subvenue   TEXT,
  address    TEXT,
  timezone   TEXT        NOT NULL DEFAULT 'UTC',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_venue_updated_at
  BEFORE UPDATE ON venue
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================================
-- Camera feeds
-- =============================================================================
CREATE TABLE camera (
  id         UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id   UUID            NOT NULL REFERENCES venue(id) ON DELETE CASCADE,
  code       TEXT            NOT NULL,              -- "cam-main"
  label      TEXT            NOT NULL,              -- "Main Floor"
  zone       TEXT            NOT NULL,              -- "Dance Floor"
  icon       TEXT,                                  -- Material Symbols name
  image_url  TEXT,                                  -- current frame / preview / poster
  video_url  TEXT,                                  -- looping feed (MP4 or HTTPS URL)
  occupancy  INTEGER         CHECK (occupancy IS NULL OR occupancy >= 0),
  density    camera_density,
  active     BOOLEAN         NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ     NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ     NOT NULL DEFAULT now(),
  UNIQUE (venue_id, code)
);

CREATE INDEX idx_camera_venue ON camera(venue_id);

CREATE TRIGGER trg_camera_updated_at
  BEFORE UPDATE ON camera
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================================
-- Alerts / incidents
-- =============================================================================
CREATE TABLE alert (
  id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id            UUID            NOT NULL REFERENCES venue(id) ON DELETE CASCADE,
  camera_id           UUID            REFERENCES camera(id) ON DELETE SET NULL,

  reference           TEXT            NOT NULL,                         -- "402", "GR8421"
  title               TEXT            NOT NULL,
  description         TEXT            NOT NULL DEFAULT '',

  severity            alert_severity  NOT NULL,
  risk                risk_level      NOT NULL DEFAULT 'low',
  confidence          SMALLINT        NOT NULL CHECK (confidence BETWEEN 0 AND 100),

  location            TEXT            NOT NULL,                         -- human label ("Bar Area North")
  zone                TEXT            NOT NULL,
  coords_lat          DOUBLE PRECISION,
  coords_lng          DOUBLE PRECISION,

  detected_at         TIMESTAMPTZ     NOT NULL DEFAULT now(),
  preview_url         TEXT,

  status              alert_status    NOT NULL DEFAULT 'active',
  handled_by_user_id  UUID,                                             -- Keycloak user id
  lead_responder      TEXT,                                             -- free-form, e.g. "Unit 14 · Officer Miller"
  involved_parties    INTEGER         CHECK (involved_parties IS NULL OR involved_parties >= 0),
  duration_seconds    INTEGER         CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
  playhead_seconds    INTEGER         CHECK (playhead_seconds IS NULL OR playhead_seconds >= 0),

  -- Normalized 0-1 box emitted by the detector.
  -- Shape: { x, y, width, height, label }
  bounding_box        JSONB,

  source              alert_source    NOT NULL DEFAULT 'ai',
  -- When source='guest_report' this points at guest_report.id; otherwise NULL.
  source_guest_report_id UUID,

  created_at          TIMESTAMPTZ     NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ     NOT NULL DEFAULT now(),

  UNIQUE (venue_id, reference)
);

CREATE INDEX idx_alert_status            ON alert(status);
CREATE INDEX idx_alert_severity          ON alert(severity);
CREATE INDEX idx_alert_venue_detected    ON alert(venue_id, detected_at DESC);
CREATE INDEX idx_alert_camera            ON alert(camera_id);
CREATE INDEX idx_alert_handled_by        ON alert(handled_by_user_id);
CREATE INDEX idx_alert_source            ON alert(source);

CREATE TRIGGER trg_alert_updated_at
  BEFORE UPDATE ON alert
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- Incident timeline (detection / confirmation / dispatch / escalation / ...)
-- -----------------------------------------------------------------------------
CREATE TABLE alert_event (
  id             UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id       UUID                NOT NULL REFERENCES alert(id) ON DELETE CASCADE,
  kind           incident_event_kind NOT NULL,
  title          TEXT                NOT NULL,
  description    TEXT                NOT NULL DEFAULT '',
  occurred_at    TIMESTAMPTZ         NOT NULL DEFAULT now(),
  actor_user_id  UUID,                                   -- Keycloak user id, if any
  actor_name     TEXT,                                   -- denormalized for display
  created_at     TIMESTAMPTZ         NOT NULL DEFAULT now()
);

CREATE INDEX idx_alert_event_alert_time ON alert_event(alert_id, occurred_at DESC);

-- -----------------------------------------------------------------------------
-- Operator radio / notes on an alert
-- -----------------------------------------------------------------------------
CREATE TABLE alert_note (
  id              UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id        UUID                NOT NULL REFERENCES alert(id) ON DELETE CASCADE,
  author_user_id  UUID,                                   -- Keycloak user id
  author_name     TEXT                NOT NULL,           -- denormalized for display
  text            TEXT                NOT NULL,
  kind            response_note_kind  NOT NULL DEFAULT 'note',
  created_at      TIMESTAMPTZ         NOT NULL DEFAULT now()
);

CREATE INDEX idx_alert_note_alert_time ON alert_note(alert_id, created_at DESC);

-- =============================================================================
-- Guest reports (mobile app submissions)
-- =============================================================================
CREATE TABLE guest_report (
  id                  UUID                    PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id            UUID                    NOT NULL REFERENCES venue(id) ON DELETE CASCADE,

  reference           TEXT                    NOT NULL,          -- short human id ("GR-8421")
  kind                guest_report_kind       NOT NULL,
  title               TEXT                    NOT NULL,
  message             TEXT                    NOT NULL,
  location            TEXT                    NOT NULL,

  guest_handle        TEXT                    NOT NULL,          -- "Anonymous" / "Guest #A47"
  guest_email         TEXT                    NOT NULL DEFAULT '',
  guest_device_id     TEXT,                                      -- opaque device fingerprint, optional

  submitted_at        TIMESTAMPTZ             NOT NULL DEFAULT now(),
  status              guest_report_status     NOT NULL DEFAULT 'new',
  priority            guest_report_priority   NOT NULL DEFAULT 'low',

  -- Set when an operator acknowledges the report and promotes it into a
  -- full alert (`AlertsService.acknowledgeGuestReport`).
  promoted_alert_id   UUID                    REFERENCES alert(id) ON DELETE SET NULL,
  handled_by_user_id  UUID,                                      -- Keycloak user id

  updated_at          TIMESTAMPTZ             NOT NULL DEFAULT now(),

  UNIQUE (venue_id, reference)
);

CREATE INDEX idx_guest_report_status           ON guest_report(status);
CREATE INDEX idx_guest_report_venue_submitted  ON guest_report(venue_id, submitted_at DESC);

CREATE TRIGGER trg_guest_report_updated_at
  BEFORE UPDATE ON guest_report
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Back-reference: closes the loop between alert.source_guest_report_id and
-- guest_report.id without creating a circular foreign key on inserts.
CREATE INDEX idx_alert_source_guest_report ON alert(source_guest_report_id);

-- =============================================================================
-- Escalation — static catalog + per-venue system state + audit log
-- =============================================================================
CREATE TABLE escalation_action (
  id                 TEXT                  PRIMARY KEY,   -- "call-police"
  label              TEXT                  NOT NULL,
  description        TEXT                  NOT NULL,
  icon               TEXT                  NOT NULL,
  category           escalation_category   NOT NULL,
  kind               escalation_kind       NOT NULL,
  tone               escalation_tone       NOT NULL DEFAULT 'primary',
  confirm_required   BOOLEAN               NOT NULL DEFAULT FALSE,
  -- For toggle actions only: the default / "venue is fine" state. NULL for one-shots.
  default_on         BOOLEAN,
  sort_order         SMALLINT              NOT NULL DEFAULT 0,
  active             BOOLEAN               NOT NULL DEFAULT TRUE,
  created_at         TIMESTAMPTZ           NOT NULL DEFAULT now(),
  CHECK (
    (kind = 'toggle' AND default_on IS NOT NULL)
    OR (kind = 'one_shot' AND default_on IS NULL)
  )
);

-- Current on/off state for each toggle action at each venue.
CREATE TABLE venue_system_state (
  venue_id         UUID         NOT NULL REFERENCES venue(id) ON DELETE CASCADE,
  action_id        TEXT         NOT NULL REFERENCES escalation_action(id) ON DELETE CASCADE,
  is_on            BOOLEAN      NOT NULL,
  last_changed_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  last_changed_by  UUID,                                    -- Keycloak user id
  PRIMARY KEY (venue_id, action_id)
);

-- Historical log of every escalation action triggered.
CREATE TABLE escalation_log (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id          UUID         NOT NULL REFERENCES venue(id) ON DELETE CASCADE,
  action_id         TEXT         NOT NULL REFERENCES escalation_action(id) ON DELETE RESTRICT,
  -- Optional alert this escalation is scoped to.
  alert_id          UUID         REFERENCES alert(id) ON DELETE SET NULL,
  operator_user_id  UUID,                                    -- Keycloak user id
  operator_name     TEXT         NOT NULL DEFAULT 'Unknown', -- denormalized for display
  -- For toggle actions: the new state (TRUE=turned on, FALSE=turned off).
  -- For one-shot actions: NULL.
  enabled           BOOLEAN,
  triggered_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  details           JSONB                                    -- free-form extra context
);

CREATE INDEX idx_escalation_log_venue_time  ON escalation_log(venue_id, triggered_at DESC);
CREATE INDEX idx_escalation_log_action      ON escalation_log(action_id);
CREATE INDEX idx_escalation_log_alert       ON escalation_log(alert_id);
CREATE INDEX idx_escalation_log_operator    ON escalation_log(operator_user_id);

-- =============================================================================
-- Per-user preferences (theme, call sign, notification prefs).
-- Keyed by Keycloak user id. Rows are upserted by the app on change.
-- =============================================================================
CREATE TABLE user_preferences (
  user_id                   UUID               PRIMARY KEY,   -- Keycloak user id
  display_name              TEXT,
  call_sign                 TEXT,
  role                      TEXT,
  email                     TEXT,
  theme                     theme_preference   NOT NULL DEFAULT 'system',
  sound_alerts              BOOLEAN            NOT NULL DEFAULT TRUE,
  desktop_notifications     BOOLEAN            NOT NULL DEFAULT FALSE,
  toast_duration_seconds    SMALLINT           NOT NULL DEFAULT 3 CHECK (toast_duration_seconds BETWEEN 1 AND 30),
  updated_at                TIMESTAMPTZ        NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_user_prefs_updated_at
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================================
-- Staff presence (Keycloak owns identity — this is a fast-read mirror).
-- The app can join this against Keycloak's user export to build the roster
-- without hitting Keycloak on every request.
-- =============================================================================
CREATE TABLE staff_presence (
  user_id      UUID          PRIMARY KEY,                     -- Keycloak user id
  venue_id     UUID          REFERENCES venue(id) ON DELETE SET NULL,
  status       staff_status  NOT NULL DEFAULT 'off_shift',
  zone         TEXT,                                          -- current assigned zone
  shift_start  TIMESTAMPTZ,
  call_sign    TEXT,                                          -- radio / unit id ("Unit 14")
  updated_at   TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX idx_staff_presence_venue_status ON staff_presence(venue_id, status);

CREATE TRIGGER trg_staff_presence_updated_at
  BEFORE UPDATE ON staff_presence
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================================
-- Seed data
-- -----------------------------------------------------------------------------
-- Mirrors the hardcoded data in frontend/src/app/services/alerts.service.ts
-- so the UI keeps its demo state when the backend first comes online. Delete
-- or replace as needed once real data is flowing.
-- =============================================================================

-- -------- Venue --------
INSERT INTO venue (code, name, subvenue, timezone) VALUES
  ('foundry-north-hall', 'The Foundry', 'North Hall', 'Europe/Ljubljana');

-- -------- Cameras --------
INSERT INTO camera (venue_id, code, label, zone, icon, image_url, video_url, occupancy, density)
SELECT v.id, c.code, c.label, c.zone, c.icon, c.image_url, c.video_url, c.occupancy, c.density::camera_density
FROM   venue v
JOIN   (VALUES
  ('cam-main',     'Main Floor',     'Dance Floor', 'layers',         'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?auto=format&fit=crop&w=1200&q=70', 'https://filesamples.com/samples/video/mp4/sample_640x360.mp4', 612, 'high'),
  ('cam-bar',      'Bar Area',       'Main Bar',    'local_bar',      'https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=1200&q=70', 'https://filesamples.com/samples/video/mp4/sample_640x360.mp4', 184, 'medium'),
  ('cam-entrance', 'Entrance Queue', 'Front Door',  'groups',         'https://images.unsplash.com/photo-1493676304819-0d7a8d026dcf?auto=format&fit=crop&w=1200&q=70', 'https://filesamples.com/samples/video/mp4/sample_640x360.mp4',  96, 'medium'),
  ('cam-stage',    'Stage Crowd',    'Main Stage',  'theater_comedy', 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?auto=format&fit=crop&w=1200&q=70', 'https://filesamples.com/samples/video/mp4/sample_640x360.mp4', 842, 'high')
) AS c(code, label, zone, icon, image_url, video_url, occupancy, density) ON TRUE
WHERE v.code = 'foundry-north-hall';

-- -------- Escalation action catalog --------
INSERT INTO escalation_action (id, label, description, icon, category, kind, tone, confirm_required, default_on, sort_order) VALUES
  -- Emergency services
  ('call-police',        'Call Police',               'Direct dial to local precinct dispatch.',             'local_police',           'emergency',     'one_shot', 'error',   TRUE,  NULL,  10),
  ('call-ems',           'Call EMS / Hospital',       'Request paramedics or medical transport.',            'medical_services',       'emergency',     'one_shot', 'error',   TRUE,  NULL,  20),
  ('call-fire',          'Call Fire Dept.',           'Notify fire & rescue services.',                      'local_fire_department',  'emergency',     'one_shot', 'error',   TRUE,  NULL,  30),

  -- Internal teams
  ('dispatch-security',  'Dispatch Security',         'Send nearest security unit to flagged zone.',         'security',               'internal',      'one_shot', 'primary', FALSE, NULL, 100),
  ('dispatch-medical',   'Dispatch Medical Team',     'Floor medics respond to reported location.',          'medical_information',    'internal',      'one_shot', 'primary', FALSE, NULL, 110),
  ('notify-manager',     'Notify Shift Manager',      'Push priority alert to the manager on duty.',         'supervisor_account',     'internal',      'one_shot', 'primary', FALSE, NULL, 120),
  ('reinforce-door',     'Reinforce Door Staff',      'Pull two from rotation to front entrance.',           'door_front',             'internal',      'one_shot', 'primary', FALSE, NULL, 130),

  -- Venue systems (toggles)
  ('party-lights',       'Party Lights',              'Stage, strobe & color wash rigs.',                    'party_mode',             'systems',       'toggle',   'neutral', FALSE, TRUE,  200),
  ('house-lights',       'House / White Lights',      'Full-venue white lighting for evacuation & first aid.', 'lightbulb',            'systems',       'toggle',   'warning', TRUE,  FALSE, 210),
  ('music-playback',     'Music Playback',            'Main PA music feed. Disable to cut the show.',        'music_note',             'systems',       'toggle',   'warning', TRUE,  TRUE,  220),
  ('fog-machines',       'Fog Machines',              'Haze / fog atmospherics.',                            'foggy',                  'systems',       'toggle',   'neutral', FALSE, TRUE,  230),

  -- Announcements
  ('pa-general',         'General PA Announcement',   'Broadcast pre-recorded general notice.',              'campaign',               'announcements', 'one_shot', 'primary', FALSE, NULL, 300),
  ('pa-medical',         'Medical Assistance Needed', 'Request medical personnel over PA.',                  'health_and_safety',      'announcements', 'one_shot', 'warning', FALSE, NULL, 310),
  ('pa-evacuate',        'Evacuation Announcement',   'Trigger full-venue evacuation script.',               'directions_run',         'announcements', 'one_shot', 'error',   TRUE,  NULL, 320);

-- -------- Initial venue_system_state (one row per toggle action per venue) --
INSERT INTO venue_system_state (venue_id, action_id, is_on)
SELECT v.id, ea.id, ea.default_on
FROM   venue v
CROSS  JOIN escalation_action ea
WHERE  ea.kind = 'toggle';

-- -------- Alerts (active) --------
-- References use now() - interval to keep the "minutes ago" relative feel
-- after the container is started.
INSERT INTO alert (
  venue_id, camera_id, reference, title, description,
  severity, risk, confidence, location, zone,
  coords_lat, coords_lng, detected_at, preview_url, status,
  lead_responder, involved_parties, bounding_box, source
)
SELECT
  v.id, c.id, a.reference, a.title, a.description,
  a.severity::alert_severity, a.risk::risk_level, a.confidence, a.location, a.zone,
  a.coords_lat, a.coords_lng, now() - (a.minutes_ago || ' minutes')::interval,
  a.preview_url, a.status::alert_status,
  a.lead_responder, a.involved_parties, a.bounding_box::jsonb, 'ai'::alert_source
FROM venue v
JOIN (VALUES
  ('402', 'Possible fight near bar',
          'Raised voices and sudden crowd movement detected. Two patrons pushed into the counter; a third joined and the group separated after 18 seconds.',
          'critical', 'high', 82, 'Bar Area North', 'South Concourse',
          46.0511, 14.5051, 12,
          'https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=400&q=60',
          'active', 'Unit 14 · Officer Miller', 3,
          '{"x":0.34,"y":0.28,"width":0.28,"height":0.46,"label":"Conflict 82%"}',
          'cam-bar'),
  ('403', 'Dense crowd forming near stage',
          'Crowd density crossing the safe threshold in front of the main stage left barrier.',
          'warning', 'medium', 67, 'Main Stage', 'North Hall',
          NULL, NULL, 5,
          'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?auto=format&fit=crop&w=400&q=60',
          'active', 'Floor Lead · Priya R.', 180,
          NULL,
          'cam-stage'),
  ('404', 'Queue backup at entrance',
          'Entrance queue grew past 80 patrons. Consider opening secondary lane.',
          'info', 'low', 54, 'Entrance Queue', 'Front of House',
          NULL, NULL, 9,
          'https://images.unsplash.com/photo-1493676304819-0d7a8d026dcf?auto=format&fit=crop&w=400&q=60',
          'active', 'Gate Supervisor · Jamal K.', 84,
          NULL,
          'cam-entrance'),
  ('405', 'Guest unresponsive on dance floor',
          'Patron on the floor near grid C3, not moving for 22 seconds. Surrounding crowd is clearing space.',
          'critical', 'high', 74, 'Dance Floor Center', 'Dance Floor',
          NULL, NULL, 2,
          'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?auto=format&fit=crop&w=400&q=60',
          'active', 'Medic 02 · R. Okafor', 1,
          '{"x":0.48,"y":0.54,"width":0.14,"height":0.22,"label":"Person down 74%"}',
          'cam-main'),
  ('406', 'Loitering near fire exit',
          'Same individual blocking emergency exit B for over 3 minutes despite signage.',
          'warning', 'medium', 71, 'Fire Exit B', 'South Concourse',
          NULL, NULL, 7,
          'https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=400&q=60',
          'active', 'Floor Team · Marco B.', 1,
          NULL,
          'cam-bar')
) AS a(reference, title, description, severity, risk, confidence, location, zone,
       coords_lat, coords_lng, minutes_ago, preview_url, status, lead_responder,
       involved_parties, bounding_box, camera_code)
  ON TRUE
JOIN camera c ON c.code = a.camera_code AND c.venue_id = v.id
WHERE v.code = 'foundry-north-hall';

-- -------- Alerts (historical / archived) --------
INSERT INTO alert (
  venue_id, camera_id, reference, title, description,
  severity, risk, confidence, location, zone,
  detected_at, status, handled_by_user_id, lead_responder, source
)
SELECT
  v.id, c.id, a.reference, a.title, a.description,
  a.severity::alert_severity, a.risk::risk_level, a.confidence, a.location, a.zone,
  now() - (a.minutes_ago || ' minutes')::interval,
  a.status::alert_status,
  NULL, a.lead_responder, 'ai'::alert_source
FROM venue v
JOIN (VALUES
  ('398', 'Intoxicated guest escorted out',
          'Single guest assisted to taxi queue without further incident.',
          'warning', 'medium', 61, 'VIP Entrance', 'VIP Lounge',
          125, 'dismissed', 'Admin Sarah', 'cam-entrance'),
  ('397', 'Unattended bag detected',
          'Dispatched Security Team 04 to investigate and recover.',
          'critical', 'high', 78, 'Coat Check', 'North Plaza',
          160, 'confirmed', 'Unit 04 · Officer Chen', 'cam-entrance'),
  ('385', 'Slip & fall near bar',
          'Medical team responded; guest declined further assistance.',
          'warning', 'medium', 88, 'Bar Area North', 'South Concourse',
          1440, 'resolved', 'Medic 01', 'cam-bar'),
  ('381', 'Exterior door propped open',
          'Automatic closure triggered after 90s.',
          'info', 'low', 92, 'Loading Dock', 'Loading Dock',
          1520, 'resolved', NULL, 'cam-main')
) AS a(reference, title, description, severity, risk, confidence, location, zone,
       minutes_ago, status, lead_responder, camera_code)
  ON TRUE
JOIN camera c ON c.code = a.camera_code AND c.venue_id = v.id
WHERE v.code = 'foundry-north-hall';

-- -------- Alert timeline events for the active "bar fight" alert --------
INSERT INTO alert_event (alert_id, kind, title, description, occurred_at)
SELECT a.id, e.kind::incident_event_kind, e.title, e.description,
       now() - (e.minutes_ago || ' minutes')::interval
FROM   alert a
JOIN   (VALUES
  ('detection',    'Initial detection',    'AI Analytics flagged erratic movement in Grid B4.',                     12),
  ('confirmation', 'Human confirmation',   'Lead dispatcher visually confirmed verbal altercation.',                11),
  ('dispatch',     'Security dispatched',  'Officers Miller and Chen en route to Bar Area North.',                  10)
) AS e(kind, title, description, minutes_ago) ON TRUE
WHERE  a.reference = '402';

INSERT INTO alert_event (alert_id, kind, title, description, occurred_at)
SELECT a.id, 'detection'::incident_event_kind,
       'Density threshold crossed',
       '2.8 persons/m² sustained for 45 seconds in front-left pit.',
       now() - interval '5 minutes'
FROM   alert a WHERE a.reference = '403';

INSERT INTO alert_event (alert_id, kind, title, description, occurred_at)
SELECT a.id, 'detection'::incident_event_kind,
       'Queue length advisory',
       'Outdoor queue exceeded recommended maximum.',
       now() - interval '9 minutes'
FROM   alert a WHERE a.reference = '404';

INSERT INTO alert_event (alert_id, kind, title, description, occurred_at)
SELECT a.id, 'detection'::incident_event_kind,
       'Fall detected',
       'Pose analytics flagged a sustained prone posture.',
       now() - interval '2 minutes'
FROM   alert a WHERE a.reference = '405';

INSERT INTO alert_event (alert_id, kind, title, description, occurred_at)
SELECT a.id, 'detection'::incident_event_kind,
       'Exit obstruction',
       'Emergency egress path partially blocked.',
       now() - interval '7 minutes'
FROM   alert a WHERE a.reference = '406';

-- -------- Alert notes --------
INSERT INTO alert_note (alert_id, author_name, text, kind, created_at)
SELECT a.id, n.author, n.text, n.kind::response_note_kind,
       now() - (n.minutes_ago || ' minutes')::interval
FROM   alert a
JOIN   (VALUES
  ('Officer Miller',   'radio', 8, '"Arrived on scene. Three males separated. Attempting to de-escalate. No weapons visible."'),
  ('Lead Dispatcher',  'note',  6, '"Maintaining visual via Camera 12 and 14. Standing by for medical request."')
) AS n(author, kind, minutes_ago, text) ON TRUE
WHERE  a.reference = '402';

INSERT INTO alert_note (alert_id, author_name, text, kind, created_at)
SELECT a.id, 'Floor Lead · Priya R.',
       '"Rerouting inbound traffic to stage-right. Monitoring."',
       'note'::response_note_kind,
       now() - interval '3 minutes'
FROM alert a WHERE a.reference = '403';

-- -------- Guest reports --------
INSERT INTO guest_report (
  venue_id, reference, kind, title, message, location,
  guest_handle, guest_email, submitted_at, status, priority
)
SELECT v.id, g.reference, g.kind::guest_report_kind, g.title, g.message, g.location,
       g.guest_handle, g.guest_email,
       now() - (g.minutes_ago || ' minutes')::interval,
       g.status::guest_report_status, g.priority::guest_report_priority
FROM   venue v
JOIN (VALUES
  ('GR-8421', 'medical',    'Friend feels faint',
              'My friend is feeling dizzy and needs somewhere to sit — we''re near the main bar on the right.',
              'Main Bar · right side', 'Guest · Alex K.', 'alex.k@guestmail.com', 1, 'new', 'high'),
  ('GR-8420', 'safety',     'Feeling unsafe near stage',
              'A group of guys keeps pushing and it''s getting aggressive in the pit left of the stage.',
              'Main Stage · front-left', 'Anonymous', 'anonymous-8420@guestmail.com', 4, 'new', 'high'),
  ('GR-8419', 'hazard',     'Wet floor in restrooms',
              'Someone spilled a drink outside the women''s restrooms on the 2nd floor. People are slipping.',
              '2F Restrooms', 'Guest · Priya M.', 'priya.m@guestmail.com', 8, 'acknowledged', 'medium'),
  ('GR-8418', 'lost_item',  'Lost black jacket',
              'I think I left my black jacket near the cloakroom around 11pm. Phone in the pocket.',
              'Cloakroom', 'Guest · Lina T.', 'lina.t@guestmail.com', 15, 'new', 'low'),
  ('GR-8417', 'harassment', 'Being followed by a stranger',
              'A guy keeps following me around the venue and won''t leave me alone. Currently near the stage-right exit.',
              'Stage · right exit', 'Guest #A47', 'a47@guestmail.com', 2, 'new', 'high')
) AS g(reference, kind, title, message, location, guest_handle, guest_email, minutes_ago, status, priority)
  ON TRUE
WHERE v.code = 'foundry-north-hall';

-- =============================================================================
-- PostgREST roles
-- -----------------------------------------------------------------------------
-- The `api` service in docker-compose.yml runs PostgREST, which exposes the
-- tables above as a read-only REST API at http://web/api/ (proxied by nginx).
--
-- PostgREST logs in as `authenticator`, then `SET ROLE`s to `web_anon` for
-- unauthenticated requests. When Keycloak is wired up, add a `web_operator`
-- role with INSERT/UPDATE rights and switch on the verified JWT.
-- =============================================================================
CREATE ROLE web_anon      NOLOGIN;
CREATE ROLE authenticator LOGIN PASSWORD 'authenticator' NOINHERIT;
GRANT web_anon TO authenticator;

GRANT USAGE  ON SCHEMA public TO web_anon;
GRANT SELECT ON ALL TABLES    IN SCHEMA public TO web_anon;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO web_anon;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES    TO web_anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON SEQUENCES TO web_anon;

-- -----------------------------------------------------------------------------
-- Operational writes.
--
-- For the hackathon demo web_anon is also allowed to mutate the operator
-- tables so the UI's confirm / dismiss / escalate / add-note buttons persist.
-- Once Keycloak issues JWTs, move these grants to a `web_operator` role and
-- drop INSERT/UPDATE/DELETE from web_anon.
-- -----------------------------------------------------------------------------
GRANT INSERT, UPDATE, DELETE ON
  alert, alert_event, alert_note,
  guest_report,
  venue_system_state, escalation_log
TO web_anon;
