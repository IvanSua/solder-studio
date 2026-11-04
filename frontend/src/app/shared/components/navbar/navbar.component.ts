import {
  Component,
  computed,
  inject,
  signal,
  HostListener,
  DestroyRef,
  effect,
  ChangeDetectionStrategy,
  PLATFORM_ID,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '@core/services/auth.service';
import { CartService } from '@core/services/cart.service';
import { ThemeService } from '@core/services/theme.service';
import { TranslationService } from '@core/services/translation.service';
import { ProductService } from '@core/services/product.service';
import { WishlistService } from '@core/services/wishlist.service';
import { NotificationService } from '@core/services/notification.service';
import { WebPushService } from '@core/services/web-push.service';
import { Notification } from '@core/models/notification.model';
import { PricePipe } from '@shared/pipes/price.pipe';
import { Subject, debounceTime, distinctUntilChanged, filter } from 'rxjs';

interface AutocompleteItem {
  productId: number;
  name: string;
  slug: string;
  imageUrl: string | null;
  minPriceAmount: number;
  currencyCode: string;
}

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, PricePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="navbar" aria-label="Navegación principal">
      <div class="nav-inner">

        <!-- ── Logo ─────────────────────────────────────────── -->
        <a class="logo" routerLink="/">
          <img src="assets/icon.png" alt="Solder Studio" class="logo-img" />
          <span class="logo-text">Solder Studio</span>
        </a>

        <!-- ── Desktop links (hidden on auth page) ──────────── -->
        @if (!isAuthPage()) {
          <ul class="nav-links">
            <li><a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{exact:true}">Catálogo</a></li>
            <li><a routerLink="/sugerencias" routerLinkActive="active">Sugerencias</a></li>
            @if (isAdmin()) {
              <li><a routerLink="/admin" routerLinkActive="active">Admin</a></li>
            }
          </ul>
        }

        <!-- ── Search with autocomplete (hidden on auth page) ── -->
        @if (!isAuthPage()) {
        <div class="search-container">
          <input
            type="text"
            class="search-input"
            placeholder="Buscar productos..."
            aria-label="Buscar productos"
            [ngModel]="searchQuery()"
            (ngModelChange)="onSearchInput($event)"
            (focus)="onSearchFocus()"
            (keydown.enter)="performSearch()"
            (keydown.escape)="closeAutocomplete()"
            #searchInput
          />
          <button class="search-btn" (click)="performSearch()" type="button" aria-label="Buscar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8"/>
              <path d="m21 21-4.35-4.35"/>
            </svg>
          </button>

          <!-- Search History (shown when focused, input empty, has history) -->
          @if (showSearchHistory() && searchHistory().length > 0) {
            <div class="autocomplete-dropdown">
              <div class="history-header">
                <span class="history-title">Búsquedas recientes</span>
                <button class="history-clear" (click)="clearSearchHistory()">Limpiar</button>
              </div>
              @for (term of searchHistory(); track term) {
                <div class="history-item" (click)="selectHistoryItem(term)">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="1 4 1 10 7 10"/>
                    <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
                  </svg>
                  <span>{{ term }}</span>
                </div>
              }
            </div>
          }

          @if (autocompleteOpen() && autocompleteResults().length > 0) {
            <div class="autocomplete-dropdown">
              @for (item of autocompleteResults(); track item.productId) {
                <a class="autocomplete-item" [routerLink]="['/product', item.slug]" (click)="closeAutocomplete()">
                  @if (item.imageUrl) {
                    <img [src]="item.imageUrl" [alt]="item.name" class="autocomplete-image" loading="lazy"/>
                  } @else {
                    <div class="autocomplete-image-placeholder"></div>
                  }
                  <div class="autocomplete-content">
                    <div class="autocomplete-name">{{ item.name }}</div>
                    <div class="autocomplete-price">{{ item.minPriceAmount | price: item.currencyCode }}</div>
                  </div>
                </a>
              }
            </div>
          }
          @if (autocompleteOpen() && autocompleteResults().length === 0 && autocompleteSearched()) {
            <div class="autocomplete-dropdown">
              <div class="autocomplete-empty">Sin resultados</div>
            </div>
          }
          @if (autocompleteLoading()) {
            <div class="autocomplete-dropdown">
              <div class="autocomplete-loading">Cargando...</div>
            </div>
          }
        </div>
        } <!-- end @if (!isAuthPage()) for search -->

        <!-- ── Right side (hidden entirely on auth page) ───── -->
        @if (!isAuthPage()) {
          <div class="nav-right">

            <!-- Wishlist icon -->
            @if (isAuthenticated()) {
              <a class="wishlist-btn" routerLink="/wishlist" title="Lista de deseos" aria-label="Lista de deseos">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                </svg>
                @if (wishlistCount() > 0) {
                  <span class="wishlist-badge">{{ wishlistCount() > 9 ? '9+' : wishlistCount() }}</span>
                }
              </a>
            }

            <!-- Notification bell -->
            @if (isAuthenticated()) {
              <div class="notif-wrapper">
              <div class="notif-btn" (click)="toggleNotifPanel()" title="Notificaciones" aria-label="Notificaciones" [attr.aria-expanded]="notifPanelOpen()" aria-controls="notif-panel" role="button" tabindex="0">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
                @if (unreadCount() > 0) {
                  <span class="notif-badge">{{ unreadCount() > 9 ? '9+' : unreadCount() }}</span>
                }
              </div>

              @if (notifPanelOpen()) {
                <div id="notif-panel" class="notif-panel" role="dialog" aria-label="Panel de notificaciones" (click)="$event.stopPropagation()">
                  <div class="notif-header">
                    <span class="notif-header-title">Notificaciones</span>
                    @if (unreadCount() > 0) {
                      <button class="notif-mark-all" (click)="onMarkAllRead()">Marcar todas</button>
                    }
                  </div>

                  @if (notifLoading()) {
                    <div class="notif-loading">Cargando...</div>
                  } @else if (notifications().length === 0) {
                    <div class="notif-empty">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                      <span>Sin notificaciones</span>
                    </div>
                  } @else {
                    <div class="notif-list">
                      @for (n of notifications(); track n.id) {
                        <div class="notif-item" [class.unread]="!n.read" (click)="onNotifClick(n)">
                          <div class="notif-dot" [class.visible]="!n.read"></div>
                          <div class="notif-body">
                            <div class="notif-title">{{ n.title }}</div>
                            <div class="notif-msg">{{ n.message }}</div>
                            <div class="notif-time">{{ n.createdAt | date:'d MMM, HH:mm' }}</div>
                          </div>
                        </div>
                      }
                    </div>
                  }

                  @if (pushSupported() && pushPermission() === 'default') {
                    <div class="push-prompt">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                      <span>Activar notificaciones push</span>
                      <button class="push-prompt-btn" [disabled]="pushPromptLoading()" (click)="enablePushFromPanel()">
                        {{ pushPromptLoading() ? '...' : 'Activar' }}
                      </button>
                    </div>
                  }
                </div>
              }
              </div> <!-- end notif-wrapper -->
            }

            <!-- Language toggle -->
            <button class="lang-btn" (click)="toggleLanguage()" [title]="isSpanish() ? 'English' : 'Español'" [attr.aria-label]="isSpanish() ? 'Switch to English' : 'Cambiar a Español'" type="button">
              {{ isSpanish() ? 'EN' : 'ES' }}
            </button>

            <!-- Theme toggle -->
            <button class="theme-btn" (click)="toggleTheme()" [title]="isDark() ? 'Modo claro' : 'Modo oscuro'" [attr.aria-label]="isDark() ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'" type="button">
              @if (isDark()) {
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="5"/>
                  <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                  <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                </svg>
              } @else {
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                </svg>
              }
            </button>

            <!-- Cart icon -->
            @if (isAuthenticated()) {
              <a class="cart-btn" routerLink="/cart" title="Carrito" aria-label="Carrito">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
                  <line x1="3" y1="6" x2="21" y2="6"/>
                  <path d="M16 10a4 4 0 01-8 0"/>
                </svg>
                @if (cartCount() > 0) {
                  <span class="cart-badge">{{ cartCount() > 9 ? '9+' : cartCount() }}</span>
                }
              </a>
            }

            <!-- Auth: logged out -->
            @if (!isAuthenticated()) {
              <a class="btn-login" routerLink="/auth">Ingresar</a>
            }

            <!-- Auth: logged in — user dropdown -->
            @if (isAuthenticated()) {
              <div class="user-menu" (click)="toggleDropdown()" [class.open]="dropdownOpen()" [attr.aria-expanded]="dropdownOpen()" aria-haspopup="true" role="button" tabindex="0">
                <span class="user-avatar">{{ userInitial() }}</span>
                <span class="user-name">{{ userName() }}</span>
                <svg class="chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <polyline points="6 9 12 15 18 9"/>
                </svg>

                @if (dropdownOpen()) {
                  <div class="dropdown">
                    <a routerLink="/profile" (click)="closeDropdown()">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
                      Mi perfil
                    </a>
                    <a routerLink="/orders" (click)="closeDropdown()">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/><line x1="16" y1="12" x2="16" y2="12"/></svg>
                      Mis pedidos
                    </a>
                    <a routerLink="/loyalty" (click)="closeDropdown()">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                      Mi lealtad
                    </a>
                    <a routerLink="/designs" (click)="closeDropdown()">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                      Mis diseños
                    </a>
                    <a routerLink="/sugerencias" (click)="closeDropdown()">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                      Sugerencias
                    </a>
                    @if (isAdmin()) {
                      <a routerLink="/admin" (click)="closeDropdown()">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                        Panel admin
                      </a>
                    }
                    <div class="divider"></div>
                    <button (click)="logout()">Cerrar sesión</button>
                  </div>
                }
              </div>
            }
          </div>
        }

      </div>
    </nav>
  `,
  styles: [`
    .navbar {
      position: sticky; top: 0; z-index: 100;
      background: var(--bg);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--border);
      box-shadow: 0 1px 16px rgba(224,32,200,0.07);
      transition: background 0.2s, border-color 0.2s;
    }
    .nav-inner {
      max-width: 1200px; margin: 0 auto;
      display: flex; align-items: center; gap: 1.5rem;
      padding: 0 1.25rem; height: 60px;
    }

    /* Logo */
    .logo {
      display: flex; align-items: center; gap: 0.5rem;
      text-decoration: none; color: var(--text); flex-shrink: 0;
    }
    .logo-img { width: 32px; height: 32px; object-fit: contain; }
    .logo-text { font-weight: 800; font-size: 1.1rem; letter-spacing: -0.02em; color: var(--primary); }

    /* Nav links */
    .nav-links {
      display: flex; list-style: none; gap: 0.25rem; margin: 0; padding: 0;
    }
    .nav-links a {
      display: block; padding: 0.4rem 0.75rem;
      text-decoration: none; font-size: 0.9rem; font-weight: 500;
      color: var(--text-secondary); border-radius: 6px; transition: background .15s, color .15s;
    }
    .nav-links a:hover { background: var(--bg-secondary); color: var(--text); }
    .nav-links a.active { color: var(--primary); background: var(--bg-secondary); }

    /* Search container */
    .search-container {
      position: relative; display: flex; align-items: center; gap: 0.5rem;
      max-width: 400px; flex: 1; margin: 0 1rem;
    }
    .search-input {
      width: 100%; padding: 0.5rem 0.75rem; border: 1px solid var(--border);
      border-radius: 8px; font-size: 0.875rem; color: var(--text);
      background: var(--bg-secondary); transition: border .15s, background .15s;
    }
    .search-input:focus {
      outline: none; border-color: var(--primary); background: var(--bg);
      box-shadow: 0 0 0 3px rgba(224, 32, 200, 0.12);
    }
    .search-input::placeholder { color: var(--text-secondary); opacity: 0.6; }
    .search-btn {
      display: flex; align-items: center; justify-content: center;
      width: 36px; height: 36px; background: none; border: none;
      color: var(--text-secondary); cursor: pointer; border-radius: 6px;
      transition: background .15s, color .15s; flex-shrink: 0;
    }
    .search-btn:hover { background: var(--bg-secondary); color: var(--text); }

    /* Autocomplete dropdown */
    .autocomplete-dropdown {
      position: absolute; top: 100%; left: 0; width: 100%;
      background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px;
      box-shadow: 0 8px 24px rgba(0,0,0,.15);
      max-height: 360px; overflow-y: auto; margin-top: 0.5rem;
      z-index: 50;
    }
    .autocomplete-item {
      display: flex; gap: 0.75rem; padding: 0.75rem; border-bottom: 1px solid var(--border);
      text-decoration: none; color: var(--text); transition: background .12s; cursor: pointer;
    }
    .autocomplete-item:last-child { border-bottom: none; }
    .autocomplete-item:hover { background: var(--bg-secondary); }
    .autocomplete-image {
      width: 40px; height: 40px; border-radius: 6px;
      object-fit: cover; flex-shrink: 0;
    }
    .autocomplete-image-placeholder {
      width: 40px; height: 40px; border-radius: 6px;
      background: var(--border); flex-shrink: 0;
    }
    .autocomplete-content {
      display: flex; flex-direction: column; gap: 0.25rem; flex: 1;
      min-width: 0;
    }
    .autocomplete-name {
      font-size: 0.875rem; font-weight: 500; color: var(--text);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .autocomplete-price {
      font-size: 0.8rem; color: var(--text-secondary); font-weight: 600;
    }
    .autocomplete-empty, .autocomplete-loading {
      padding: 1rem; text-align: center; color: var(--text-secondary); font-size: 0.875rem;
    }

    /* Search History */
    .history-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.6rem 0.75rem;
      border-bottom: 1px solid var(--border);
    }
    .history-title {
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .history-clear {
      font-size: 0.75rem;
      color: var(--primary);
      background: none;
      border: none;
      cursor: pointer;
      padding: 0;
      font-weight: 500;
    }
    .history-clear:hover {
      text-decoration: underline;
    }
    .history-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.6rem 0.75rem;
      border-bottom: 1px solid var(--border);
      cursor: pointer;
      transition: background 0.12s;
      color: var(--text-secondary);
    }
    .history-item:last-child {
      border-bottom: none;
    }
    .history-item:hover {
      background: var(--bg-secondary);
      color: var(--text);
    }
    .history-item svg {
      flex-shrink: 0;
      opacity: 0.5;
    }
    .history-item span {
      font-size: 0.875rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* Right side */
    .nav-right {
      margin-left: auto; display: flex; align-items: center; gap: 0.75rem;
    }

    /* Wishlist */
    .wishlist-btn {
      position: relative; display: flex; align-items: center; justify-content: center;
      width: 38px; height: 38px; border-radius: 8px;
      color: var(--text-secondary); text-decoration: none; transition: background .15s, color .15s;
    }
    .wishlist-btn:hover { background: var(--bg-secondary); color: var(--danger); }
    .wishlist-badge {
      position: absolute; top: 2px; right: 2px;
      background: var(--danger); color: white;
      font-size: 0.6rem; font-weight: 700;
      min-width: 16px; height: 16px;
      border-radius: 8px; padding: 0 3px;
      display: flex; align-items: center; justify-content: center;
      line-height: 1;
    }

    /* Cart */
    .cart-btn {
      position: relative; display: flex; align-items: center; justify-content: center;
      width: 38px; height: 38px; border-radius: 8px;
      color: var(--text-secondary); text-decoration: none; transition: background .15s, color .15s;
    }
    .cart-btn:hover { background: var(--bg-secondary); color: var(--text); }
    .theme-btn {
      display: flex; align-items: center; justify-content: center;
      width: 36px; height: 36px; border-radius: 8px;
      color: var(--text-secondary); background: none; border: none;
      transition: background .15s, color .15s; flex-shrink: 0;
    }
    .theme-btn:hover { background: var(--bg-secondary); color: var(--text); }
    .lang-btn {
      display: flex; align-items: center; justify-content: center;
      width: 36px; height: 36px; border-radius: 8px;
      color: var(--text-secondary); background: none; border: none;
      font-size: 0.75rem; font-weight: 700;
      letter-spacing: 0.05em;
      transition: background .15s, color .15s; flex-shrink: 0;
    }
    .lang-btn:hover { background: var(--bg-secondary); color: var(--text); }
    .cart-badge {
      position: absolute; top: 2px; right: 2px;
      background: var(--primary); color: white;
      font-size: 0.6rem; font-weight: 700;
      min-width: 16px; height: 16px;
      border-radius: 8px; padding: 0 3px;
      display: flex; align-items: center; justify-content: center;
      line-height: 1;
    }

    /* Login button */
    .btn-login {
      padding: 0.4rem 1rem; background: var(--primary); color: white;
      text-decoration: none; border-radius: 8px; font-size: 0.875rem; font-weight: 600;
      transition: background .15s;
    }
    .btn-login:hover { background: var(--primary-dark); }

    /* User menu */
    .user-menu {
      position: relative; display: flex; align-items: center; gap: 0.4rem;
      padding: 0.35rem 0.6rem; border-radius: 8px; cursor: pointer;
      transition: background .15s; user-select: none;
    }
    .user-menu:hover, .user-menu.open { background: var(--bg-secondary); }
    .user-avatar {
      width: 28px; height: 28px; background: var(--primary); color: white;
      border-radius: 50%; display: flex; align-items: center; justify-content: center;
      font-size: 0.75rem; font-weight: 700; flex-shrink: 0;
    }
    .user-name { font-size: 0.875rem; font-weight: 500; color: var(--text); max-width: 110px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .chevron { color: var(--text-secondary); transition: transform .2s; }
    .user-menu.open .chevron { transform: rotate(180deg); }

    /* Dropdown */
    .dropdown {
      position: absolute; top: calc(100% + 6px); right: 0;
      background: var(--bg-card); border: 1px solid var(--border); border-radius: 10px;
      box-shadow: 0 8px 24px rgba(0,0,0,.15);
      min-width: 180px; padding: 0.4rem;
      display: flex; flex-direction: column; gap: 1px;
      animation: fadeDown 0.12s ease;
    }
    @keyframes fadeDown {
      from { opacity: 0; transform: translateY(-6px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .dropdown a, .dropdown button {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      width: 100%; padding: 0.55rem 0.75rem;
      text-align: left; text-decoration: none;
      font-size: 0.875rem; color: var(--text);
      background: none; border: none; border-radius: 6px;
      cursor: pointer; transition: background .12s;
    }
    .dropdown a:hover, .dropdown button:hover { background: var(--bg-secondary); color: var(--text); }
    .dropdown button { color: var(--danger); }
    .dropdown button:hover { background: var(--danger-bg); }
    .divider { height: 1px; background: var(--border); margin: 0.25rem 0.25rem; }

    /* Notification wrapper */
    .notif-wrapper { position: relative; }

    /* Notification bell */
    .notif-btn {
      position: relative; display: flex; align-items: center; justify-content: center;
      width: 38px; height: 38px; border-radius: 8px;
      color: var(--text-secondary); cursor: pointer; transition: background .15s, color .15s;
    }
    .notif-btn:hover { background: var(--bg-secondary); color: var(--text); }
    .notif-badge {
      position: absolute; top: 2px; right: 2px;
      background: var(--warning); color: white;
      font-size: 0.6rem; font-weight: 700;
      min-width: 16px; height: 16px;
      border-radius: 8px; padding: 0 3px;
      display: flex; align-items: center; justify-content: center;
      line-height: 1;
    }

    /* Notification panel */
    .notif-panel {
      position: absolute; top: calc(100% + 6px); right: 0;
      background: var(--bg-card); border: 1px solid var(--border); border-radius: 10px;
      box-shadow: 0 8px 24px rgba(0,0,0,.18);
      width: 320px; max-height: 420px;
      display: flex; flex-direction: column;
      animation: fadeDown 0.12s ease; z-index: 200;
      overflow: hidden;
    }
    .notif-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 0.75rem 1rem; border-bottom: 1px solid var(--border);
      flex-shrink: 0;
    }
    .notif-header-title { font-size: 0.875rem; font-weight: 700; color: var(--text); }
    .notif-mark-all {
      font-size: 0.75rem; color: var(--primary); background: none; border: none;
      cursor: pointer; padding: 0; font-weight: 500;
    }
    .notif-mark-all:hover { text-decoration: underline; }
    .notif-loading, .notif-empty {
      padding: 2rem; text-align: center; color: var(--text-secondary); font-size: 0.875rem;
      display: flex; flex-direction: column; align-items: center; gap: 0.5rem;
    }
    .notif-list { overflow-y: auto; flex: 1; }
    .notif-item {
      display: flex; align-items: flex-start; gap: 0.5rem;
      padding: 0.75rem 1rem; border-bottom: 1px solid var(--border);
      cursor: pointer; transition: background .12s;
    }
    .notif-item:last-child { border-bottom: none; }
    .notif-item:hover { background: var(--bg-secondary); }
    .notif-item.unread { background: var(--bg-secondary); }
    .notif-item.unread:hover { background: var(--bg-secondary); filter: brightness(0.95); }
    .notif-dot {
      width: 8px; height: 8px; border-radius: 50%;
      background: var(--primary); flex-shrink: 0; margin-top: 5px;
      opacity: 0; transition: opacity .15s;
    }
    .notif-dot.visible { opacity: 1; }
    .notif-body { flex: 1; min-width: 0; }
    .notif-title { font-size: 0.8rem; font-weight: 600; color: var(--text); margin-bottom: 2px; }
    .notif-msg {
      font-size: 0.775rem; color: var(--text-secondary); line-height: 1.4;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .notif-time { font-size: 0.7rem; color: var(--text-secondary); margin-top: 3px; opacity: 0.7; }

    /* Push notification prompt */
    .push-prompt {
      display: flex; align-items: center; gap: 0.5rem;
      padding: 0.6rem 1rem; border-top: 1px solid var(--border);
      background: var(--bg-secondary); font-size: 0.75rem; color: var(--text-secondary);
      flex-shrink: 0;
    }
    .push-prompt svg { flex-shrink: 0; color: var(--text-secondary); }
    .push-prompt span { flex: 1; }
    .push-prompt-btn {
      padding: 0.25rem 0.65rem; background: var(--primary); color: white;
      border: none; border-radius: 6px; font-size: 0.72rem; font-weight: 600;
      cursor: pointer; white-space: nowrap; transition: background 0.15s;
    }
    .push-prompt-btn:hover:not(:disabled) { background: var(--primary-dark); }
    .push-prompt-btn:disabled { opacity: 0.6; cursor: not-allowed; }
  `],
})
export class NavbarComponent {
  private auth = inject(AuthService);
  private cartService = inject(CartService);
  private productService = inject(ProductService);
  private wishlistService = inject(WishlistService);
  private notifService = inject(NotificationService);
  private router = inject(Router);
  private themeService = inject(ThemeService);
  private translationService = inject(TranslationService);
  private webPush = inject(WebPushService);
  private readonly platformId = inject(PLATFORM_ID);

  private destroyRef = inject(DestroyRef);
  private searchInput$ = new Subject<string>();

  isAuthenticated = this.auth.isAuthenticated;
  isAdmin = this.auth.isAdmin;
  isDark = computed(() => this.themeService.effectiveTheme() === 'dark');
  isSpanish = computed(() => this.translationService.currentLang() === 'es');
  toggleTheme = () => this.themeService.toggle();
  toggleLanguage = () => this.translationService.toggle();

  userName = computed(() => this.auth.user()?.firstName ?? '');
  userInitial = computed(() => {
    const name = this.auth.user()?.firstName ?? '';
    return name.charAt(0).toUpperCase();
  });

  cartCount = computed(() => {
    const items = this.cartService.cart()?.items ?? [];
    return items.reduce((sum, i) => sum + i.quantity, 0);
  });

  wishlistCount = computed(() => this.wishlistService.wishlistCount());
  unreadCount = computed(() => this.notifService.unreadCount());

  dropdownOpen = signal(false);

  // Notifications panel
  notifPanelOpen = signal(false);
  notifications = signal<Notification[]>([]);
  notifLoading = signal(false);

  // Push notification prompt
  pushSupported = signal(false);
  pushPermission = signal<NotificationPermission>('default');
  pushPromptLoading = signal(false);

  // Auth page detection
  private currentUrl = signal(this.router.url);
  isAuthPage = computed(() => this.currentUrl().startsWith('/auth'));

  // Search and autocomplete
  searchQuery = signal('');
  autocompleteResults = signal<AutocompleteItem[]>([]);
  autocompleteOpen = signal(false);
  autocompleteLoading = signal(false);
  autocompleteSearched = signal(false);
  showSearchHistory = signal(false);

  // Search history
  searchHistory = signal<string[]>([]);
  private readonly MAX_HISTORY = 5;
  private readonly HISTORY_KEY = 'search_history';

  constructor() {
    // Initialize push state (browser-only)
    if (isPlatformBrowser(this.platformId)) {
      this.pushSupported.set(this.webPush.isSupported);
      this.pushPermission.set(this.webPush.permission);
    }

    // Load search history from localStorage
    this.loadSearchHistory();

    // Track URL changes to detect auth page
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(e => this.currentUrl.set((e as NavigationEnd).urlAfterRedirects));

    // Setup search debouncing
    this.searchInput$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(query => this.performAutocompleteSearch(query));

    // Start/stop notification polling based on auth state
    effect(() => {
      if (this.auth.isAuthenticated()) {
        this.notifService.startPolling();
      } else {
        this.notifService.stopPolling();
        this.notifPanelOpen.set(false);
        this.notifications.set([]);
      }
    });
  }

  // ── Notifications panel ────────────────────────────────────────────────────

  toggleNotifPanel(): void {
    const open = !this.notifPanelOpen();
    this.notifPanelOpen.set(open);
    if (open) {
      if (this.notifications().length === 0) this.loadNotifications();
      // Refresh push permission state each time the panel opens
      if (isPlatformBrowser(this.platformId)) {
        this.pushPermission.set(this.webPush.permission);
      }
    }
  }

  async enablePushFromPanel(): Promise<void> {
    this.pushPromptLoading.set(true);
    try {
      const result = await this.webPush.subscribe();
      this.pushPermission.set(this.webPush.permission);
      if (result === 'granted') {
        this.pushSupported.set(true); // force re-evaluate prompt visibility
      }
    } finally {
      this.pushPromptLoading.set(false);
    }
  }

  private loadNotifications(): void {
    this.notifLoading.set(true);
    this.notifService.getNotifications(0, 15).subscribe({
      next: page => {
        this.notifications.set(page.content);
        this.notifLoading.set(false);
      },
      error: () => this.notifLoading.set(false),
    });
  }

  onNotifClick(n: Notification): void {
    if (!n.read) {
      this.notifService.markRead(n.id).subscribe(() => {
        this.notifications.update(list => list.map(item => item.id === n.id ? { ...item, read: true } : item));
        this.notifService.decrementUnread();
      });
    }
    if (n.link) {
      this.router.navigateByUrl(n.link);
    }
    this.notifPanelOpen.set(false);
  }

  onMarkAllRead(): void {
    this.notifService.markAllRead().subscribe(() => {
      this.notifications.update(list => list.map(n => ({ ...n, read: true })));
      this.notifService.resetUnread();
    });
  }

  onSearchFocus(): void {
    if (this.searchQuery().length === 0 && this.searchHistory().length > 0) {
      this.showSearchHistory.set(true);
    }
  }

  onSearchInput(query: string): void {
    this.searchQuery.set(query);
    this.searchInput$.next(query);
    if (query.length > 0) {
      this.showSearchHistory.set(false);
    } else if (this.searchHistory().length > 0) {
      this.showSearchHistory.set(true);
    }
  }

  private loadSearchHistory(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      const stored = localStorage.getItem(this.HISTORY_KEY);
      if (stored) {
        this.searchHistory.set(JSON.parse(stored));
      }
    } catch {
      this.searchHistory.set([]);
    }
  }

  private saveSearchHistory(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      localStorage.setItem(this.HISTORY_KEY, JSON.stringify(this.searchHistory()));
    } catch {
      // localStorage might be full or unavailable
    }
  }

  private addToSearchHistory(query: string): void {
    const trimmed = query.trim();
    if (!trimmed) return;

    const current = this.searchHistory().filter(s => s.toLowerCase() !== trimmed.toLowerCase());
    const updated = [trimmed, ...current].slice(0, this.MAX_HISTORY);
    this.searchHistory.set(updated);
    this.saveSearchHistory();
  }

  clearSearchHistory(): void {
    this.searchHistory.set([]);
    this.saveSearchHistory();
  }

  selectHistoryItem(query: string): void {
    this.searchQuery.set(query);
    this.performSearch();
  }

  private performAutocompleteSearch(query: string): void {
    if (query.length < 2) {
      this.autocompleteOpen.set(false);
      this.autocompleteSearched.set(false);
      return;
    }

    this.autocompleteLoading.set(true);
    this.autocompleteSearched.set(true);

    this.productService
      .autocomplete(query)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (results) => {
          this.autocompleteResults.set(results);
          this.autocompleteOpen.set(true);
          this.autocompleteLoading.set(false);
        },
        error: () => {
          this.autocompleteResults.set([]);
          this.autocompleteOpen.set(true);
          this.autocompleteLoading.set(false);
        },
      });
  }

  performSearch(): void {
    const query = this.searchQuery().trim();
    if (query.length > 0) {
      this.addToSearchHistory(query);
      this.closeAutocomplete();
      this.searchQuery.set('');
      this.router.navigate(['/'], { queryParams: { q: query } });
    }
  }

  closeAutocomplete(): void {
    this.autocompleteOpen.set(false);
    this.showSearchHistory.set(false);
  }

  toggleDropdown(): void {
    this.dropdownOpen.update(v => !v);
  }

  closeDropdown(): void {
    this.dropdownOpen.set(false);
  }

  logout(): void {
    this.auth.logout();
    this.dropdownOpen.set(false);
    this.router.navigate(['/auth']);
  }

  /** Close dropdowns when clicking outside */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.user-menu')) {
      this.dropdownOpen.set(false);
    }
    if (!target.closest('.search-container')) {
      this.closeAutocomplete();
    }
    if (!target.closest('.notif-wrapper')) {
      this.notifPanelOpen.set(false);
    }
  }
}
