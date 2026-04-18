import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { ToastComponent } from '../../components/toast/toast.component';
import { AlertsService } from '../../services/alerts.service';
import {
  EscalationAction,
  EscalationService,
} from '../../services/escalation.service';
import { VenueAlert } from '../../models/venue.models';

type Pending =
  | {
      kind: 'trigger';
      action: EscalationAction;
    }
  | {
      kind: 'toggle';
      action: EscalationAction;
      nextOn: boolean;
    };

interface PlanStep {
  action: EscalationAction;
  /** For toggles: the recommended target state. Omitted for one-shots. */
  suggestedOn?: boolean;
  /** Short human-readable reason explaining *why* this step is recommended. */
  reason: string;
}

@Component({
  selector: 'va-escalate',
  standalone: true,
  imports: [DatePipe, RouterLink, ToastComponent],
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
              Operations · Rapid Response
            </div>
            <h1
              class="text-2xl font-extrabold tracking-tightest text-on-surface mt-0.5"
            >
              @if (currentAlert()) {
                Escalate alert {{ currentAlert()!.reference }}
              } @else {
                Escalate
              }
            </h1>
          </div>
          <p class="text-xs text-on-surface-variant max-w-md">
            Trigger the right response fast. All calls, dispatches and system
            changes are time-stamped in the response log
            @if (currentAlert()) {
              and attached to this alert's audit trail.
            } @else {
              .
            }
          </p>
        </header>

        <!-- Alert-scoped context + recommended plan -->
        @if (currentAlert(); as alert) {
          <section
            class="rounded-xl bg-surface-container p-4 border border-outline-variant/60"
          >
            <div class="flex items-start gap-3">
              @if (alert.previewUrl) {
                <img
                  class="w-20 h-20 rounded-lg object-cover bg-surface-container-highest shrink-0"
                  [src]="alert.previewUrl"
                  [alt]="alert.title + ' preview'"
                  loading="lazy"
                />
              } @else {
                <div
                  class="w-20 h-20 rounded-lg bg-surface-container-highest flex items-center justify-center shrink-0"
                >
                  <span
                    class="material-symbols-outlined text-on-surface-variant text-[26px]"
                    >videocam</span
                  >
                </div>
              }
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <span [class]="severityPillClass(alert)">
                    {{ severityLabel(alert) }}
                  </span>
                  <span
                    class="text-[10px] uppercase tracking-widest text-on-surface-variant font-semibold"
                  >
                    ID {{ alert.reference }}
                  </span>
                </div>
                <h2
                  class="text-base md:text-lg font-bold text-on-surface leading-snug mt-1"
                >
                  {{ alert.title }}
                </h2>
                <p
                  class="text-[12.5px] text-on-surface-variant mt-1 line-clamp-2"
                >
                  {{ alert.description }}
                </p>
                <div
                  class="mt-2 flex items-center gap-x-4 gap-y-1 text-[11px] text-on-surface-variant flex-wrap"
                >
                  <span class="inline-flex items-center gap-1">
                    <span class="material-symbols-outlined text-[13px]"
                      >location_on</span
                    >
                    {{ alert.location }}
                  </span>
                  <span class="inline-flex items-center gap-1">
                    <span class="material-symbols-outlined text-[13px]"
                      >schedule</span
                    >
                    {{ relative(alert.detectedAt) }}
                  </span>
                  <span class="inline-flex items-center gap-1">
                    <span class="material-symbols-outlined text-[13px]"
                      >insights</span
                    >
                    {{ alert.confidence }}% confidence
                  </span>
                </div>
              </div>
              <div class="flex flex-col gap-2 shrink-0">
                <a
                  [routerLink]="['/incidents', alert.id]"
                  class="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
                >
                  Open report
                  <span class="material-symbols-outlined text-[13px]"
                    >arrow_forward</span
                  >
                </a>
                <button
                  type="button"
                  (click)="clearAlertScope()"
                  class="text-[11px] text-on-surface-variant hover:text-on-surface hover:underline"
                >
                  Clear alert scope
                </button>
              </div>
            </div>
          </section>

          <!-- Recommended plan -->
          <section class="bg-surface-container rounded-xl p-4">
            <div class="flex items-center gap-2 mb-3 flex-wrap">
              <span
                class="material-symbols-outlined sym-fill text-primary text-[18px]"
                >checklist</span
              >
              <h2 class="text-sm font-bold text-on-surface">
                Recommended plan
              </h2>
              <span
                class="text-[10px] uppercase tracking-widest text-on-surface-variant"
              >
                {{ plan().length }} step{{ plan().length === 1 ? '' : 's' }}
              </span>
              <span class="ml-auto text-[11px] text-on-surface-variant">
                Tailored for this alert's severity and signals.
              </span>
            </div>

            <ol class="space-y-2">
              @for (step of plan(); track step.action.id; let idx = $index) {
                <li
                  class="rounded-lg bg-surface-container-lowest p-3 flex items-center gap-3"
                  [class.ring-1]="isStepDone(step)"
                  [class.ring-primary]="isStepDone(step)"
                >
                  <div
                    class="w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold shrink-0"
                    [class.bg-primary]="isStepDone(step)"
                    [class.text-on-primary]="isStepDone(step)"
                    [class.bg-surface-container-highest]="!isStepDone(step)"
                    [class.text-on-surface-variant]="!isStepDone(step)"
                  >
                    @if (isStepDone(step)) {
                      <span class="material-symbols-outlined text-[16px]"
                        >check</span
                      >
                    } @else {
                      {{ idx + 1 }}
                    }
                  </div>
                  <div
                    class="w-9 h-9 rounded-md flex items-center justify-center shrink-0"
                    [class.bg-error-container]="step.action.tone === 'error'"
                    [class.text-on-error-container]="
                      step.action.tone === 'error'
                    "
                    [class.bg-primary-container]="step.action.tone !== 'error'"
                    [class.text-on-primary-container]="
                      step.action.tone !== 'error'
                    "
                  >
                    <span
                      class="material-symbols-outlined sym-fill text-[19px]"
                      >{{ step.action.icon }}</span
                    >
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 flex-wrap">
                      <span class="text-sm font-semibold text-on-surface">
                        {{ step.action.label }}
                      </span>
                      @if (step.action.kind === 'toggle') {
                        <span
                          class="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full bg-surface-container-highest text-on-surface-variant"
                        >
                          Target {{ step.suggestedOn ? 'ON' : 'OFF' }}
                        </span>
                      }
                    </div>
                    <div
                      class="text-[11px] text-on-surface-variant mt-0.5 truncate"
                      [title]="step.reason"
                    >
                      {{ step.reason }}
                    </div>
                  </div>
                  @if (isStepDone(step)) {
                    <span
                      class="text-[10px] uppercase tracking-widest text-primary font-semibold whitespace-nowrap"
                    >
                      Done
                    </span>
                  } @else {
                    <button
                      type="button"
                      (click)="fireStep(step)"
                      class="inline-flex items-center gap-1 h-8 px-3 rounded-lg text-[11px] font-semibold transition-all hover:brightness-110"
                      [class.bg-error]="step.action.tone === 'error'"
                      [class.text-on-error]="step.action.tone === 'error'"
                      [class.bg-primary]="step.action.tone !== 'error'"
                      [class.text-on-primary]="step.action.tone !== 'error'"
                    >
                      <span class="material-symbols-outlined text-[14px]">{{
                        stepActionIcon(step)
                      }}</span>
                      {{ stepActionLabel(step) }}
                    </button>
                  }
                </li>
              }
            </ol>

            <div
              class="mt-4 pt-3 border-t border-outline-variant/60 flex items-center gap-2 flex-wrap"
            >
              <span class="text-[11px] text-on-surface-variant">
                {{ doneStepsCount() }} of {{ plan().length }} steps complete
              </span>
              <div class="ml-auto flex items-center gap-2">
                @if (alert.status !== 'escalated') {
                  <button
                    type="button"
                    (click)="markAlertEscalated()"
                    class="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-error text-on-error text-xs font-semibold hover:brightness-110 transition-all"
                  >
                    <span class="material-symbols-outlined text-[16px]"
                      >emergency_share</span
                    >
                    Mark alert as escalated
                  </button>
                } @else {
                  <span
                    class="inline-flex items-center gap-1 text-[11px] font-semibold text-error"
                  >
                    <span class="material-symbols-outlined text-[14px]"
                      >check_circle</span
                    >
                    Already marked escalated
                  </span>
                }
              </div>
            </div>
          </section>
        }

        <!-- Abnormal systems banner (always visible when relevant) -->
        @if (escalation.abnormalSystemCount() > 0) {
          <div
            class="rounded-xl border border-error/30 bg-error-container/30 px-4 py-3 flex items-center gap-3"
          >
            <span
              class="material-symbols-outlined sym-fill text-error text-[22px]"
              >warning</span
            >
            <div class="flex-1 min-w-0">
              <div class="text-sm font-bold text-on-surface">
                {{ escalation.abnormalSystemCount() }} venue system{{
                  escalation.abnormalSystemCount() === 1 ? '' : 's'
                }}
                in elevated state
              </div>
              <div
                class="text-[11px] text-on-surface-variant mt-0.5 truncate"
              >
                {{ abnormalSummary() }}
              </div>
            </div>
          </div>
        }

        <!-- All actions section header — only shown alongside plan -->
        @if (currentAlert()) {
          <div class="pt-1">
            <div
              class="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant"
            >
              All actions
            </div>
            <p class="text-[11px] text-on-surface-variant mt-0.5">
              Anything not in the recommended plan — fire manually if the
              situation calls for it.
            </p>
          </div>
        }

        <!-- Emergency services -->
        <section
          class="rounded-xl border border-error/30 bg-error-container/20 p-4"
        >
          <div class="flex items-center gap-2 mb-3">
            <span
              class="material-symbols-outlined sym-fill text-error text-[18px]"
              >sos</span
            >
            <h2 class="text-sm font-bold text-on-surface">Emergency Services</h2>
            <span
              class="ml-auto text-[10px] uppercase tracking-widest text-on-surface-variant"
              >Confirmation required</span
            >
          </div>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
            @for (action of byCategory().emergency; track action.id) {
              <button
                type="button"
                (click)="requestTrigger(action)"
                class="text-left rounded-xl bg-surface-container hover:bg-surface-container-high border border-error/40 hover:border-error transition-all p-4 group"
              >
                <div class="flex items-start gap-3">
                  <div
                    class="w-10 h-10 rounded-lg bg-error text-on-error flex items-center justify-center shrink-0"
                  >
                    <span
                      class="material-symbols-outlined sym-fill text-[22px]"
                      >{{ action.icon }}</span
                    >
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="text-sm font-bold text-on-surface">
                      {{ action.label }}
                    </div>
                    <div
                      class="text-[11px] text-on-surface-variant mt-0.5 line-clamp-2"
                    >
                      {{ action.description }}
                    </div>
                    @if (lastTriggeredAt(action.id); as when) {
                      <div
                        class="text-[10px] uppercase tracking-widest text-error font-semibold mt-2"
                      >
                        Last · {{ relative(when) }}
                      </div>
                    }
                  </div>
                </div>
              </button>
            }
          </div>
        </section>

        <!-- Internal teams + Venue systems -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <!-- Internal teams -->
          <section class="bg-surface-container rounded-xl p-4">
            <div class="flex items-center gap-2 mb-3">
              <span
                class="material-symbols-outlined text-[18px] text-on-surface-variant"
                >groups</span
              >
              <h2 class="text-sm font-bold text-on-surface">Internal Teams</h2>
            </div>
            <div class="space-y-2">
              @for (action of byCategory().internal; track action.id) {
                <button
                  type="button"
                  (click)="requestTrigger(action)"
                  class="w-full text-left rounded-lg bg-surface-container-lowest hover:bg-surface-container-highest transition-colors p-3 flex items-center gap-3"
                >
                  <div
                    class="w-9 h-9 rounded-md bg-primary-container text-on-primary-container flex items-center justify-center shrink-0"
                  >
                    <span class="material-symbols-outlined text-[19px]">{{
                      action.icon
                    }}</span>
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="text-sm font-semibold text-on-surface">
                      {{ action.label }}
                    </div>
                    <div
                      class="text-[11px] text-on-surface-variant mt-0.5 truncate"
                    >
                      {{ action.description }}
                    </div>
                  </div>
                  @if (lastTriggeredAt(action.id); as when) {
                    <span
                      class="text-[10px] text-on-surface-variant whitespace-nowrap"
                      >{{ relative(when) }}</span
                    >
                  }
                  <span
                    class="material-symbols-outlined text-[18px] text-on-surface-variant"
                    >chevron_right</span
                  >
                </button>
              }
            </div>
          </section>

          <!-- Venue systems -->
          <section class="bg-surface-container rounded-xl p-4">
            <div class="flex items-center gap-2 mb-3">
              <span
                class="material-symbols-outlined text-[18px] text-on-surface-variant"
                >tune</span
              >
              <h2 class="text-sm font-bold text-on-surface">Venue Systems</h2>
              <span
                class="ml-auto text-[10px] uppercase tracking-widest text-on-surface-variant"
                >Live toggles</span
              >
            </div>
            <div class="space-y-2">
              @for (action of byCategory().systems; track action.id) {
                <div
                  role="button"
                  tabindex="0"
                  (click)="requestToggle(action)"
                  (keydown.enter)="requestToggle(action)"
                  (keydown.space)="requestToggle(action); $event.preventDefault()"
                  class="w-full text-left rounded-lg bg-surface-container-lowest hover:bg-surface-container-highest transition-colors p-3 flex items-center gap-3 cursor-pointer"
                  [class.ring-1]="isAltered(action)"
                  [class.ring-error]="
                    isAltered(action) && action.tone === 'error'
                  "
                  [class.ring-primary]="
                    isAltered(action) && action.tone !== 'error'
                  "
                >
                  <div
                    class="w-9 h-9 rounded-md flex items-center justify-center shrink-0"
                    [class.bg-primary-container]="escalation.isSystemOn(action.id)"
                    [class.text-on-primary-container]="
                      escalation.isSystemOn(action.id)
                    "
                    [class.bg-surface-container-high]="
                      !escalation.isSystemOn(action.id)
                    "
                    [class.text-on-surface-variant]="
                      !escalation.isSystemOn(action.id)
                    "
                  >
                    <span
                      class="material-symbols-outlined text-[19px]"
                      [class.sym-fill]="escalation.isSystemOn(action.id)"
                      >{{ action.icon }}</span
                    >
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2">
                      <span class="text-sm font-semibold text-on-surface">{{
                        action.label
                      }}</span>
                      @if (isAltered(action)) {
                        <span
                          class="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full bg-error-container text-on-error-container"
                          >Altered</span
                        >
                      }
                    </div>
                    <div
                      class="text-[11px] text-on-surface-variant mt-0.5 truncate"
                    >
                      {{ action.description }}
                    </div>
                  </div>

                  <!-- Switch -->
                  <span
                    class="relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors"
                    [class.bg-primary]="escalation.isSystemOn(action.id)"
                    [class.bg-surface-container-high]="
                      !escalation.isSystemOn(action.id)
                    "
                    aria-hidden="true"
                  >
                    <span
                      class="absolute top-0.5 h-4 w-4 rounded-full bg-on-primary transition-transform"
                      [class.translate-x-4]="escalation.isSystemOn(action.id)"
                      [class.translate-x-0.5]="!escalation.isSystemOn(action.id)"
                    ></span>
                  </span>
                </div>
              }
            </div>
          </section>
        </div>

        <!-- Announcements -->
        <section class="bg-surface-container rounded-xl p-4">
          <div class="flex items-center gap-2 mb-3">
            <span
              class="material-symbols-outlined text-[18px] text-on-surface-variant"
              >campaign</span
            >
            <h2 class="text-sm font-bold text-on-surface">PA Announcements</h2>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
            @for (action of byCategory().announcements; track action.id) {
              <button
                type="button"
                (click)="requestTrigger(action)"
                class="text-left rounded-lg p-3 transition-colors"
                [class.bg-surface-container-lowest]="action.tone !== 'error'"
                [class.hover:bg-surface-container-highest]="
                  action.tone !== 'error'
                "
                [class.bg-error-container]="action.tone === 'error'"
                [class.text-on-error-container]="action.tone === 'error'"
                [class.hover:brightness-110]="action.tone === 'error'"
              >
                <div class="flex items-start gap-3">
                  <div
                    class="w-9 h-9 rounded-md flex items-center justify-center shrink-0"
                    [class.bg-error]="action.tone === 'error'"
                    [class.text-on-error]="action.tone === 'error'"
                    [class.bg-primary-container]="action.tone !== 'error'"
                    [class.text-on-primary-container]="action.tone !== 'error'"
                  >
                    <span
                      class="material-symbols-outlined sym-fill text-[19px]"
                      >{{ action.icon }}</span
                    >
                  </div>
                  <div class="min-w-0 flex-1">
                    <div
                      class="text-sm font-bold"
                      [class.text-on-surface]="action.tone !== 'error'"
                    >
                      {{ action.label }}
                    </div>
                    <div
                      class="text-[11px] mt-0.5 line-clamp-2"
                      [class.text-on-surface-variant]="action.tone !== 'error'"
                      [class.text-on-error-container]="action.tone === 'error'"
                    >
                      {{ action.description }}
                    </div>
                    @if (lastTriggeredAt(action.id); as when) {
                      <div
                        class="text-[10px] uppercase tracking-widest font-semibold mt-2"
                        [class.text-on-surface-variant]="action.tone !== 'error'"
                        [class.text-on-error-container]="action.tone === 'error'"
                      >
                        Last · {{ relative(when) }}
                      </div>
                    }
                  </div>
                </div>
              </button>
            }
          </div>
        </section>

        <!-- Response log -->
        <section class="bg-surface-container rounded-xl p-4">
          <div class="flex items-center gap-2 mb-3">
            <span
              class="material-symbols-outlined text-[18px] text-on-surface-variant"
              >history</span
            >
            <h2 class="text-sm font-bold text-on-surface">Response Log</h2>
            <span
              class="ml-auto text-[10px] uppercase tracking-widest text-on-surface-variant"
              >This shift</span
            >
          </div>
          @if (escalation.log().length === 0) {
            <p class="text-xs text-on-surface-variant px-1 py-2">
              No escalations triggered yet this shift.
            </p>
          } @else {
            <ol class="divide-y divide-outline-variant/60">
              @for (entry of escalation.log(); track entry.id) {
                <li class="py-2 flex items-center gap-3 text-sm">
                  <span
                    class="material-symbols-outlined text-[16px] text-on-surface-variant"
                    >{{ entry.enabled === false ? 'toggle_off' : 'bolt' }}</span
                  >
                  <span class="flex-1 min-w-0 truncate text-on-surface">
                    {{ entry.actionLabel }}
                    @if (entry.enabled !== undefined) {
                      <span class="text-on-surface-variant text-xs">
                        ·
                        {{ entry.enabled ? 'turned ON' : 'turned OFF' }}
                      </span>
                    }
                  </span>
                  <span class="text-[11px] text-on-surface-variant">
                    {{ entry.operator }}
                  </span>
                  <span
                    class="text-[11px] text-on-surface-variant tabular-nums"
                  >
                    {{ entry.at | date: 'HH:mm:ss' }}
                  </span>
                </li>
              }
            </ol>
          }
        </section>
      </div>

      <!-- Confirmation dialog -->
      @if (pending(); as p) {
        <div
          class="fixed inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in"
          (click)="cancel()"
        >
          <div
            class="bg-surface-container rounded-2xl w-full max-w-md mx-4 p-6 shadow-xl"
            (click)="$event.stopPropagation()"
            role="alertdialog"
          >
            <div class="flex items-start gap-3">
              <div
                class="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                [class.bg-error-container]="p.action.tone === 'error'"
                [class.text-on-error-container]="p.action.tone === 'error'"
                [class.bg-primary-container]="p.action.tone !== 'error'"
                [class.text-on-primary-container]="p.action.tone !== 'error'"
              >
                <span
                  class="material-symbols-outlined sym-fill text-[22px]"
                  >{{ p.action.icon }}</span
                >
              </div>
              <div class="min-w-0">
                <h2 class="text-base font-bold text-on-surface">
                  {{ dialogTitle(p) }}
                </h2>
                <p class="text-xs text-on-surface-variant mt-1">
                  {{ p.action.description }}
                </p>
                @if (currentAlert(); as alert) {
                  <p class="text-[11px] text-on-surface-variant mt-2">
                    Will be attached to alert
                    <span class="text-on-surface font-semibold"
                      >{{ alert.reference }}</span
                    >
                    · {{ alert.title }}
                  </p>
                }
                <p class="text-[11px] text-on-surface-variant mt-3">
                  Operator:
                  <span class="text-on-surface font-semibold">You</span>
                  &middot; {{ now() | date: 'HH:mm:ss' }}
                </p>
              </div>
            </div>

            <div class="flex items-center justify-end gap-2 mt-5">
              <button
                type="button"
                (click)="cancel()"
                class="px-3 h-9 rounded-lg border border-outline-variant bg-transparent text-on-surface text-xs font-semibold hover:bg-surface-container-highest hover:border-outline transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                (click)="confirm()"
                class="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg text-xs font-semibold transition-all hover:brightness-110"
                [class.bg-error]="p.action.tone === 'error'"
                [class.text-on-error]="p.action.tone === 'error'"
                [class.bg-primary]="p.action.tone !== 'error'"
                [class.text-on-primary]="p.action.tone !== 'error'"
              >
                <span class="material-symbols-outlined text-[14px]">{{
                  confirmIcon(p)
                }}</span>
                {{ confirmLabel(p) }}
              </button>
            </div>
          </div>
        </div>
      }

      <va-toast />
    </section>
  `,
})
export class EscalateComponent {
  protected readonly escalation = inject(EscalationService);
  protected readonly alerts = inject(AlertsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  /** Reactive `?alertId=` query parameter, keeps in sync with browser history. */
  private readonly queryMap = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });
  private readonly alertId = computed(
    () => this.queryMap().get('alertId') ?? null,
  );

  /** The alert this escalation page is scoped to, if any. */
  protected readonly currentAlert = computed<VenueAlert | null>(() => {
    const id = this.alertId();
    if (!id) return null;
    return this.alerts.getIncident(id) ?? null;
  });

  protected readonly byCategory = computed(() =>
    this.escalation.actionsByCategory(),
  );

  protected readonly pending = signal<Pending | null>(null);

  protected readonly abnormalSummary = computed(() => {
    const state = this.escalation.systemState();
    return this.escalation.actions
      .filter((a) => a.kind === 'toggle')
      .filter((a) => state[a.id] !== !!a.defaultOn)
      .map((a) => `${a.label} ${state[a.id] ? 'ON' : 'OFF'}`)
      .join(' · ');
  });

  /**
   * Recommendation engine — decides which actions are worth suggesting for
   * the currently scoped alert based on its severity and keyword signals
   * in the title / description. Returns an empty list when no alert is
   * scoped (nothing to plan).
   */
  protected readonly plan = computed<PlanStep[]>(() => {
    const alert = this.currentAlert();
    if (!alert) return [];
    return this.buildPlan(alert);
  });

  /** How many of the plan's steps are considered "done" at this moment. */
  protected readonly doneStepsCount = computed(
    () => this.plan().filter((s) => this.isStepDone(s)).length,
  );

  protected lastTriggeredAt(id: string): Date | null {
    return this.escalation.lastTriggered()[id] ?? null;
  }

  protected now(): Date {
    return new Date();
  }

  protected requestTrigger(action: EscalationAction): void {
    if (action.confirm) {
      this.pending.set({ kind: 'trigger', action });
    } else {
      this.escalation.triggerAction(action.id, { alertId: this.alertId() ?? undefined });
    }
  }

  protected requestToggle(action: EscalationAction): void {
    const nextOn = !this.escalation.isSystemOn(action.id);
    if (action.confirm) {
      this.pending.set({ kind: 'toggle', action, nextOn });
    } else {
      this.escalation.setSystem(action.id, nextOn, {
        alertId: this.alertId() ?? undefined,
      });
    }
  }

  protected confirm(): void {
    const p = this.pending();
    if (!p) return;
    const alertId = this.alertId() ?? undefined;
    if (p.kind === 'trigger') {
      this.escalation.triggerAction(p.action.id, { alertId });
    } else {
      this.escalation.setSystem(p.action.id, p.nextOn, { alertId });
    }
    this.pending.set(null);
  }

  protected cancel(): void {
    this.pending.set(null);
  }

  /** Fire a plan step via the regular trigger/toggle flow. */
  protected fireStep(step: PlanStep): void {
    if (step.action.kind === 'one_shot') {
      this.requestTrigger(step.action);
      return;
    }
    const nextOn = !!step.suggestedOn;
    if (step.action.confirm) {
      this.pending.set({ kind: 'toggle', action: step.action, nextOn });
    } else {
      this.escalation.setSystem(step.action.id, nextOn, {
        alertId: this.alertId() ?? undefined,
      });
    }
  }

  protected isStepDone(step: PlanStep): boolean {
    if (step.action.kind === 'toggle') {
      return (
        this.escalation.isSystemOn(step.action.id) === !!step.suggestedOn
      );
    }
    return this.lastTriggeredAt(step.action.id) !== null;
  }

  protected stepActionLabel(step: PlanStep): string {
    if (step.action.kind === 'toggle') {
      return step.suggestedOn ? 'Turn ON' : 'Turn OFF';
    }
    if (step.action.category === 'emergency') return 'Place call';
    if (step.action.category === 'announcements') return 'Broadcast';
    return 'Trigger';
  }

  protected stepActionIcon(step: PlanStep): string {
    if (step.action.kind === 'toggle') {
      return step.suggestedOn ? 'toggle_on' : 'toggle_off';
    }
    if (step.action.category === 'emergency') return 'call';
    if (step.action.category === 'announcements') return 'campaign';
    return 'bolt';
  }

  protected markAlertEscalated(): void {
    const alert = this.currentAlert();
    if (!alert) return;
    this.alerts.escalateAlert(alert);
    // Keep the scope so the operator sees the updated status; but hide the CTA.
  }

  protected clearAlertScope(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { alertId: null },
      queryParamsHandling: 'merge',
    });
  }

  protected dialogTitle(p: Pending): string {
    if (p.kind === 'toggle') {
      return `Turn ${p.action.label} ${p.nextOn ? 'ON' : 'OFF'}?`;
    }
    switch (p.action.category) {
      case 'emergency':
        return `${p.action.label} now?`;
      case 'announcements':
        return `Broadcast ${p.action.label.toLowerCase()}?`;
      default:
        return `Confirm ${p.action.label}?`;
    }
  }

  protected confirmLabel(p: Pending): string {
    if (p.kind === 'toggle') return p.nextOn ? 'Turn ON' : 'Turn OFF';
    if (p.action.category === 'emergency') return 'Place call';
    if (p.action.category === 'announcements') return 'Broadcast';
    return 'Confirm';
  }

  protected confirmIcon(p: Pending): string {
    if (p.kind === 'toggle')
      return p.nextOn ? 'toggle_on' : 'toggle_off';
    if (p.action.category === 'emergency') return 'call';
    if (p.action.category === 'announcements') return 'campaign';
    return 'bolt';
  }

  /** Short human time-ago, updates whenever the template re-renders. */
  protected relative(date: Date): string {
    const diffMs = Date.now() - date.getTime();
    const diffMin = Math.floor(diffMs / 60_000);
    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    return `${diffHr}h ago`;
  }

  /** Whether a toggle system differs from its venue-default state. */
  protected isAltered(action: EscalationAction): boolean {
    if (action.kind !== 'toggle') return false;
    return this.escalation.isSystemOn(action.id) !== !!action.defaultOn;
  }

  protected severityLabel(alert: VenueAlert): string {
    switch (alert.severity) {
      case 'critical':
        return 'Critical';
      case 'warning':
        return 'Warning';
      default:
        return 'Info';
    }
  }

  protected severityPillClass(alert: VenueAlert): string {
    const base =
      'inline-flex items-center px-2 h-5 rounded-full text-[10px] font-bold uppercase tracking-wider';
    switch (alert.severity) {
      case 'critical':
        return `${base} bg-error-container text-on-error-container`;
      case 'warning':
        return `${base} bg-secondary-container text-on-secondary-container`;
      default:
        return `${base} bg-primary-container text-on-primary-container`;
    }
  }

  /**
   * Pick a set of escalation actions based on what the alert looks like.
   * This is intentionally simple keyword matching — in production this
   * would be driven by the incident classification model.
   */
  private buildPlan(alert: VenueAlert): PlanStep[] {
    const text = `${alert.title} ${alert.description}`.toLowerCase();
    const steps: PlanStep[] = [];

    const hasAny = (words: string[]): boolean =>
      words.some((w) => text.includes(w));

    const add = (step: PlanStep): void => {
      if (steps.some((s) => s.action.id === step.action.id)) return;
      steps.push(step);
    };

    const actionById = (id: string): EscalationAction | undefined =>
      this.escalation.actions.find((a) => a.id === id);

    // Fight / altercation / weapon
    if (hasAny(['fight', 'altercation', 'assault', 'aggress', 'weapon'])) {
      const police = actionById('call-police');
      const sec = actionById('dispatch-security');
      if (police)
        add({
          action: police,
          reason: 'Physical altercation detected — request police presence.',
        });
      if (sec)
        add({
          action: sec,
          reason: 'Send nearest security unit to separate parties.',
        });
      if (alert.severity === 'critical') {
        const music = actionById('music-playback');
        if (music)
          add({
            action: music,
            suggestedOn: false,
            reason: 'Reduce crowd tension by cutting the music.',
          });
      }
    }

    // Medical emergencies
    if (
      hasAny([
        'medical',
        'injury',
        'injured',
        'faint',
        'unconscious',
        'overdose',
        'seizure',
        'allergic',
        'bleeding',
      ])
    ) {
      const ems = actionById('call-ems');
      const med = actionById('dispatch-medical');
      const pa = actionById('pa-medical');
      if (ems)
        add({
          action: ems,
          reason: 'Medical signal detected — paramedics may be needed.',
        });
      if (med)
        add({
          action: med,
          reason: 'Floor medics to attend immediately.',
        });
      if (pa)
        add({
          action: pa,
          reason:
            'Ask off-duty medical staff in the crowd to identify themselves.',
        });
    }

    // Fire / smoke
    if (hasAny(['fire', 'smoke', 'flame', 'burn'])) {
      const fire = actionById('call-fire');
      const evac = actionById('pa-evacuate');
      const lights = actionById('house-lights');
      const music = actionById('music-playback');
      if (fire)
        add({
          action: fire,
          reason: 'Fire or smoke signal — alert fire & rescue.',
        });
      if (evac)
        add({
          action: evac,
          reason: 'Initiate evacuation PA so guests move to exits.',
        });
      if (lights)
        add({
          action: lights,
          suggestedOn: true,
          reason: 'Bring house lights up so guests can see exits.',
        });
      if (music)
        add({
          action: music,
          suggestedOn: false,
          reason: 'Cut music so evacuation PA can be heard clearly.',
        });
    }

    // Harassment
    if (hasAny(['harass', 'grop', 'predator'])) {
      const sec = actionById('dispatch-security');
      const mgr = actionById('notify-manager');
      if (sec)
        add({
          action: sec,
          reason: 'Security to approach discreetly and intervene.',
        });
      if (mgr)
        add({
          action: mgr,
          reason: 'Loop in the manager on duty for follow-up.',
        });
    }

    // Theft
    if (hasAny(['theft', 'steal', 'stolen', 'pickpocket'])) {
      const sec = actionById('dispatch-security');
      const mgr = actionById('notify-manager');
      if (sec)
        add({
          action: sec,
          reason: 'Security to locate suspect and secure exits.',
        });
      if (mgr)
        add({
          action: mgr,
          reason: 'Manager to coordinate incident report.',
        });
    }

    // Crowd / crush
    if (hasAny(['crowd', 'crush', 'stampede', 'overcrowd', 'push'])) {
      const sec = actionById('dispatch-security');
      const door = actionById('reinforce-door');
      const pa = actionById('pa-general');
      if (sec)
        add({
          action: sec,
          reason: 'Floor team to manage crowd density at flashpoint.',
        });
      if (door)
        add({
          action: door,
          reason: 'Door staff to slow entrance flow until zone clears.',
        });
      if (pa)
        add({
          action: pa,
          reason: 'General PA to ease crowd pressure.',
        });
    }

    // Severity fallbacks when no keyword matched
    if (steps.length === 0) {
      if (alert.severity === 'critical') {
        const police = actionById('call-police');
        const sec = actionById('dispatch-security');
        if (sec)
          add({
            action: sec,
            reason: 'Critical signal — send security to assess.',
          });
        if (police)
          add({
            action: police,
            reason: 'Keep police on standby given critical severity.',
          });
      } else if (alert.severity === 'warning') {
        const sec = actionById('dispatch-security');
        if (sec)
          add({
            action: sec,
            reason: 'Floor team to verify and handle on-site.',
          });
      }
    }

    // Always notify the shift manager so they have situational awareness.
    const manager = actionById('notify-manager');
    if (manager)
      add({
        action: manager,
        reason: 'Keep the manager on duty in the loop on this alert.',
      });

    return steps;
  }
}
