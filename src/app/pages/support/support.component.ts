import { ChangeDetectionStrategy, Component } from '@angular/core';

interface TechBadge {
  label: string;
  version?: string;
}

interface StackModule {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  accent: 'primary' | 'tertiary' | 'secondary' | 'neutral';
  repoPath: string;
  description: string;
  items: TechBadge[];
  endpoints?: string[];
}

@Component({
  selector: 'va-support',
  standalone: true,
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="h-full overflow-y-auto bg-surface">
      <div class="max-w-[1200px] mx-auto px-6 md:px-8 py-5 space-y-5">
        <!-- Header -->
        <header class="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div
              class="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant"
            >
              Help &amp; About
            </div>
            <h1
              class="text-2xl font-extrabold tracking-tightest text-on-surface mt-0.5"
            >
              Tech Stack
            </h1>
          </div>
          <p class="text-xs text-on-surface-variant max-w-md">
            ViReAl is assembled from five independent services. Each one lives
            in its own repo and can be swapped or scaled in isolation.
          </p>
        </header>

        <!-- Architecture diagram -->
        <section class="bg-surface-container rounded-xl p-4">
          <div class="flex items-center gap-2 mb-3">
            <span class="material-symbols-outlined text-[18px] text-on-surface-variant"
              >schema</span
            >
            <h2 class="text-sm font-bold text-on-surface">System topology</h2>
          </div>

          <div class="text-[11px] font-mono text-on-surface-variant bg-surface-container-low rounded-lg p-4 overflow-x-auto leading-relaxed">
<pre class="m-0">  staff browser                                 guest phone (Android · Kotlin)
        │                                               │
        ▼                                               ▼
  https://vireal.club                        POST /api/guest_report
        │                                               │
        ▼                                               │
  ┌─────────────┐  /api/*   ┌──────────────┐   ◄────────┘
  │  frontend   │──────────►│  PostgREST   │──► PostgreSQL 17 (vireal-pgdata)
  │  (nginx+SPA)│           │  api:3000    │
  │  vireal-web │           └──────────────┘
  └──────┬──────┘
         │ /gateway/*
         ▼
  ┌──────────────┐                  ┌──────────────┐
  │   gateway    │  ── AI_VISION ──►│   ai-vision  │  violence/fire
  │ (FastAPI)    │                  │ (FastAPI+HF) │  classifier
  └──────┬───────┘                  └──────────────┘
         │ /auth/*
         ▼
  ┌──────────────┐
  │   keycloak   │  OIDC · custom realm "vireal"
  └──────────────┘

  All services share the external docker network 'vireal-net'.
  Public traffic enters through Traefik on the host ('proxy' network).</pre>
          </div>
        </section>

        <!-- Module cards -->
        <section class="grid grid-cols-1 md:grid-cols-2 gap-4">
          @for (mod of modules; track mod.id) {
            <article class="bg-surface-container rounded-xl p-4 flex flex-col">
              <div class="flex items-start gap-3 mb-3">
                <div
                  class="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                  [class.bg-primary-container]="mod.accent === 'primary'"
                  [class.text-on-primary-container]="mod.accent === 'primary'"
                  [class.bg-tertiary-container]="mod.accent === 'tertiary'"
                  [class.text-on-tertiary-container]="mod.accent === 'tertiary'"
                  [class.bg-secondary-container]="mod.accent === 'secondary'"
                  [class.text-on-secondary-container]="mod.accent === 'secondary'"
                  [class.bg-surface-container-high]="mod.accent === 'neutral'"
                  [class.text-on-surface]="mod.accent === 'neutral'"
                >
                  <span class="material-symbols-outlined text-[22px]">{{
                    mod.icon
                  }}</span>
                </div>
                <div class="min-w-0 flex-1">
                  <div class="text-sm font-bold text-on-surface truncate">
                    {{ mod.title }}
                  </div>
                  <div
                    class="text-[11px] uppercase tracking-widest text-on-surface-variant mt-0.5"
                  >
                    {{ mod.subtitle }}
                  </div>
                </div>
                <code
                  class="text-[10px] font-mono text-on-surface-variant bg-surface-container-low px-2 py-1 rounded shrink-0"
                  [title]="mod.repoPath"
                  >{{ mod.repoPath }}</code
                >
              </div>

              <p class="text-xs text-on-surface-variant leading-relaxed mb-3">
                {{ mod.description }}
              </p>

              <div class="flex flex-wrap gap-1.5 mb-3">
                @for (item of mod.items; track item.label) {
                  <span
                    class="inline-flex items-center gap-1.5 text-[11px] bg-surface-container-low text-on-surface rounded-md px-2 py-1"
                  >
                    <span class="font-semibold">{{ item.label }}</span>
                    @if (item.version) {
                      <span class="text-on-surface-variant">{{
                        item.version
                      }}</span>
                    }
                  </span>
                }
              </div>

              @if (mod.endpoints?.length) {
                <div
                  class="mt-auto pt-3 border-t border-outline-variant/30 space-y-1"
                >
                  <div
                    class="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant"
                  >
                    Endpoints
                  </div>
                  @for (ep of mod.endpoints; track ep) {
                    <div class="text-[11px] font-mono text-on-surface-variant">
                      {{ ep }}
                    </div>
                  }
                </div>
              }
            </article>
          }
        </section>

        <!-- Footer meta -->
        <section class="bg-surface-container rounded-xl p-4">
          <div class="flex items-center gap-2 mb-3">
            <span class="material-symbols-outlined text-[18px] text-on-surface-variant"
              >deployed_code</span
            >
            <h2 class="text-sm font-bold text-on-surface">Deployment</h2>
          </div>
          <dl
            class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2 text-xs"
          >
            <div class="flex justify-between gap-2">
              <dt class="text-on-surface-variant">Orchestration</dt>
              <dd class="font-mono text-on-surface">Docker Compose</dd>
            </div>
            <div class="flex justify-between gap-2">
              <dt class="text-on-surface-variant">Reverse proxy</dt>
              <dd class="font-mono text-on-surface">Traefik + Let's Encrypt</dd>
            </div>
            <div class="flex justify-between gap-2">
              <dt class="text-on-surface-variant">Shared network</dt>
              <dd class="font-mono text-on-surface">vireal-net (external)</dd>
            </div>
            <div class="flex justify-between gap-2">
              <dt class="text-on-surface-variant">Public host</dt>
              <dd class="font-mono text-on-surface">vireal.club</dd>
            </div>
            <div class="flex justify-between gap-2">
              <dt class="text-on-surface-variant">CI/CD</dt>
              <dd class="font-mono text-on-surface">git pull · compose up</dd>
            </div>
            <div class="flex justify-between gap-2">
              <dt class="text-on-surface-variant">Built at</dt>
              <dd class="font-mono text-on-surface">DragonHack 2026</dd>
            </div>
          </dl>
        </section>
      </div>
    </section>
  `,
})
export class SupportComponent {
  protected readonly modules: StackModule[] = [
    {
      id: 'frontend',
      title: 'Frontend',
      subtitle: 'Operator dashboard',
      icon: 'dashboard',
      accent: 'primary',
      repoPath: 'dragonhack2026/frontend',
      description:
        'Single-page dashboard served by nginx. Talks to PostgREST for data and to the gateway for AI detection. Styled with a custom "Operational Serenity" design system.',
      items: [
        { label: 'Angular', version: '18' },
        { label: 'TypeScript', version: '5.5' },
        { label: 'Tailwind CSS', version: '3.4' },
        { label: 'RxJS', version: '7.8' },
        { label: 'keycloak-js', version: '26' },
        { label: 'nginx', version: '1.27' },
      ],
      endpoints: [
        'https://vireal.club/',
        'http://localhost:8100/ (docker)',
        'http://localhost:4200/ (ng serve)',
      ],
    },
    {
      id: 'gateway',
      title: 'Gateway',
      subtitle: 'API orchestrator',
      icon: 'hub',
      accent: 'tertiary',
      repoPath: 'dragonhack2026/gateway',
      description:
        'FastAPI service that glues the frontend to the vision model. Pulls camera clips, fans them out to ai-vision, streams per-chunk detections back over WebSocket, and persists results via PostgREST.',
      items: [
        { label: 'Python', version: '3.11' },
        { label: 'FastAPI' },
        { label: 'httpx' },
        { label: 'WebSockets' },
        { label: 'Uvicorn' },
      ],
      endpoints: [
        'GET  /gateway/health',
        'GET  /gateway/detections',
        'POST /gateway/analyze/{camera_code}',
        'POST /gateway/predict-upload',
        'WS   /gateway/analyze-realtime/{code}',
      ],
    },
    {
      id: 'ai',
      title: 'AI Vision',
      subtitle: 'Violence & fire classifier',
      icon: 'visibility',
      accent: 'secondary',
      repoPath: 'dragonhack2026/ai',
      description:
        'Stateless HTTP wrapper around a Hugging Face video-classification model (SlowFast-based). Accepts multipart uploads or URLs and returns per-chunk violent / non-violent probabilities.',
      items: [
        { label: 'Python', version: '3.11' },
        { label: 'FastAPI' },
        { label: 'PyTorch' },
        { label: 'Transformers' },
        { label: 'SlowFast' },
        { label: 'Hugging Face Hub' },
      ],
      endpoints: [
        'GET  /health',
        'POST /predict-upload (multipart)',
        'POST /predict-video/ (URL)',
      ],
    },
    {
      id: 'keycloak',
      title: 'Identity',
      subtitle: 'SSO / OIDC',
      icon: 'key',
      accent: 'neutral',
      repoPath: 'dragonhack2026/keycloak',
      description:
        'Keycloak realm "vireal" provides login, roles, and session refresh for the staff SPA. Ships with a custom branded login theme and pre-seeded demo users.',
      items: [
        { label: 'Keycloak', version: '26' },
        { label: 'OIDC · PKCE' },
        { label: 'PostgreSQL (separate)' },
        { label: 'Custom login theme' },
      ],
      endpoints: [
        'https://auth.vireal.club/realms/vireal',
        'client_id: vireal-web',
      ],
    },
    {
      id: 'data',
      title: 'Data layer',
      subtitle: 'Persistence & REST',
      icon: 'database',
      accent: 'neutral',
      repoPath: 'dragonhack2026/frontend/db',
      description:
        'PostgreSQL 17 holds cameras, alerts, incidents, guest reports, and staff. PostgREST exposes the public schema as a conventional REST API so the SPA and the mobile app can talk to it without a bespoke backend.',
      items: [
        { label: 'PostgreSQL', version: '17' },
        { label: 'PostgREST', version: '12' },
        { label: 'Row-level policies' },
        { label: 'init.sql seed' },
      ],
      endpoints: [
        'https://vireal.club/api/...',
        'postgres://vireal@db:5432/vireal',
      ],
    },
    {
      id: 'mobile',
      title: 'Guest Reporter',
      subtitle: 'Android companion app',
      icon: 'smartphone',
      accent: 'primary',
      repoPath: 'dragonhack2026/mobile',
      description:
        'Kotlin Android app for guests and roaming staff. Submits incident reports (location, photo, category) straight to PostgREST — same API the dashboard consumes, so reports show up live on the Reports page.',
      items: [
        { label: 'Kotlin' },
        { label: 'Jetpack Compose' },
        { label: 'Retrofit · OkHttp' },
        { label: 'Coroutines · Flow' },
        { label: 'CameraX' },
        { label: 'Material 3' },
      ],
      endpoints: [
        'POST /api/guest_report',
        'GET  /api/camera',
      ],
    },
  ];
}
