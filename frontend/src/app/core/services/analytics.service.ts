import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { environment } from '@env/environment';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs';

declare global {
  interface Window {
    gtag: (command: string, ...args: unknown[]) => void;
    dataLayer: unknown[];
  }
}

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private readonly GA_ID = environment.gaId;
  private readonly platformId = inject(PLATFORM_ID);

  constructor(private router: Router) {
    this.init();
  }

  private init(): void {
    // Analytics is browser-only — skip during SSR
    if (!isPlatformBrowser(this.platformId)) return;

    // Only initialize if GA_ID is configured
    if (!this.GA_ID) {
      if (!environment.production) {
        console.debug('[Analytics] GA_ID not configured, skipping initialization');
      }
      return;
    }

    // Load GA script dynamically
    this.loadGaScript();

    // Track page views automatically
    this.router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe(() => {
        this.trackPageView(window.location.pathname + window.location.search);
      });
  }

  private loadGaScript(): void {
    // Avoid duplicate script loading
    if (document.querySelector('script[src*="googletagmanager.com"]')) return;

    const gtmScript = document.createElement('script');
    gtmScript.async = true;
    gtmScript.src = `https://www.googletagmanager.com/gtag/js?id=${this.GA_ID}`;
    document.head.appendChild(gtmScript);

    const inlineScript = document.createElement('script');
    inlineScript.textContent = `
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', '${this.GA_ID}');
    `;
    document.head.appendChild(inlineScript);
  }

  trackPageView(path: string, title?: string): void {
    if (typeof window.gtag === 'undefined') return;
    window.gtag('event', 'page_view', {
      page_path: path,
      page_title: title ?? document.title,
    });
  }

  trackEvent(action: string, params?: Record<string, unknown>): void {
    if (typeof window.gtag === 'undefined') return;
    window.gtag('event', action, params);
  }

  trackAddToCart(productName: string, price: number, currency: string): void {
    this.trackEvent('add_to_cart', {
      currency,
      value: price,
      items: [{ item_name: productName, price }],
    });
  }

  trackPurchase(orderId: string, value: number, currency: string): void {
    this.trackEvent('purchase', {
      transaction_id: orderId,
      value,
      currency,
    });
  }

  trackSearch(searchTerm: string): void {
    this.trackEvent('search', { search_term: searchTerm });
  }
}
