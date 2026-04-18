import { DatePipe, LowerCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { ToastComponent } from '../../components/toast/toast.component';
import { AlertsService } from '../../services/alerts.service';
import {
  IncidentEventKind,
  RiskLevel,
  VenueAlert,
} from '../../models/venue.models';

@Component({
  selector: 'va-incident-detail',
  standalone: true,
  imports: [DatePipe, LowerCasePipe, FormsModule, RouterLink, ToastComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="h-full overflow-y-auto bg-surface">
      <div class="max-w-[1400px] mx-auto px-6 md:px-8 py-8">
        @if (incident(); as item) {
          <!-- Header -->
          <div class="flex flex-col gap-3 mb-6">
            <div class="flex items-center gap-3">
              <button
                type="button"
                class="w-9 h-9 flex items-center justify-center rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface-variant transition-colors"
                (click)="goBack()"
                title="Back to incidents"
              >
                <span class="material-symbols-outlined">arrow_back</span>
              </button>
              <div class="min-w-0">
                <div class="text-[11px] font-mono uppercase tracking-widest text-on-surface-variant">
                  Incident #{{ item.reference }}
                </div>
                <h1
                  class="text-2xl md:text-3xl font-extrabold tracking-tightest text-on-surface mt-0.5 truncate"
                >
                  {{ item.title }}
                </h1>
              </div>
            </div>

            <div class="flex flex-wrap items-center gap-2 pl-12">
              <span class="chip" [class]="statusChipClass()">{{ statusLabel() }}</span>
              <span class="chip bg-surface-container-high text-on-surface-variant">
                <span class="material-symbols-outlined text-[14px]">schedule</span>
                Started {{ item.detectedAt | date: 'shortTime' }}
              </span>
              <span class="chip bg-surface-container-high text-on-surface-variant">
                <span class="material-symbols-outlined text-[14px]">location_on</span>
                Zone: {{ item.zone }}
              </span>
              <span class="chip bg-surface-container-high text-on-surface-variant">
                <span class="material-symbols-outlined text-[14px]">videocam</span>
                {{ cameraLabel() }}
              </span>
            </div>
          </div>

          <div class="flex flex-col lg:flex-row gap-6">
            <!-- Main column -->
            <div class="flex-[3] flex flex-col gap-6 min-w-0">
              <!-- Media player -->
              <div
                class="bg-surface-container rounded-xl overflow-hidden aspect-video relative group"
              >
                <img
                  class="w-full h-full object-cover opacity-75"
                  [src]="cameraImage()"
                  [alt]="item.title + ' footage'"
                  loading="lazy"
                />
                <div class="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20"></div>

                <div
                  class="absolute top-4 left-4 inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-error/85 text-[10px] font-bold uppercase tracking-widest text-on-error"
                >
                  <span class="w-1.5 h-1.5 bg-on-error rounded-full animate-soft-pulse"></span>
                  Live Replay
                </div>

                @if (item.boundingBox; as box) {
                  <div
                    class="absolute pointer-events-none animate-fade-in"
                    [style.left.%]="box.x * 100"
                    [style.top.%]="box.y * 100"
                    [style.width.%]="box.width * 100"
                    [style.height.%]="box.height * 100"
                  >
                    <div class="w-full h-full rounded-sm border-2 border-error/70 bg-error/10"></div>
                    <span
                      class="absolute -top-5 left-0 text-[9px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded bg-error text-on-error"
                    >
                      {{ box.label }}
                    </span>
                  </div>
                }

                <!-- Player chrome -->
                <div class="absolute bottom-0 left-0 right-0 p-4 md:p-5">
                  <!-- Timeline -->
                  <div class="relative h-1.5 bg-surface-container-high/70 rounded-full mb-4">
                    <div
                      class="absolute left-0 top-0 h-full bg-primary rounded-full"
                      [style.width.%]="playbackPct()"
                    ></div>
                    @for (marker of playbackMarkers(); track marker.label) {
                      <div
                        class="absolute -top-1 w-3 h-3 rounded-full border-2 border-surface shadow-[0_0_0_2px_rgba(0,0,0,0.3)]"
                        [class]="marker.color"
                        [style.left.%]="marker.pct"
                        [title]="marker.label + ' · ' + marker.time"
                      ></div>
                    }
                  </div>

                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-3 text-on-surface">
                      <button
                        type="button"
                        class="w-9 h-9 rounded-full bg-surface-container-high/80 backdrop-blur flex items-center justify-center hover:bg-surface-bright transition-colors"
                      >
                        <span class="material-symbols-outlined sym-fill text-[20px]">
                          play_arrow
                        </span>
                      </button>
                      <button
                        type="button"
                        class="text-on-surface-variant hover:text-on-surface transition-colors"
                      >
                        <span class="material-symbols-outlined">replay_10</span>
                      </button>
                      <button
                        type="button"
                        class="text-on-surface-variant hover:text-on-surface transition-colors"
                      >
                        <span class="material-symbols-outlined">forward_10</span>
                      </button>
                      <span class="text-xs font-mono text-on-surface/70 ml-2">
                        {{ playheadLabel() }} / {{ durationLabel() }}
                      </span>
                    </div>
                    <div class="flex items-center gap-2 text-on-surface-variant">
                      <button class="hover:text-on-surface transition-colors">
                        <span class="material-symbols-outlined">download</span>
                      </button>
                      <button class="hover:text-on-surface transition-colors">
                        <span class="material-symbols-outlined">fullscreen</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Timeline + Notes grid -->
              <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <!-- Event timeline -->
                <div class="bg-surface-container rounded-xl p-5">
                  <h3
                    class="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant mb-5 flex items-center gap-2"
                  >
                    <span class="material-symbols-outlined text-[16px]">history</span>
                    Event Timeline
                  </h3>

                  <ol class="relative flex flex-col gap-5">
                    <div
                      class="absolute left-[9px] top-2 bottom-2 w-px bg-outline-variant/30"
                    ></div>
                    @for (event of item.events; track event.at) {
                      <li class="flex gap-4 relative">
                        <div
                          class="w-5 h-5 rounded-full border-4 border-surface-container z-10 flex-shrink-0"
                          [class]="eventDotClass(event.kind)"
                        ></div>
                        <div class="min-w-0">
                          <span class="text-[11px] font-mono text-on-surface-variant">
                            {{ event.at | date: 'HH:mm:ss' }}
                          </span>
                          <p class="text-sm font-semibold text-on-surface">
                            {{ event.title }}
                          </p>
                          <p class="text-xs text-on-surface-variant mt-0.5 leading-relaxed">
                            {{ event.description }}
                          </p>
                        </div>
                      </li>
                    }
                  </ol>
                </div>

                <!-- Response log -->
                <div class="bg-surface-container rounded-xl p-5 flex flex-col">
                  <h3
                    class="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant mb-4 flex items-center gap-2"
                  >
                    <span class="material-symbols-outlined text-[16px]">edit_note</span>
                    Response Log
                  </h3>

                  <div class="flex flex-col gap-3 overflow-y-auto max-h-[260px] pr-1">
                    @for (note of item.notes; track note.at) {
                      <div class="bg-surface-container-high rounded-lg p-3">
                        <div class="flex justify-between items-start mb-1 gap-2">
                          <span class="text-xs font-semibold text-primary">
                            {{ note.author }}
                          </span>
                          <span class="text-[10px] font-mono text-on-surface-variant">
                            {{ note.at | date: 'HH:mm' }}
                          </span>
                        </div>
                        <p
                          class="text-xs leading-relaxed text-on-surface/90"
                          [class.italic]="note.kind === 'radio'"
                        >
                          {{ note.text }}
                        </p>
                      </div>
                    }
                    @if (item.notes.length === 0) {
                      <div class="text-xs text-on-surface-variant italic">
                        No response notes yet. Add the first one below.
                      </div>
                    }
                  </div>

                  <div class="mt-4 flex flex-col gap-2">
                    <textarea
                      [ngModel]="noteDraft()"
                      (ngModelChange)="noteDraft.set($event)"
                      rows="2"
                      class="w-full bg-surface-container-lowest rounded-lg text-xs p-3 text-on-surface outline-none focus:ring-1 focus:ring-primary placeholder:text-on-surface-variant/50 resize-none"
                      placeholder="Add time-stamped note..."
                    ></textarea>
                    <div class="flex items-center justify-between">
                      <span class="text-[10px] text-on-surface-variant">
                        Posting as
                        <span class="text-on-surface font-semibold">Mia Chen</span>
                      </span>
                      <button
                        type="button"
                        (click)="submitNote(item)"
                        [disabled]="!noteDraft().trim()"
                        class="inline-flex items-center gap-1 px-3 h-8 rounded-lg bg-primary text-on-primary text-xs font-semibold hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      >
                        <span class="material-symbols-outlined text-[16px]">send</span>
                        Post note
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Side panel -->
            <aside class="flex-1 min-w-[300px] flex flex-col gap-5">
              <!-- Metadata -->
              <div class="bg-surface-container rounded-xl p-5">
                <h3
                  class="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant pb-3"
                >
                  Incident Metadata
                </h3>
                <dl class="space-y-3.5 text-sm">
                  <div class="flex items-center justify-between gap-3">
                    <dt class="text-xs text-on-surface-variant">Location</dt>
                    <dd class="text-sm font-medium text-on-surface">{{ item.location }}</dd>
                  </div>
                  <div class="flex items-center justify-between gap-3">
                    <dt class="text-xs text-on-surface-variant">Time reported</dt>
                    <dd class="text-sm font-mono text-on-surface">
                      {{ item.detectedAt | date: 'HH:mm:ss' }}
                    </dd>
                  </div>
                  @if (item.involvedParties !== undefined) {
                    <div class="flex items-center justify-between gap-3">
                      <dt class="text-xs text-on-surface-variant">Involved</dt>
                      <dd class="text-sm font-medium text-on-surface">
                        {{ item.involvedParties }}
                      </dd>
                    </div>
                  }
                  <div class="flex items-center justify-between gap-3">
                    <dt class="text-xs text-on-surface-variant">Confidence</dt>
                    <dd class="text-sm font-medium text-on-surface">
                      {{ item.confidence }}%
                    </dd>
                  </div>
                  <div class="flex items-center justify-between gap-3">
                    <dt class="text-xs text-on-surface-variant">Risk level</dt>
                    <dd>
                      <span class="chip" [class]="riskChipClass(item.risk)">{{ item.risk }}</span>
                    </dd>
                  </div>
                  @if (item.leadResponder) {
                    <div class="flex items-center justify-between gap-3">
                      <dt class="text-xs text-on-surface-variant">Lead responder</dt>
                      <dd class="text-sm font-medium text-on-surface truncate">
                        {{ item.leadResponder }}
                      </dd>
                    </div>
                  }
                </dl>
              </div>

              <!-- Controls -->
              @if (item.status === 'active') {
                <div class="flex flex-col gap-2">
                  <button
                    type="button"
                    (click)="resolve(item)"
                    class="w-full h-11 rounded-lg bg-primary text-on-primary font-semibold text-sm inline-flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.98] transition-all"
                  >
                    <span class="material-symbols-outlined text-[18px]">check_circle</span>
                    Mark as resolved
                  </button>
                  <button
                    type="button"
                    (click)="escalate(item)"
                    class="w-full h-11 rounded-lg bg-error-container text-on-error-container font-semibold text-sm inline-flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.98] transition-all"
                  >
                    <span class="material-symbols-outlined text-[18px]">local_police</span>
                    Escalate to police
                  </button>
                  <button
                    type="button"
                    (click)="requestBackup(item)"
                    class="w-full h-11 rounded-lg bg-surface-container-highest text-on-surface font-semibold text-sm inline-flex items-center justify-center gap-2 hover:bg-surface-bright active:scale-[0.98] transition-all"
                  >
                    <span class="material-symbols-outlined text-[18px]">group_add</span>
                    Request backup
                  </button>
                </div>
              } @else {
                <div
                  class="bg-surface-container rounded-xl p-5 flex items-center gap-3"
                >
                  <span class="material-symbols-outlined sym-fill text-primary">check_circle</span>
                  <div>
                    <div class="text-sm font-semibold text-on-surface">
                      Incident {{ statusLabel() | lowercase }}
                    </div>
                    @if (item.handledBy) {
                      <div class="text-xs text-on-surface-variant">
                        Handled by {{ item.handledBy }}
                      </div>
                    }
                  </div>
                </div>
              }

              <!-- Zone history -->
              <div class="bg-surface-container rounded-xl p-5">
                <div class="flex justify-between items-center mb-3">
                  <h3
                    class="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant"
                  >
                    Zone history
                  </h3>
                  <a
                    routerLink="/incidents"
                    class="text-[11px] text-primary font-semibold hover:underline"
                    >View all</a
                  >
                </div>
                <div class="flex flex-col gap-2">
                  @if (related().length === 0) {
                    <div class="text-xs text-on-surface-variant italic">
                      No other incidents in this zone today.
                    </div>
                  }
                  @for (other of related(); track other.id) {
                    <a
                      [routerLink]="['/incidents', other.id]"
                      class="flex items-start gap-3 p-2 rounded-lg hover:bg-surface-container-high transition-colors"
                    >
                      <div
                        class="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                        [class]="miniIconClass(other)"
                      >
                        <span class="material-symbols-outlined text-[18px]">{{
                          miniIcon(other)
                        }}</span>
                      </div>
                      <div class="min-w-0 flex-1">
                        <div class="text-xs font-semibold text-on-surface truncate">
                          #{{ other.reference }} · {{ other.title }}
                        </div>
                        <div class="text-[10px] text-on-surface-variant mt-0.5">
                          {{ other.detectedAt | date: 'shortTime' }} ·
                          {{ statusLabelFor(other.status) }}
                        </div>
                      </div>
                    </a>
                  }
                </div>
              </div>

              <!-- Map snippet -->
              <div
                class="bg-surface-container rounded-xl overflow-hidden h-44 relative"
              >
                <svg
                  viewBox="0 0 320 200"
                  xmlns="http://www.w3.org/2000/svg"
                  class="absolute inset-0 w-full h-full opacity-50"
                  aria-hidden="true"
                >
                  <defs>
                    <pattern id="mini-grid" width="16" height="16" patternUnits="userSpaceOnUse">
                      <path
                        d="M 16 0 L 0 0 0 16"
                        fill="none"
                        class="stroke-surface-container-highest"
                        stroke-width="0.5"
                      />
                    </pattern>
                  </defs>
                  <rect width="320" height="200" fill="url(#mini-grid)" />
                  <rect
                    x="14"
                    y="14"
                    width="292"
                    height="172"
                    rx="6"
                    fill="none"
                    class="stroke-outline-variant"
                    stroke-width="2"
                  />
                  <rect
                    x="30"
                    y="26"
                    width="90"
                    height="38"
                    rx="3"
                    class="fill-surface-container-high stroke-outline-variant"
                  />
                  <rect
                    x="30"
                    y="80"
                    width="160"
                    height="80"
                    rx="4"
                    class="fill-surface-container stroke-outline-variant"
                  />
                  <rect
                    x="210"
                    y="30"
                    width="90"
                    height="70"
                    rx="3"
                    class="fill-surface-container-high stroke-outline-variant"
                  />
                </svg>

                <div class="absolute inset-0 flex items-center justify-center">
                  <div class="relative">
                    <div class="w-5 h-5 bg-error/60 rounded-full animate-soft-pulse"></div>
                    <div class="absolute inset-1 bg-error rounded-full"></div>
                  </div>
                </div>

                @if (item.coords; as coords) {
                  <div
                    class="absolute bottom-2 right-2 bg-surface-container-lowest/85 backdrop-blur-sm px-2 py-1 rounded text-[10px] font-mono text-on-surface-variant"
                  >
                    {{ coords.lat.toFixed(4) }}° N · {{ coords.lng.toFixed(4) }}° E
                  </div>
                }
              </div>
            </aside>
          </div>
        } @else {
          <div class="bg-surface-container rounded-xl p-12 text-center">
            <span class="material-symbols-outlined text-4xl text-on-surface-variant"
              >search_off</span
            >
            <h2 class="text-xl font-bold text-on-surface mt-3">Incident not found</h2>
            <p class="text-sm text-on-surface-variant mt-1">
              This incident may have been archived.
            </p>
            <a
              routerLink="/incidents"
              class="inline-flex items-center gap-2 mt-4 px-4 h-10 rounded-lg bg-primary text-on-primary text-sm font-semibold"
            >
              <span class="material-symbols-outlined text-[18px]">arrow_back</span>
              Back to incidents
            </a>
          </div>
        }
      </div>

      <va-toast />
    </section>
  `,
})
export class IncidentDetailComponent {
  readonly id = input.required<string>();

  private readonly service = inject(AlertsService);
  private readonly router = inject(Router);

  protected readonly noteDraft = signal<string>('');

  protected readonly incident = computed(() => this.service.getIncident(this.id()));

  protected readonly related = computed(() => {
    const it = this.incident();
    return it ? this.service.relatedIncidents(it) : [];
  });

  protected readonly cameraLabel = computed(() => {
    const it = this.incident();
    if (!it) return '';
    return this.service.cameras().find((c) => c.id === it.cameraId)?.label ?? '';
  });

  protected readonly cameraImage = computed(() => {
    const it = this.incident();
    if (!it) return '';
    return (
      this.service.cameras().find((c) => c.id === it.cameraId)?.imageUrl ?? it.previewUrl
    );
  });

  protected readonly playbackPct = computed(() => {
    const it = this.incident();
    if (!it || !it.durationSeconds || !it.playheadSeconds) return 0;
    return Math.min(100, (it.playheadSeconds / it.durationSeconds) * 100);
  });

  protected readonly playbackMarkers = computed(() => {
    const it = this.incident();
    if (!it || !it.durationSeconds) return [];
    const start = it.detectedAt.getTime();
    const durationMs = it.durationSeconds * 1000;
    return it.events
      .map((e) => {
        const offset = e.at.getTime() - start;
        const pct = Math.max(2, Math.min(98, (offset / durationMs) * 100));
        return {
          label: e.title,
          time: e.at.toLocaleTimeString(),
          pct,
          color: this.eventMarkerClass(e.kind),
        };
      })
      .slice(0, 5);
  });

  protected readonly playheadLabel = computed(() =>
    this.formatSeconds(this.incident()?.playheadSeconds ?? 0),
  );
  protected readonly durationLabel = computed(() =>
    this.formatSeconds(this.incident()?.durationSeconds ?? 0),
  );

  protected readonly statusLabel = computed(() => this.statusLabelFor(this.incident()?.status ?? 'active'));

  protected statusLabelFor(status: string): string {
    switch (status) {
      case 'active':
        return 'Active · Responding';
      case 'confirmed':
        return 'Confirmed · Resolving';
      case 'escalated':
        return 'Escalated';
      case 'dismissed':
        return 'Dismissed';
      case 'resolved':
        return 'Resolved';
      default:
        return 'Unknown';
    }
  }

  protected statusChipClass(): string {
    const status = this.incident()?.status;
    switch (status) {
      case 'active':
      case 'escalated':
        return 'bg-error-container text-on-error-container';
      case 'confirmed':
        return 'bg-secondary-container text-on-secondary-container';
      case 'dismissed':
        return 'bg-surface-container-high text-on-surface-variant';
      case 'resolved':
        return 'bg-primary-container text-on-primary-container';
      default:
        return 'bg-surface-container-high text-on-surface-variant';
    }
  }

  protected riskChipClass(risk: RiskLevel): string {
    switch (risk) {
      case 'high':
        return 'bg-error-container text-on-error-container';
      case 'medium':
        return 'bg-secondary-container text-on-secondary-container';
      default:
        return 'bg-primary-container text-on-primary-container';
    }
  }

  protected eventDotClass(kind: IncidentEventKind): string {
    switch (kind) {
      case 'detection':
        return 'bg-error';
      case 'confirmation':
        return 'bg-secondary';
      case 'dispatch':
        return 'bg-primary';
      case 'escalation':
        return 'bg-error';
      case 'resolution':
        return 'bg-primary-container';
      default:
        return 'bg-on-surface-variant';
    }
  }

  protected eventMarkerClass(kind: IncidentEventKind): string {
    switch (kind) {
      case 'detection':
        return 'bg-error';
      case 'confirmation':
        return 'bg-secondary';
      case 'dispatch':
        return 'bg-primary';
      case 'escalation':
        return 'bg-error';
      case 'resolution':
        return 'bg-primary-container';
      default:
        return 'bg-on-surface-variant';
    }
  }

  protected miniIcon(other: VenueAlert): string {
    switch (other.severity) {
      case 'critical':
        return 'report';
      case 'warning':
        return 'warning';
      default:
        return 'info';
    }
  }

  protected miniIconClass(other: VenueAlert): string {
    switch (other.severity) {
      case 'critical':
        return 'bg-error-container/30 text-on-error-container';
      case 'warning':
        return 'bg-secondary-container/30 text-on-secondary-container';
      default:
        return 'bg-primary-container/30 text-on-primary-container';
    }
  }

  protected resolve(item: VenueAlert): void {
    this.service.resolveIncident(item.id);
  }

  protected escalate(item: VenueAlert): void {
    this.service.escalateAlert(item);
  }

  protected requestBackup(item: VenueAlert): void {
    this.service.requestBackup(item.id);
  }

  protected submitNote(item: VenueAlert): void {
    const text = this.noteDraft();
    if (!text.trim()) return;
    this.service.addNote(item.id, 'Mia Chen', text);
    this.noteDraft.set('');
  }

  protected goBack(): void {
    this.router.navigate(['/incidents']);
  }

  private formatSeconds(total: number): string {
    const mins = Math.floor(total / 60);
    const secs = Math.floor(total % 60);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
}
