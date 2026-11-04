import { Component, inject, ChangeDetectionStrategy, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService } from '@core/services/toast.service';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toast-container" aria-live="polite" aria-label="Notificaciones">
      @for (toast of toastService.toasts(); track toast.id) {
        <div
          class="toast"
          [class]="'toast-' + toast.type"
          [class.toast-exiting]="exitingIds().has(toast.id)"
          role="alert"
          (click)="dismiss(toast.id)">
          <span class="toast-icon">
            @switch (toast.type) {
              @case ('success') {
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="20 6 9 17 4 12"/></svg>
              }
              @case ('error') {
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
              }
              @case ('warning') {
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              }
              @default {
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              }
            }
          </span>
          <span class="toast-message">{{ toast.message }}</span>
          <button
            class="toast-close"
            (click)="dismiss(toast.id); $event.stopPropagation()"
            aria-label="Cerrar notificación">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
          <!-- Progress bar -->
          @if (toast.duration && toast.duration > 0) {
            <div class="toast-progress" [class]="'progress-' + toast.type"
                 [style.animation-duration.ms]="toast.duration">
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .toast-container {
      position: fixed;
      bottom: 1.5rem;
      right: 1.5rem;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
      pointer-events: none;
      max-width: 380px;
    }

    .toast {
      position: relative;
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      padding: 0.875rem 1rem;
      border-radius: 10px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.06);
      pointer-events: all;
      cursor: default;
      animation: slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      border: 1px solid transparent;
      min-width: 280px;
      overflow: hidden;
    }

    @keyframes slideIn {
      from {
        opacity: 0;
        transform: translateX(120%) scale(0.95);
      }
      to {
        opacity: 1;
        transform: translateX(0) scale(1);
      }
    }

    @keyframes slideOut {
      from {
        opacity: 1;
        transform: translateX(0) scale(1);
      }
      to {
        opacity: 0;
        transform: translateX(120%) scale(0.95);
      }
    }

    .toast-exiting {
      animation: slideOut 0.25s cubic-bezier(0.4, 0, 1, 1) forwards;
    }

    /* Progress bar animation */
    .toast-progress {
      position: absolute;
      bottom: 0;
      left: 0;
      height: 3px;
      width: 100%;
      transform-origin: left;
      animation: shrink linear forwards;
    }

    @keyframes shrink {
      from { transform: scaleX(1); }
      to { transform: scaleX(0); }
    }

    /* Types — usan variables globales, responden a dark mode automáticamente */
    .toast-success {
      background: var(--success-bg);
      border-color: var(--success-border);
      color: var(--success-text);
    }
    .toast-success .toast-icon { color: var(--success); }
    .toast-success .progress-success { background: var(--success); }

    .toast-error {
      background: var(--danger-bg);
      border-color: var(--danger-border);
      color: var(--danger-text);
    }
    .toast-error .toast-icon { color: var(--danger); }
    .toast-error .progress-error { background: var(--danger); }

    .toast-warning {
      background: var(--warning-bg);
      border-color: var(--warning-border);
      color: var(--warning-text);
    }
    .toast-warning .toast-icon { color: var(--warning); }
    .toast-warning .progress-warning { background: var(--warning); }

    .toast-info {
      background: var(--bg-secondary);
      border-color: var(--border);
      color: var(--text);
    }
    .toast-info .toast-icon { color: var(--primary); }
    .toast-info .progress-info { background: var(--primary); }

    .toast-icon {
      flex-shrink: 0;
      margin-top: 1px;
      display: flex;
      align-items: center;
    }

    .toast-message {
      flex: 1;
      font-size: 0.875rem;
      font-weight: 500;
      line-height: 1.4;
    }

    .toast-close {
      flex-shrink: 0;
      background: none;
      border: none;
      cursor: pointer;
      padding: 2px;
      border-radius: 4px;
      color: currentColor;
      opacity: 0.5;
      display: flex;
      align-items: center;
      transition: opacity 0.15s;
      margin-top: 1px;
    }
    .toast-close:hover { opacity: 1; }

    @media (max-width: 480px) {
      .toast-container {
        left: 1rem;
        right: 1rem;
        bottom: 1rem;
        max-width: none;
      }
      .toast { min-width: 0; }
    }
  `],
})
export class ToastContainerComponent implements OnDestroy {
  toastService = inject(ToastService);
  exitingIds = signal<Set<number>>(new Set());
  private timeouts = new Map<number, ReturnType<typeof setTimeout>>();

  dismiss(id: number): void {
    // Don't dismiss twice
    if (this.exitingIds().has(id)) return;

    // Mark as exiting for animation
    this.exitingIds.update(s => new Set([...s, id]));

    // Remove from DOM after animation completes (service handles auto-dismiss)
    const timeout = setTimeout(() => {
      this.toastService.dismiss(id);
      this.exitingIds.update(s => {
        const newSet = new Set(s);
        newSet.delete(id);
        return newSet;
      });
      this.timeouts.delete(id);
    }, 250);

    this.timeouts.set(id, timeout);
  }

  ngOnDestroy(): void {
    // Clear all pending timeouts
    this.timeouts.forEach(t => clearTimeout(t));
  }
}
