import { Injectable, signal, effect } from '@angular/core';

type Theme = 'light' | 'dark' | 'system';
const STORAGE_KEY = 'app-theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private _theme = signal<Theme>(this.loadTheme());

  /** Current effective theme (resolved from user preference + system) */
  effectiveTheme = signal<'light' | 'dark'>(this.resolveTheme());

  constructor() {
    // React to theme changes and update the DOM
    effect(() => {
      const theme = this.effectiveTheme();
      this.applyTheme(theme);
    });

    // Listen to system preference changes
    if (typeof window !== 'undefined') {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (this._theme() === 'system') {
          this.effectiveTheme.set(this.resolveTheme());
        }
      });
    }
  }

  get currentTheme(): Theme {
    return this._theme();
  }

  setTheme(theme: Theme): void {
    this._theme.set(theme);
    localStorage.setItem(STORAGE_KEY, theme);
    this.effectiveTheme.set(this.resolveTheme());
  }

  toggle(): void {
    const next = this.effectiveTheme() === 'dark' ? 'light' : 'dark';
    this.setTheme(next);
  }

  private loadTheme(): Theme {
    if (typeof localStorage === 'undefined') return 'system';
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    return stored ?? 'system';
  }

  private resolveTheme(): 'light' | 'dark' {
    const theme = this._theme();
    if (theme === 'system') {
      if (typeof window === 'undefined') return 'light';
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return theme;
  }

  private applyTheme(theme: 'light' | 'dark'): void {
    if (typeof document === 'undefined') return;
    document.documentElement.setAttribute('data-theme', theme);
  }
}
