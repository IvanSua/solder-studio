import { Injectable, signal, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { TranslateService } from '@ngx-translate/core';

const STORAGE_KEY = 'app-language';

@Injectable({ providedIn: 'root' })
export class TranslationService {
  private readonly platformId = inject(PLATFORM_ID);
  currentLang = signal<string>('es');

  constructor(private translate: TranslateService) {
    this.init();
  }

  private init(): void {
    this.translate.addLangs(['es', 'en']);
    this.translate.setDefaultLang('es');

    const stored = isPlatformBrowser(this.platformId)
      ? localStorage.getItem(STORAGE_KEY)
      : null;
    const browserLang = isPlatformBrowser(this.platformId)
      ? (this.translate.getBrowserLang() ?? 'es')
      : 'es';
    const lang = stored || (browserLang.match(/es|en/) ? browserLang : 'es');

    this.translate.use(lang).subscribe();
    this.currentLang.set(lang);
  }

  setLanguage(lang: string): void {
    this.translate.use(lang);
    this.currentLang.set(lang);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(STORAGE_KEY, lang);
    }
  }

  toggle(): void {
    const next = this.currentLang() === 'es' ? 'en' : 'es';
    this.setLanguage(next);
  }
}
