import { Injectable, inject, signal, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subscription, interval, switchMap, of, catchError } from 'rxjs';
import { environment } from '@env/environment';
import { Notification, NotificationPage } from '../models/notification.model';

const POLL_INTERVAL_MS = 30_000; // poll every 30 s

@Injectable({ providedIn: 'root' })
export class NotificationService implements OnDestroy {
  private http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/notifications`;

  /** Current unread count — used by the navbar badge */
  unreadCount = signal(0);

  private pollSub?: Subscription;

  // ── Polling ────────────────────────────────────────────────────────────────

  startPolling(): void {
    if (this.pollSub) return;
    this.fetchUnreadCount();
    this.pollSub = interval(POLL_INTERVAL_MS)
      .pipe(switchMap(() => this.http.get<{ count: number }>(`${this.apiUrl}/unread-count`).pipe(catchError(() => of({ count: 0 })))))
      .subscribe(res => this.unreadCount.set(res.count));
  }

  stopPolling(): void {
    this.pollSub?.unsubscribe();
    this.pollSub = undefined;
    this.unreadCount.set(0);
  }

  ngOnDestroy(): void {
    this.stopPolling();
  }

  // ── API calls ──────────────────────────────────────────────────────────────

  getNotifications(page = 0, size = 20): Observable<NotificationPage> {
    return this.http.get<NotificationPage>(this.apiUrl, { params: { page, size } });
  }

  markRead(id: number): Observable<Notification> {
    return this.http.patch<Notification>(`${this.apiUrl}/${id}/read`, {});
  }

  markAllRead(): Observable<{ updated: number }> {
    return this.http.post<{ updated: number }>(`${this.apiUrl}/read-all`, {});
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private fetchUnreadCount(): void {
    this.http.get<{ count: number }>(`${this.apiUrl}/unread-count`)
      .pipe(catchError(() => of({ count: 0 })))
      .subscribe(res => this.unreadCount.set(res.count));
  }

  /** Decrement badge locally after marking a notification read */
  decrementUnread(): void {
    this.unreadCount.update(n => Math.max(0, n - 1));
  }

  resetUnread(): void {
    this.unreadCount.set(0);
  }
}
