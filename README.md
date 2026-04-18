# Vigilant Architect

A venue safety and event operations dashboard built with **Angular 18** and **Tailwind CSS**. The UI is designed for real human staff working live shifts at nightclubs, concerts, and festivals — calm, clear, and operational rather than futuristic or alarming.

## What's inside

- **Left panel** — Live camera grid (Main Floor, Bar, Entrance Queue, Stage Crowd) with labels, live indicators, a soft red frame when an incident is flagged, and scaled bounding boxes over the source imagery.
- **Right panel** — Active alert cards with title, confidence %, human location label ("Bar Area"), time detected, preview image, and Confirm / Dismiss / Escalate actions. Confirming an alert shows a subtle "Security team notified" toast. Below that is the timeline-style Activity Feed with Confirmed / Dismissed / Escalated / Resolved chips.
- **Pulse monitor** — Occupancy vs. capacity sparkline using the design's "Pulse" component rules (muted primary with a tertiary spike, no neon).
- **Venue map** — Inline SVG floor plan with heat zones (bar, stage, dance floor, lounge, entrance) and a simple legend.
- **Interaction** — Clicking any alert or camera tile selects that camera (ring highlight). No flashing, no alarms — transitions are gentle.

The visual system follows the *Operational Serenity* / *Vigilant Architect* design tokens defined in `stitch_design/DESIGN.md` (tonal dark surfaces, muted status colors, no hard 1px borders for sectioning, Manrope headlines + Inter body).

## Project structure

```
src/
├── app/
│   ├── app.component.ts          // Shell (top bar + side nav + outlet)
│   ├── app.config.ts
│   ├── app.routes.ts
│   ├── components/
│   │   ├── activity-feed/        // Timeline of handled alerts
│   │   ├── alert-card/           // Active alert card with actions
│   │   ├── camera-feed/          // Single camera tile with bounding boxes
│   │   ├── pulse-monitor/        // Occupancy + sparkline
│   │   ├── side-nav/             // Left navigation
│   │   ├── toast/                // Subtle confirmation toasts
│   │   ├── top-bar/              // App header
│   │   └── venue-map/            // SVG floor plan + heat zones
│   ├── models/venue.models.ts    // Alert / Camera types
│   ├── pages/dashboard/          // Main dashboard page
│   └── services/alerts.service.ts// Mock realtime state (Angular signals)
├── index.html
├── main.ts
└── styles.css                    // Tailwind layer + base styles
```

## Running locally (requires Node 20+)

```bash
npm install
npm start
```

The dev server listens on `http://localhost:4200`.

## Docker

Build and run the production image:

```bash
docker build -t vigilant-architect .
docker run --rm -p 8080:80 vigilant-architect
```

Or use Compose:

```bash
docker compose up --build
```

Then open <http://localhost:8080>.

The multi-stage `Dockerfile` builds the Angular bundle in `node:20-alpine` and serves the static `dist/vigilant-architect/browser` output through `nginx:1.27-alpine` with SPA history-API fallback, gzip, sane cache headers, and basic security headers (see `nginx.conf`).

## Design philosophy

The dashboard deliberately avoids the "mission control" cliché. It should feel like the event-ops tool it is:

- **Supportive, not alarming** — soft red accents for critical items, no flashing, no alarm noises, no neon.
- **Human language** — alerts reference real zones ("Bar Area") rather than camera IDs.
- **Staff-centric actions** — every alert offers Confirm / Dismiss / Escalate, mirroring how a floor manager actually thinks.
- **Tonal layering** — depth comes from background shifts (`surface` → `surface-container` → `surface-container-high`), not from 1-pixel borders.
