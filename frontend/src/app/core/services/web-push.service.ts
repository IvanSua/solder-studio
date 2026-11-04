import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { environment } from '@env/environment';

@Injectable({ providedIn: 'root' })
export class WebPushService {
  private http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly pushUrl = `${environment.apiUrl}/push`;

  /** Returns true if the browser supports Web Push and a service worker is registered. */
  get isSupported(): boolean {
    return (
      isPlatformBrowser(this.platformId) &&
      'serviceWorker' in navigator &&
      'PushManager' in window
    );
  }

  /** Returns the current browser notification permission. */
  get permission(): NotificationPermission {
    if (!isPlatformBrowser(this.platformId)) return 'default';
    return Notification.permission;
  }

  /**
   * Requests notification permission, subscribes the browser to push,
   * and registers the subscription with the backend.
   *
   * @returns 'granted' | 'denied' | 'unsupported'
   */
  async subscribe(): Promise<'granted' | 'denied' | 'unsupported'> {
    if (!this.isSupported) return 'unsupported';

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return 'denied';

    try {
      const vapidKey = await this.fetchVapidPublicKey();
      const registration = await navigator.serviceWorker.ready;

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(vapidKey),
      });

      const subJson = subscription.toJSON();
      await firstValueFrom(
        this.http.post(`${this.pushUrl}/subscribe`, {
          endpoint:  subJson.endpoint,
          p256dh:    subJson.keys?.['p256dh'],
          auth:      subJson.keys?.['auth'],
          userAgent: navigator.userAgent,
        })
      );

      return 'granted';
    } catch (err) {
      console.error('[WebPush] Subscribe failed:', err);
      return 'denied';
    }
  }

  /**
   * Unsubscribes the current browser from push notifications.
   */
  async unsubscribe(): Promise<void> {
    if (!this.isSupported) return;

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return;

    const endpoint = subscription.endpoint;
    await subscription.unsubscribe();

    await firstValueFrom(
      this.http.delete(`${this.pushUrl}/unsubscribe`, { body: { endpoint } })
    ).catch(() => {/* server-side cleanup is best-effort */});
  }

  /**
   * Returns true if the browser currently has an active push subscription.
   */
  async isSubscribed(): Promise<boolean> {
    if (!this.isSupported) return false;
    const registration = await navigator.serviceWorker.ready;
    const sub = await registration.pushManager.getSubscription();
    return sub !== null;
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private async fetchVapidPublicKey(): Promise<string> {
    const res = await firstValueFrom(
      this.http.get<{ publicKey: string }>(`${this.pushUrl}/vapid-public-key`)
    );
    return res.publicKey;
  }

  /** Converts a Base64url VAPID key string to the Uint8Array expected by PushManager. */
  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
  }
}
